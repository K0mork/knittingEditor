import Observation
import SwiftUI
import UIKit
@preconcurrency import WebKit

@MainActor
@Observable
final class WebViewModel {
    @ObservationIgnored weak var webView: WKWebView?
    private enum PendingDelivery {
        case backup(Data, String)
        case error(String)
    }

    /// バックアップとエラーをそれぞれ最新1件だけ、発生した順に保持する。
    /// 画面の表示には使わない。`updateUIView`から呼ぶ`attach`で書き換えても再描画を起こさないよう、観測の対象から外す。
    @ObservationIgnored private var pendingDeliveries: [PendingDelivery] = []
    @ObservationIgnored private var isFlushingDeliveries = false
    /// テストではWebViewへ送るスクリプトを記録する。
    @ObservationIgnored var evaluateScript: (WKWebView, String) -> Void = { webView, script in
        webView.evaluateJavaScript(script, completionHandler: nil)
    }
    /// バックアップとエラーのイベントを購読するReactが動作中かどうか。
    private(set) var webContentReady = false
    /// 編集画面の読み込み待ちを利用者へ伝えるかどうか。使い方ページのように
    /// `webReady`を送らない同梱ページでは表示しない。
    private(set) var isPreparingEditor = true
    /// メニューの「元に戻す」「やり直す」を選べるか。Web側の`commandState`で更新する。
    var editorCommandState = EditorCommandState()
    /// 保存画面・共有シート・Document Pickerを出している間は、メニューの項目を選べなくする。
    var isPresentingNativeUI = false
    /// 編集画面を一度でも表示したかどうか。準備中の表示の色を、起動画面に続くときと
    /// アプリ内で編集画面へ戻るときとで変える。
    private(set) var hasShownEditor = false

    private(set) var editorLoadFailure: String?
    @ObservationIgnored private var isEditorDocument = true
    @ObservationIgnored private var consecutiveRecoveries = 0
    @ObservationIgnored private var lastAutomaticRecovery: Date?
    @ObservationIgnored var reloadWebView: (WKWebView) -> Void = { webView in
        if webView.url == nil {
            webView.load(URLRequest(url: LocalWebSchemeHandler.indexURL))
        } else {
            webView.reload()
        }
    }
    @ObservationIgnored private var recoveryTimeout: Task<Void, Never>?
    @ObservationIgnored private var recoveryID: UUID?

    /// 保存領域は変更せず、終了した文書の読み込みだけをやり直す。
    @discardableResult
    func webContentProcessDidTerminate(now: Date = Date()) -> Bool {
        webContentReady = false
        editorCommandState = EditorCommandState()
        guard isEditorDocument else { return true }
        isPreparingEditor = true
        if editorLoadFailure != nil || consecutiveRecoveries >= 2 || lastAutomaticRecovery.map({ now.timeIntervalSince($0) < 10 }) == true {
            editorLoadDidFail()
            return false
        }
        consecutiveRecoveries += 1
        lastAutomaticRecovery = now
        beginEditorRecovery()
        return true
    }

    func retryEditorLoad() {
        lastAutomaticRecovery = nil
        consecutiveRecoveries = 0
        beginEditorRecovery()
        if let webView { reloadWebView(webView) }
    }

    private func beginEditorRecovery() {
        webContentReady = false
        isPreparingEditor = true
        editorLoadFailure = nil
        recoveryTimeout?.cancel()
        let id = UUID()
        recoveryID = id
        recoveryTimeout = Task { @MainActor [weak self] in
            do { try await Task.sleep(nanoseconds: 30_000_000_000) } catch { return }
            self?.editorRecoveryDidTimeOut(id: id)
        }
    }

    func editorRecoveryDidTimeOut(id: UUID? = nil) {
        guard let recoveryID, id == nil || id == recoveryID else { return }
        editorLoadDidFail()
    }

    func editorLoadDidFail() {
        guard isPreparingEditor, !webContentReady else { return }
        recoveryTimeout?.cancel()
        recoveryTimeout = nil
        recoveryID = nil
        editorLoadFailure = "編み図を読み込めませんでした。再試行してください。最後の保存後の変更は失われる場合があります。"
    }

