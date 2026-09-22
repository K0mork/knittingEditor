import Observation
import SwiftUI
import UIKit
import UniformTypeIdentifiers
@preconcurrency import WebKit

@MainActor
@Observable
final class WebViewModel {
    @ObservationIgnored weak var webView: WKWebView?
    private var pendingBackup: (data: Data, filename: String)?
    /// バックアップイベントを購読するReactが動作中かどうか。
    private(set) var webContentReady = false
    /// 編集画面の読み込み待ちを利用者へ伝えるかどうか。使い方ページのように
    /// `webReady`を送らない同梱ページでは表示しない。
    private(set) var isPreparingEditor = true

    func attach(_ webView: WKWebView) {
        if self.webView !== webView {
            webContentReady = false
            isPreparingEditor = true
        }
        self.webView = webView
        flushPendingBackupIfReady()
    }

    func webContentDidBecomeReady() {
        webContentReady = true
        isPreparingEditor = false
        flushPendingBackupIfReady()
    }

    /// 使い方ページなどへ遷移すると、バックアップイベントを購読するReactは
    /// 一度破棄される。新しい文書が`webReady`を送るまで配送を保留する。
    func webContentDidStartNavigation(to url: URL?) {
        webContentReady = false
        isPreparingEditor = Self.isEditorPage(url)
    }

    /// 同梱ページのうち、Reactの編集画面を読み込むものだけを判定する。
    nonisolated static func isEditorPage(_ url: URL?) -> Bool {
        guard let url, url.scheme == LocalWebSchemeHandler.scheme else { return false }
        let path = url.path
        return path.isEmpty || path == "/" || path == "/index.html"
    }

    func handleIncomingURL(_ url: URL) {
        guard url.pathExtension.lowercased() == "knit" else {
            presentError("対応していないファイル形式です")
            return
        }
        do {
            let data = try Data(contentsOf: url, options: [.mappedIfSafe])
            guard data.count <= NativeBridgeLimits.maxFileBytes else {
                presentError("バックアップが大きすぎます")
                return
            }
            deliverBackup(data, filename: url.lastPathComponent)
            Self.removeImportedCopy(at: url)
        } catch {
            presentError("バックアップを読み込めませんでした")
        }
    }

    /// WebViewが準備できていない間は保留し、`webReady`到着後に一度だけ配送する。
    func deliverBackup(_ data: Data, filename: String) {
        guard let webView, webContentReady else {
            pendingBackup = (data: data, filename: filename)
            return
        }
        dispatchBackup(to: webView, data: data, filename: filename)
    }

    func presentError(_ message: String) {
        guard let webView else {
            NSLog("Web側へ通知できないネイティブエラー: %@", message)
            return
        }
        guard let jsonData = try? JSONSerialization.data(withJSONObject: message, options: [.fragmentsAllowed]),
              let json = String(data: jsonData, encoding: .utf8) else { return }
        webView.evaluateJavaScript(
            "window.dispatchEvent(new CustomEvent('knittingEditorNativeError',{detail:\(json)}));",
            completionHandler: nil
        )
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

    /// `LSSupportsOpeningDocumentsInPlace`が無効なため、Files・AirDrop・他アプリからの
    /// `.knit`は`Documents/Inbox`へ複製される。読み込み後に消さないと端末内へ蓄積する。
    /// 将来in-place編集を有効化しても利用者の原本を消さないよう、複製だけを対象にする。
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
        webView.evaluateJavaScript(
            "window.dispatchEvent(new CustomEvent('knittingEditorNativeBackupSelected',{detail:\(json)}));",
            completionHandler: nil
        )
    }

    private func flushPendingBackupIfReady() {
        guard webContentReady, let webView, let pendingBackup else { return }
        self.pendingBackup = nil
        dispatchBackup(to: webView, data: pendingBackup.data, filename: pendingBackup.filename)
    }
}

struct WebViewContainer: UIViewRepresentable {
    static let initialFrameSize = CGSize(width: 320, height: 320)
    let model: WebViewModel

    func makeCoordinator() -> Coordinator {
        Coordinator(model: model)
    }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        configuration.userContentController.add(context.coordinator, name: Coordinator.messageHandlerName)
        configuration.setURLSchemeHandler(
            LocalWebSchemeHandler(bundle: .main),
            forURLScheme: LocalWebSchemeHandler.scheme
        )

