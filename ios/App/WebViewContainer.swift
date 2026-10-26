import Photos
import SwiftUI
import UIKit
import UniformTypeIdentifiers
@preconcurrency import WebKit

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
        // 「使い方」の末尾に表示するバージョンとビルド番号を、同梱ページへ渡す（#84）。
        configuration.userContentController.addUserScript(AppVersionInfo.current.userScript)
        #if DEBUG
        if let source = DebugEditorConfiguration.userScriptSource(environment: ProcessInfo.processInfo.environment) {
            configuration.userContentController.addUserScript(WKUserScript(
                source: source, injectionTime: .atDocumentStart, forMainFrameOnly: true
            ))
        }
        #endif

        // iOS 27ではゼロサイズのWKWebViewがWebKitプロセスの起動を待つことがある。
        // SwiftUIのレイアウト確定前にもローカルHTMLの読み込みを開始できるよう、
        // 実画面に近い初期サイズを与え、レイアウト確定後はSwiftUIにサイズを委ねる。
        let webView = FoldAwareWebView(
            frame: CGRect(origin: .zero, size: Self.initialFrameSize),
            configuration: configuration
        )
        // リンクを長押しすると、既定ではプレビューと「Open Link」などのメニューが出て、
        // 外部リンクのページをアプリ内で読み込もうとする。外部リンクはタップされたときだけ
        // `decidePolicyFor`からSafariへ渡す（#81）。
        webView.allowsLinkPreview = false
        webView.navigationDelegate = context.coordinator
        webView.allowsBackForwardNavigationGestures = false
        // 編集画面は`viewport-fit=cover`で端まで描き、セーフエリアの余白をCSSの`env(safe-area-inset-*)`で付ける
        // （#146）。スクロールビューの自動の余白も残すと、下の端の余白が二重になって操作メニューが浮く。
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        // 文書が描画されるまでの間に見える色。編集画面・使い方ページの地の色にそろえ、
        // 白や黒（ダークモードの`.systemBackground`）を挟まないようにする。
        webView.isOpaque = false
        webView.backgroundColor = AppColors.editorPageBackground
        webView.scrollView.backgroundColor = AppColors.editorPageBackground
        // Apple Pencilのダブルタップで描く⇔消すを切り替える（#269）。`UIPencilInteraction`は受け手を
        // 弱参照で持つので、受け手はCoordinatorが保持する。
        // `init(delegate:)`はiOS 17.5以降なので、作ってから受け手を設定する。
        let pencilInteraction = UIPencilInteraction()
        pencilInteraction.delegate = context.coordinator.pencilDoubleTap
        webView.addInteraction(pencilInteraction)
        context.coordinator.trackpadZoom.attach(to: webView)
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
    final class Coordinator: NSObject, WKNavigationDelegate, WKScriptMessageHandler, UIDocumentPickerDelegate,
        UIPopoverPresentationControllerDelegate {
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

        private var documentID = UUID()
        private let model: WebViewModel
        private weak var webView: WKWebView?
        private(set) var pendingExport: ExportSession?
        private let reviewRequestTracker: ReviewRequestTracker
        /// WebViewに付けた`UIPencilInteraction`の受け手。インタラクションは受け手を弱参照で持つ。
        let pencilDoubleTap: PencilDoubleTapHandler
        let trackpadZoom: TrackpadZoomHandler
        /// テストでは保存画面を出さずに用途を設定し、閉じたときの扱いを確かめる。
        var pickerPurpose: PickerPurpose?
        /// 書き出しの結果をWebへ返す。テストでは差し替えて、返した結果を確かめる。
        var reportExportResult: (
            _ requestID: String, _ saved: Bool, _ status: NativeExportResult.Status?, _ notice: NativeExportResult.FailureNotice?
        ) -> Void

        init(model: WebViewModel, reviewRequestTracker: ReviewRequestTracker? = nil) {
            self.model = model
            self.reviewRequestTracker = reviewRequestTracker ?? ReviewRequestTracker()
            pencilDoubleTap = PencilDoubleTapHandler(model: model)
            trackpadZoom = TrackpadZoomHandler(model: model)
            reportExportResult = { [weak model] requestID, saved, status, notice in
                model?.reportExportFinished(requestID: requestID, saved: saved, status: status, notice: notice)
            }
        }

        func attach(_ webView: WKWebView) {
            self.webView = webView
        }

        func detach() {
            // WebViewごと破棄されるので、結果を返す先が無い。
            pendingExport?.requestID = nil
            finishPendingExport(saved: false)
            pickerPurpose = nil
            model.isPresentingNativeUI = false
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
                (webView as? FoldAwareWebView)?.foldEditorDidBecomeReady()
            case let .success(.commandState(state)):
                model.editorCommandState = state
            case .success(.openBackup):
                let documentID = self.documentID
                DispatchQueue.main.async { [weak self] in
                    guard let self, self.documentID == documentID else { return }
                    self.presentBackupPicker()
                }
            case let .success(.exportFile(data, filename, mimeType, requestID)):
                let documentID = self.documentID
                DispatchQueue.main.async { [weak self] in
                    guard let self, self.documentID == documentID else { return }
                    self.presentExportOptions(data: data, filename: filename, mimeType: mimeType, requestID: requestID)
                }
            case let .failure(error):
                model.presentError(bridgeErrorMessage(error))
                // 検証できなかった書き出しも、Webが結果を待ち続けないよう取りやめとして返す。
                if let requestID = NativeBridgeMessage.exportRequestID(body: message.body) {
                    reportExportResult(requestID, false, nil, nil)
                }
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
            switch Self.navigationDecision(for: url, navigationType: navigationAction.navigationType) {
            case .load:
                decisionHandler(.allow)
            case let .openExternally(destination):
                UIApplication.shared.open(destination)
                decisionHandler(.cancel)
            case .cancel:
                decisionHandler(.cancel)
            }
        }

        enum NavigationDecision: Equatable {
            case load
            case openExternally(URL)
            case cancel
        }

        /// 同梱ページは読み込み、WebとメールのリンクはSafariとメールアプリで開く（#81）。
        /// 使い方の`app-settings:`のリンクは、押されたときだけ設定アプリのこのアプリのページを開く（#208）。
        nonisolated static func navigationDecision(for url: URL, navigationType: WKNavigationType) -> NavigationDecision {
            let scheme = url.scheme?.lowercased()
            if scheme == LocalWebSchemeHandler.scheme { return .load }
            if ["http", "https", "mailto"].contains(scheme) { return .openExternally(url) }
            if scheme == "app-settings", navigationType == .linkActivated,
               let settings = URL(string: UIApplication.openSettingsURLString) {
                return .openExternally(settings)
            }
            return .cancel
        }

        func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
            documentID = UUID()
            // 表示中の保存・共有画面と一時ファイルは閉じるまで維持し、結果の返却先だけを捨てる。
            pendingExport?.requestID = nil
            (webView as? FoldAwareWebView)?.foldPageDidStartNavigation()
            if model.webContentProcessDidTerminate() { model.reloadWebView(webView) }
        }

        func webView(_ webView: WKWebView, didCommit navigation: WKNavigation?) {
            documentID = UUID()
            model.webContentDidStartNavigation(to: webView.url)
            (webView as? FoldAwareWebView)?.foldPageDidStartNavigation()
            // 要求を送った文書はもう無い。新しい文書へ古いIDの結果を送らない。
            pendingExport?.requestID = nil
        }

        func webView(
            _ webView: WKWebView,
            didFail navigation: WKNavigation?,
            withError error: Error
        ) {
            model.editorLoadDidFail()
            NSLog("Local web content failed to load: %@", error.localizedDescription)
        }

        func webView(
            _ webView: WKWebView,
            didFailProvisionalNavigation navigation: WKNavigation?,
            withError error: Error
        ) {
            model.editorLoadDidFail()
            NSLog("Local web content failed to start: %@", error.localizedDescription)
        }

        func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
            let outcome = Self.pickerOutcome(purpose: pickerPurpose, urls: urls)
            pickerPurpose = nil
            model.isPresentingNativeUI = false
            switch outcome {
            case .finishExport:
                finishPendingExport(saved: true)
            case .ignore:
                break
            case let .importBackup(url):
                importBackup(from: url)
            }
        }

        func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
            pickerPurpose = nil
            model.isPresentingNativeUI = false
            finishPendingExport(saved: false)
        }

        /// 下へスワイプして閉じたときも、メニューの項目を選べる状態へ戻す。
        func presentationControllerDidDismiss(_ presentationController: UIPresentationController) {
            if presentationController.presentedViewController is UIActivityViewController {
                // 共有結果と一時ファイルの後処理はcompletionWithItemsHandlerだけで確定する。
                // ユーザーによるdismissalも、そのハンドラーから通知される。
                return
            }
            guard let picker = presentationController.presentedViewController as? UIDocumentPickerViewController else {
                model.isPresentingNativeUI = false
                return
            }
            documentPickerWasCancelled(picker)
        }

        func popoverPresentationController(
            _ popoverPresentationController: UIPopoverPresentationController,
            willRepositionPopoverTo rect: UnsafeMutablePointer<CGRect>,
            in view: AutoreleasingUnsafeMutablePointer<UIView>
        ) {
            // 回転・Split View・可変ウィンドウでは、表示時の矩形を使い回さない。
            rect.pointee = Self.shareAnchor(in: view.pointee.bounds)
        }

        private func importBackup(from url: URL) {
            defer { PickedBackupFile.removePickedCopy(at: url) }
            do {
                let data = try PickedBackupFile.read(at: url)
                guard data.count <= NativeBridgeLimits.maxFileBytes else {
                    model.presentError("バックアップが大きすぎます")
                    return
                }
                model.deliverBackup(data, filename: url.lastPathComponent)
            } catch {
                model.presentError("バックアップを読み込めませんでした")
            }
        }

        private func presentBackupPicker() {
            guard let presenter = presenter() else {
                model.presentError("ファイル選択画面を表示できませんでした")
                return
            }
            let picker = UIDocumentPickerViewController(forOpeningContentTypes: [.knittingEditorBackup], asCopy: true)
            picker.delegate = self
            pickerPurpose = .importBackup
            present(picker, from: presenter)
        }

        func presentExportOptions(data: Data, filename: String, mimeType: String, requestID: String?) {
            // 前の書き出しが残っていれば、保存されないまま置き換わるので取りやめとして返す。
            finishPendingExport(saved: false)
            guard let presenter = presenter() else {
                model.presentError("保存画面を表示できませんでした")
                if let requestID { reportExportResult(requestID, false, nil, nil) }
                return
            }
            guard preparePendingExport(data: data, filename: filename, mimeType: mimeType, requestID: requestID) else {
                model.presentError("出力ファイルを準備できませんでした")
                if let requestID { reportExportResult(requestID, false, nil, nil) }
                return
            }

            let alert = UIAlertController(title: "ファイルを保存", message: filename, preferredStyle: .alert)
            alert.addAction(UIAlertAction(title: "ファイルに保存", style: .default) { [weak self, weak presenter] _ in
                DispatchQueue.main.async { [weak self, weak presenter] in
                    guard let self else { return }
                    guard let presenter, let pendingExportURL = self.pendingExport?.url else {
                        self.model.isPresentingNativeUI = false
                        self.finishPendingExport(saved: false)
                        return
                    }
                    let picker = UIDocumentPickerViewController(forExporting: [pendingExportURL], asCopy: true)
                    picker.delegate = self
                    self.pickerPurpose = .exportFile
                    self.present(picker, from: presenter)
                }
            })
            alert.addAction(UIAlertAction(title: "共有", style: .default) { [weak self, weak presenter] _ in
                DispatchQueue.main.async { [weak self, weak presenter] in
                    guard let self else { return }
                    guard let presenter, let pendingExportURL = self.pendingExport?.url else {
                        self.model.isPresentingNativeUI = false
                        self.finishPendingExport(saved: false)
                        return
                    }
                    let activity = UIActivityViewController(activityItems: [pendingExportURL], applicationActivities: nil)
                    activity.completionWithItemsHandler = { [weak self] activityType, completed, _, error in
                        self?.finishSharing(completed: completed, error: error, activityType: activityType)
                    }
                    if let popover = activity.popoverPresentationController {
                        popover.delegate = self
                        let sourceView = (self.webView as UIView?) ?? presenter.view!
                        popover.sourceView = sourceView
                        popover.sourceRect = Self.shareAnchor(in: sourceView.bounds)
                    }
                    self.present(activity, from: presenter)
                }
            })
            alert.addAction(UIAlertAction(title: "キャンセル", style: .cancel) { [weak self] _ in
                self?.cancelExportOptions()
            })
            present(alert, from: presenter)
        }

        /// 書き出すデータを一時ファイルへ書き、保存画面・共有シートへ渡せるようにする。
        @discardableResult
        func preparePendingExport(data: Data, filename: String, mimeType: String, requestID: String?) -> Bool {
            do {
                pendingExport = try ExportSession(data: data, filename: filename, mimeType: mimeType, requestID: requestID)
            } catch {
                return false
            }
            return true
        }

        /// 確認アラートの「キャンセル」。
        func cancelExportOptions() {
            model.isPresentingNativeUI = false
            finishPendingExport(saved: false)
        }

        /// 共有シートを閉じたとき。共有を終えたら`completed`が真、取り消したら偽になる。
        func finishSharing(completed: Bool, error: Error? = nil, activityType: UIActivity.ActivityType? = nil) {
            model.isPresentingNativeUI = false
            guard let error else {
                finishPendingExport(saved: completed, status: completed ? .completed : .cancelled)
                return
            }
            finishPendingExport(
                saved: false,
                status: .error,
                failureNotice: Self.shareFailureNotice(activityType: activityType, error: error)
            )
        }

        nonisolated static let shareFailed = NativeExportResult.FailureNotice(message: "共有に失敗しました。もう一度共有を試してください。")
        /// 使い方ページの「写真への保存を許可する」の節（`ios/Web/public/guide/index.html`の`id`）を開くボタンを添える。
        nonisolated static let photosAddDenied = NativeExportResult.FailureNotice(
            message: "写真に保存できませんでした。設定アプリの「棒針編み図」→「写真」で追加を許可してから、もう一度お試しください。",
            guideSection: "allow-photos"
        )

        /// 共有に失敗したときの案内（#208）。写真への追加を拒否されると、iOSは権限画面を出し直さないため、
        /// 「画像を保存」の失敗だけは設定アプリでの許可を案内する。
        /// 拒否されたときの「画像を保存」は`ALAssetsLibraryErrorDomain`のエラーを返し、その元のエラーが`PHPhotosError.accessUserDenied`になる。
        nonisolated static func shareFailureNotice(activityType: UIActivity.ActivityType?, error: Error) -> NativeExportResult.FailureNotice {
            guard activityType == .saveToCameraRoll else { return shareFailed }
            var current: NSError? = error as NSError
            while let nsError = current {
                if nsError.domain == PHPhotosErrorDomain, nsError.code == PHPhotosError.Code.accessUserDenied.rawValue {
                    return photosAddDenied
                }
                current = nsError.userInfo[NSUnderlyingErrorKey] as? NSError
            }
            return shareFailed
        }

        /// 画面全体を基準にすると、iPadでポップオーバーの配置先が無くなる（#158）。
        nonisolated static func shareAnchor(in bounds: CGRect) -> CGRect {
            CGRect(x: bounds.midX, y: bounds.midY, width: 1, height: 1)
        }

        /// 保存画面などを出し、閉じるまでメニューの項目を選べなくする。
        /// 「ファイルに保存」「共有」を選ぶと、確認の画面から次の画面へ続けて移る。
        private func present(_ controller: UIViewController, from presenter: UIViewController) {
            model.isPresentingNativeUI = true
            if controller is UIDocumentPickerViewController {
                controller.presentationController?.delegate = self
            }
            presenter.present(controller, animated: true)
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

        /// 書き出しを終え、一時ファイルを消して結果をWebへ返す（#122）。
        /// 保存・共有を終えたときだけ`saved`を真にし、Webはそのときだけ最後のバックアップ日時を記録する。
        private func finishPendingExport(
            saved: Bool,
            status: NativeExportResult.Status? = nil,
            failureNotice: NativeExportResult.FailureNotice? = nil
        ) {
            guard let pendingExport else { return }
            self.pendingExport = nil
            pendingExport.finish(saved: saved, status: status, failureNotice: failureNotice, report: reportExportResult) { [model] notice in
                model.presentError((notice ?? Self.shareFailed).message)
            } didSave: { [self] mimeType in
                reviewRequestTracker.exportDidSucceed(mimeType: mimeType) { [weak self] in self?.webView?.window }
            }
        }

        nonisolated static func exportFileURL(in directory: URL, filename: String, mimeType: String) -> URL {
            ExportSession.exportFileURL(in: directory, filename: filename, mimeType: mimeType)
        }
    }
}