    var loadingStyle: EditorLoadingStyle {
        hasShownEditor ? .inApp : .launch
    }

    func attach(_ webView: WKWebView) {
        if self.webView !== webView {
            webContentReady = false
            isPreparingEditor = true
        }
        self.webView = webView
        flushPendingDeliveriesIfReady()
    }

    func webContentDidBecomeReady() {
        consecutiveRecoveries = 0
        recoveryTimeout?.cancel()
        recoveryTimeout = nil
        recoveryID = nil
        editorLoadFailure = nil
        webContentReady = true
        // WebViewからの通知は表示の外で届くので、表示側の`.animation`では消える動きが付かない。
        // ここで動きを付けて、準備中の表示から編集画面へふわっとつなぐ（#117）。
        withAnimation(EditorLoadingStyle.dismissAnimation(reduceMotion: UIAccessibility.isReduceMotionEnabled)) {
            isPreparingEditor = false
        }
        hasShownEditor = true
        flushPendingDeliveriesIfReady()
    }

    /// 使い方ページなどへ遷移すると、バックアップとエラーのイベントを購読するReactは
    /// 一度破棄される。新しい文書が`webReady`を送るまで配送を保留する。
    func webContentDidStartNavigation(to url: URL?) {
        webContentReady = false
        isEditorDocument = Self.isEditorPage(url)
        isPreparingEditor = isEditorDocument
        if !isPreparingEditor {
            recoveryTimeout?.cancel()
            recoveryTimeout = nil
            recoveryID = nil
            editorLoadFailure = nil
        }
    }

    /// 同梱ページのうち、Reactの編集画面を読み込むものだけを判定する。
    nonisolated static func isEditorPage(_ url: URL?) -> Bool {
        guard let url, url.scheme == LocalWebSchemeHandler.scheme else { return false }
        let path = url.path
        return path.isEmpty || path == "/" || path == "/index.html"
    }

    @discardableResult
    func handleIncomingURL(_ url: URL) -> Task<Void, Never>? {
        guard url.pathExtension.lowercased() == "knit" else {
            presentError("対応していないファイル形式です")
            return nil
        }
        // iCloud Driveの原本は読む前にダウンロードされることがあるので、画面を止めないよう別のスレッドで読む。
        return Task { @MainActor in
            let result = await Task.detached { Result { try Self.readIncomingBackup(at: url) } }.value
            switch result {
            case .success(let data):
                deliverBackup(data, filename: url.lastPathComponent)
                Self.removeImportedCopy(at: url)
            case .failure(IncomingBackupError.tooLarge):
                presentError("バックアップが大きすぎます")
            case .failure:
                presentError("バックアップを読み込めませんでした")
            }
        }
    }

    enum IncomingBackupError: Error {
        case tooLarge
    }

    /// 受け取った`.knit`のバイト列を読む。「ファイル」アプリでタップしたときは、複製ではなく利用者の
    /// 原本のURLが届く（`LSSupportsOpeningDocumentsInPlace`、#149）。読む間だけアクセス権を得て、
    /// 他のアプリやiCloudの書き込みと重ならないよう`NSFileCoordinator`で調整して読む。原本には書き戻さない。
    nonisolated static func readIncomingBackup(at url: URL) throws -> Data {
        let accessing = url.startAccessingSecurityScopedResource()
        defer { if accessing { url.stopAccessingSecurityScopedResource() } }
        var coordinationError: NSError?
        var result: Result<Data, Error> = .failure(CocoaError(.fileReadUnknown))
        NSFileCoordinator().coordinate(readingItemAt: url, options: [.withoutChanges], error: &coordinationError) { readingURL in
            result = Result {
                let data = try Data(contentsOf: readingURL, options: [.mappedIfSafe])
                guard data.count <= NativeBridgeLimits.maxFileBytes else { throw IncomingBackupError.tooLarge }
                return data
            }
        }
        if let coordinationError { throw coordinationError }
        return try result.get()
    }