        // iOS 27ではゼロサイズのWKWebViewがWebKitプロセスの起動を待つことがある。
        // SwiftUIのレイアウト確定前にもローカルHTMLの読み込みを開始できるよう、
        // 実画面に近い初期サイズを与え、レイアウト確定後はSwiftUIにサイズを委ねる。
        let webView = WKWebView(
            frame: CGRect(origin: .zero, size: Self.initialFrameSize),
            configuration: configuration
        )
        webView.navigationDelegate = context.coordinator
        webView.allowsBackForwardNavigationGestures = false
        webView.isOpaque = false
        webView.backgroundColor = .systemBackground
        model.attach(webView)
        context.coordinator.attach(webView)
        webView.load(URLRequest(url: LocalWebSchemeHandler.indexURL))
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        model.attach(webView)
    }

    static func dismantleUIView(_ webView: WKWebView, coordinator: Coordinator) {
        webView.stopLoading()
        webView.navigationDelegate = nil
        webView.configuration.userContentController.removeScriptMessageHandler(forName: Coordinator.messageHandlerName)
        coordinator.detach()
    }

    @MainActor
    final class Coordinator: NSObject, WKNavigationDelegate, WKScriptMessageHandler, UIDocumentPickerDelegate {
        static let messageHandlerName = "knittingEditor"

        /// `UIDocumentPickerViewController`は取り込みと書き出しの両方で
        /// `documentPicker(_:didPickDocumentsAt:)`を呼ぶ。書き出し完了で受け取ったURLを
        /// 取り込みとして扱うと、保存した`.knit`がそのまま再インポートされてしまう。
        enum PickerPurpose: Equatable {
            case importBackup
            case exportFile
        }

        enum PickerOutcome: Equatable {
            case importBackup(URL)
            case finishExport
            case ignore
        }

        private let model: WebViewModel
        private weak var webView: WKWebView?
        private var pendingExportURL: URL?
        private var pendingExportDirectory: URL?
        private var pickerPurpose: PickerPurpose?

        init(model: WebViewModel) {
            self.model = model
        }

        func attach(_ webView: WKWebView) {
            self.webView = webView
        }

        func detach() {
            cleanupPendingExport()
            pickerPurpose = nil
            webView = nil
        }

        nonisolated static func pickerOutcome(purpose: PickerPurpose?, urls: [URL]) -> PickerOutcome {
            switch purpose {
            case .exportFile: return .finishExport
            case .importBackup: return urls.first.map(PickerOutcome.importBackup) ?? .ignore
            case nil: return .ignore
            }
        }

        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            guard message.name == Self.messageHandlerName else { return }
            switch NativeBridgeMessage.decode(body: message.body) {
            case .success(.webReady):
                model.webContentDidBecomeReady()
            case .success(.openBackup):
                DispatchQueue.main.async { [weak self] in
                    self?.presentBackupPicker()
                }
            case let .success(.exportFile(data, filename, mimeType)):
                DispatchQueue.main.async { [weak self] in
                    self?.presentExportOptions(data: data, filename: filename, mimeType: mimeType)
                }
            case let .failure(error):
                model.presentError(bridgeErrorMessage(error))
            }
        }

        func webView(
            _ webView: WKWebView,
            decidePolicyFor navigationAction: WKNavigationAction,
            decisionHandler: @escaping @MainActor @Sendable (WKNavigationActionPolicy) -> Void
        ) {
            if navigationAction.targetFrame?.isMainFrame == false {
                decisionHandler(.cancel)
                return
            }
            guard let url = navigationAction.request.url else {
                decisionHandler(.cancel)
                return
            }
            if url.scheme == LocalWebSchemeHandler.scheme {
                decisionHandler(.allow)
            } else if ["http", "https", "mailto"].contains(url.scheme?.lowercased()) {
                UIApplication.shared.open(url)
                decisionHandler(.cancel)
            } else {
                decisionHandler(.cancel)
            }
        }

        func webView(_ webView: WKWebView, didCommit navigation: WKNavigation?) {
            model.webContentDidStartNavigation(to: webView.url)
        }

        func webView(
            _ webView: WKWebView,
            didFail navigation: WKNavigation?,
            withError error: Error
        ) {
            NSLog("Local web content failed to load: %@", error.localizedDescription)
        }

        func webView(
            _ webView: WKWebView,
            didFailProvisionalNavigation navigation: WKNavigation?,
            withError error: Error
        ) {
            NSLog("Local web content failed to start: %@", error.localizedDescription)
        }

        func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
            let outcome = Self.pickerOutcome(purpose: pickerPurpose, urls: urls)
            pickerPurpose = nil
            switch outcome {
            case .finishExport:
                cleanupPendingExport()
            case .ignore:
                break
            case let .importBackup(url):
                importBackup(from: url)
            }
        }

        func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
            pickerPurpose = nil
            cleanupPendingExport()
        }

        private func importBackup(from url: URL) {
            defer { Self.removePickedCopy(at: url) }
            do {
                let data = try Data(contentsOf: url, options: [.mappedIfSafe])
                guard data.count <= NativeBridgeLimits.maxFileBytes else {
                    model.presentError("バックアップが大きすぎます")
                    return
                }
                model.deliverBackup(data, filename: url.lastPathComponent)
            } catch {
                model.presentError("バックアップを読み込めませんでした")
            }
        }

        /// `asCopy: true`のDocument Pickerはアプリの一時領域へ複製を作る。
        /// 読み込み後に消さないと一時領域へ蓄積するため、一時領域内だけを削除する。
        nonisolated private static func removePickedCopy(at url: URL) {
            let temporary = FileManager.default.temporaryDirectory.standardizedFileURL.resolvingSymlinksInPath()
            let candidate = url.standardizedFileURL.resolvingSymlinksInPath()
            guard candidate.path.hasPrefix(temporary.path + "/") else { return }
            try? FileManager.default.removeItem(at: url)
        }

        private func presentBackupPicker() {
            guard let presenter = presenter() else {
                model.presentError("ファイル選択画面を表示できませんでした")
                return
            }
            let picker = UIDocumentPickerViewController(forOpeningContentTypes: [.knittingEditorBackup], asCopy: true)
            picker.delegate = self
            pickerPurpose = .importBackup
            presenter.present(picker, animated: true)
        }

        private func presentExportOptions(data: Data, filename: String, mimeType: String) {
            cleanupPendingExport()
            guard let presenter = presenter() else {
                model.presentError("保存画面を表示できませんでした")
                return
            }
            // 保存画面には一時ファイルの名前がそのまま出る。UUIDを名前にすると
            // 利用者に意味のない名前を提案してしまうため、編み図名のファイル名を
            // 一意なディレクトリの中へ置く。
            let directory = FileManager.default.temporaryDirectory
                .appendingPathComponent(UUID().uuidString, isDirectory: true)
            let temporaryURL = Self.exportFileURL(in: directory, filename: filename, mimeType: mimeType)
            do {
                try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
                try data.write(to: temporaryURL, options: [.atomic])
            } catch {
                try? FileManager.default.removeItem(at: directory)
                model.presentError("出力ファイルを準備できませんでした")
                return
            }
            pendingExportURL = temporaryURL
            pendingExportDirectory = directory

            let alert = UIAlertController(title: "ファイルを保存", message: filename, preferredStyle: .alert)
            alert.addAction(UIAlertAction(title: "ファイルに保存", style: .default) { [weak self, weak presenter] _ in
                DispatchQueue.main.async { [weak self, weak presenter] in
                    guard let self, let presenter, let pendingExportURL = self.pendingExportURL else { return }
                    let picker = UIDocumentPickerViewController(forExporting: [pendingExportURL], asCopy: true)
                    picker.delegate = self
                    self.pickerPurpose = .exportFile
                    presenter.present(picker, animated: true)
                }
            })
            alert.addAction(UIAlertAction(title: "共有", style: .default) { [weak self, weak presenter] _ in
                DispatchQueue.main.async { [weak self, weak presenter] in
                    guard let self, let presenter, let pendingExportURL = self.pendingExportURL else { return }
                    let activity = UIActivityViewController(activityItems: [pendingExportURL], applicationActivities: nil)
                    activity.completionWithItemsHandler = { [weak self] _, _, _, _ in self?.cleanupPendingExport() }
                    if let popover = activity.popoverPresentationController {
                        popover.sourceView = self.webView
                        popover.sourceRect = self.webView?.bounds ?? .zero
                    }
                    presenter.present(activity, animated: true)
                }
            })
            alert.addAction(UIAlertAction(title: "キャンセル", style: .cancel) { [weak self] _ in self?.cleanupPendingExport() })
            if let popover = alert.popoverPresentationController {
                popover.sourceView = webView
                popover.sourceRect = webView?.bounds ?? .zero
            }
            presenter.present(alert, animated: true)
        }

        private func presenter() -> UIViewController? {
            var current = webView?.window?.rootViewController
            while let presented = current?.presentedViewController { current = presented }
            return current
        }

        private func bridgeErrorMessage(_ error: NativeBridgeMessage.MessageError) -> String {
            switch error {
            case .fileTooLarge: return "出力ファイルが大きすぎます"
            case .invalidFile: return "出力ファイルを検証できませんでした"
            default: return "アプリ連携メッセージを処理できませんでした"
            }
        }

        private func cleanupPendingExport() {
            if let pendingExportDirectory {
                try? FileManager.default.removeItem(at: pendingExportDirectory)
            } else if let pendingExportURL {
                try? FileManager.default.removeItem(at: pendingExportURL)
            }
            pendingExportURL = nil
            pendingExportDirectory = nil
        }

        /// 保存画面へ提案するファイル名を組み立てる。
        ///
        /// `filename`は`NativeBridgeMessage`が区切り文字と制御文字を拒否済みなので、
        /// そのままパス要素として使える。拡張子が無い場合だけMIME種別から補う。
        nonisolated static func exportFileURL(in directory: URL, filename: String, mimeType: String) -> URL {
            let url = directory.appendingPathComponent(filename)
            guard url.pathExtension.isEmpty else { return url }
            let fallback = UTType(mimeType: mimeType)?.preferredFilenameExtension ?? "dat"
            return url.appendingPathExtension(fallback)
        }
    }
}