    /// WebViewが準備できていない間は保留し、`webReady`到着後に一度だけ配送する。
    func deliverBackup(_ data: Data, filename: String) {
        pendingDeliveries.removeAll {
            if case .backup = $0 { return true }
            return false
        }
        pendingDeliveries.append(.backup(data, filename))
        flushPendingDeliveriesIfReady()
    }

    func presentError(_ message: String) {
        pendingDeliveries.removeAll {
            if case .error = $0 { return true }
            return false
        }
        pendingDeliveries.append(.error(message))
        flushPendingDeliveriesIfReady()
    }

    /// 書き出しを保存・共有し終えたか、取りやめたかをWebへ返す（#122）。
    func reportExportFinished(
        requestID: String,
        saved: Bool,
        status: NativeExportResult.Status? = nil,
        notice: NativeExportResult.FailureNotice? = nil
    ) {
        guard let webView,
              let script = NativeExportResult.script(requestID: requestID, saved: saved, status: status, notice: notice) else { return }
        webView.evaluateJavaScript(script, completionHandler: nil)
    }

    func flushPendingSave() {
        guard webContentReady, let webView else { return }
        Task { @MainActor [weak webView] in
            guard let webView else { return }
            do {
                _ = try await webView.callAsyncJavaScript(
                    "return await window.knittingEditorFlushPendingSave?.() ?? true;",
                    arguments: [:],
                    in: nil,
                    contentWorld: .page
                )
            } catch {
                NSLog("バックグラウンド移行前の保存処理を開始できませんでした: %@", error.localizedDescription)
            }
        }
    }

    /// AirDropや他のアプリの共有から受け取った`.knit`は`Documents/Inbox`へ複製される。読み込み後に
    /// 消さないと端末内へ蓄積する。「ファイル」アプリから開いたときは原本のURLが届くので、複製だけを消す。
    nonisolated static func isImportedCopy(_ url: URL, documentsDirectory: URL) -> Bool {
        guard url.isFileURL else { return false }
        let inbox = documentsDirectory.appendingPathComponent("Inbox", isDirectory: true)
            .standardizedFileURL.resolvingSymlinksInPath()
        let candidate = url.standardizedFileURL.resolvingSymlinksInPath()
        return candidate.path.hasPrefix(inbox.path + "/")
    }

    nonisolated private static func removeImportedCopy(at url: URL) {
        guard let documents = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first,
              isImportedCopy(url, documentsDirectory: documents) else { return }
        try? FileManager.default.removeItem(at: url)
    }

    private func dispatchBackup(to webView: WKWebView, data: Data, filename: String) {
        let detail: [String: String] = [
            "filename": filename,
            "dataBase64": data.base64EncodedString(),
        ]
        guard let jsonData = try? JSONSerialization.data(withJSONObject: detail),
              let json = String(data: jsonData, encoding: .utf8) else {
            presentError("バックアップを渡せませんでした")
            return
        }
        evaluateScript(
            webView,
            "window.dispatchEvent(new CustomEvent('knittingEditorNativeBackupSelected',{detail:\(json)}));"
        )
    }

    private func dispatchError(to webView: WKWebView, message: String) {
        guard let jsonData = try? JSONSerialization.data(withJSONObject: message, options: [.fragmentsAllowed]),
              let json = String(data: jsonData, encoding: .utf8) else { return }
        evaluateScript(
            webView,
            "window.dispatchEvent(new CustomEvent('knittingEditorNativeError',{detail:\(json)}));"
        )
    }

    private func flushPendingDeliveriesIfReady() {
        // 配送中に`presentError`が呼ばれても入れ子で配送せず、保留の置き換えと発生順をこのループで守る。
        guard !isFlushingDeliveries, webContentReady, webView != nil, !pendingDeliveries.isEmpty else { return }
        isFlushingDeliveries = true
        defer { isFlushingDeliveries = false }
        while webContentReady, let webView, !pendingDeliveries.isEmpty {
            // 先に保留から外し、次の`webReady`で同じ通知を再送しない。
            switch pendingDeliveries.removeFirst() {
            case let .backup(data, filename):
                dispatchBackup(to: webView, data: data, filename: filename)
            case let .error(message):
                dispatchError(to: webView, message: message)
            }
        }
    }
}

