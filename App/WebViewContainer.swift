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
    private(set) var webContentReady = false

    func attach(_ webView: WKWebView) {
        if self.webView !== webView {
            webContentReady = false
        }
        self.webView = webView
        flushPendingBackupIfReady()
    }

    func webContentDidBecomeReady() {
        webContentReady = true
        flushPendingBackupIfReady()
    }

    func handleIncomingURL(_ url: URL) {
        guard url.pathExtension.lowercased() == "knit" else {
            dispatchError("対応していないファイル形式です")
            return
        }
        do {
            let data = try Data(contentsOf: url, options: [.mappedIfSafe])
            guard data.count <= NativeBridgeLimits.maxFileBytes else {
                dispatchError("バックアップが大きすぎます")
                return
            }
            guard webView != nil, webContentReady else {
                pendingBackup = (data: data, filename: url.lastPathComponent)
                return
            }
            dispatchBackup(data, filename: url.lastPathComponent)
        } catch {
            dispatchError("バックアップを読み込めませんでした")
        }
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

    private func dispatchBackup(_ data: Data, filename: String) {
        guard let webView else { return }
        let detail: [String: String] = [
            "filename": filename,
            "dataBase64": data.base64EncodedString(),
        ]
        guard let jsonData = try? JSONSerialization.data(withJSONObject: detail),
              let json = String(data: jsonData, encoding: .utf8) else {
            dispatchError("バックアップを渡せませんでした")
            return
        }
        evaluateOnWebView(
            webView,
            script: "window.dispatchEvent(new CustomEvent('knittingEditorNativeBackupSelected',{detail:\(json)}));"
        )
    }

    private func flushPendingBackupIfReady() {
        guard webContentReady, let pendingBackup else { return }
        self.pendingBackup = nil
        dispatchBackup(pendingBackup.data, filename: pendingBackup.filename)
    }

    private func dispatchError(_ message: String) {
        guard let webView,
              let jsonData = try? JSONSerialization.data(withJSONObject: message),
              let json = String(data: jsonData, encoding: .utf8) else { return }
        evaluateOnWebView(
            webView,
            script: "window.dispatchEvent(new CustomEvent('knittingEditorNativeError',{detail:\(json)}));"
        )
    }

    private func evaluateOnWebView(_ webView: WKWebView, script: String) {
        webView.evaluateJavaScript(script, completionHandler: nil)
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
        private let model: WebViewModel
        private weak var webView: WKWebView?
        private var pendingExportURL: URL?

        init(model: WebViewModel) {
            self.model = model
        }

        func attach(_ webView: WKWebView) {
            self.webView = webView
        }

        func detach() {
            if let pendingExportURL {
                try? FileManager.default.removeItem(at: pendingExportURL)
            }
            pendingExportURL = nil
            webView = nil
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
                dispatchError(message: bridgeErrorMessage(error))
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
            guard let url = urls.first else { return }
            do {
                let data = try Data(contentsOf: url, options: [.mappedIfSafe])
                guard data.count <= NativeBridgeLimits.maxFileBytes else {
                    dispatchError(message: "バックアップが大きすぎます")
                    return
                }
                dispatchBackup(data, filename: url.lastPathComponent)
            } catch {
                dispatchError(message: "バックアップを読み込めませんでした")
            }
        }

        func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
            cleanupPendingExport()
        }

        private func presentBackupPicker() {
            guard let presenter = presenter() else {
                dispatchError(message: "ファイル選択画面を表示できませんでした")
                return
            }
            let picker = UIDocumentPickerViewController(forOpeningContentTypes: [.knittingEditorBackup], asCopy: true)
            picker.delegate = self
            presenter.present(picker, animated: true)
        }

        private func presentExportOptions(data: Data, filename: String, mimeType: String) {
            cleanupPendingExport()
            guard let presenter = presenter() else {
                dispatchError(message: "保存画面を表示できませんでした")
                return
            }
            let filenameExtension = URL(fileURLWithPath: filename).pathExtension
            let fallbackExtension = UTType(mimeType: mimeType)?.preferredFilenameExtension
            let temporaryURL = FileManager.default.temporaryDirectory
                .appendingPathComponent(UUID().uuidString)
                .appendingPathExtension(filenameExtension.isEmpty ? (fallbackExtension ?? "dat") : filenameExtension)
            do {
                try data.write(to: temporaryURL, options: [.atomic])
            } catch {
                dispatchError(message: "出力ファイルを準備できませんでした")
                return
            }
            pendingExportURL = temporaryURL

            let alertStyle: UIAlertController.Style = UIDevice.current.userInterfaceIdiom == .pad ? .alert : .actionSheet
            let alert = UIAlertController(title: "ファイルを保存", message: filename, preferredStyle: alertStyle)
            alert.addAction(UIAlertAction(title: "ファイルに保存", style: .default) { [weak self, weak presenter] _ in
                DispatchQueue.main.async { [weak self, weak presenter] in
                    guard let self, let presenter, let pendingExportURL = self.pendingExportURL else { return }
                    let picker = UIDocumentPickerViewController(forExporting: [pendingExportURL], asCopy: true)
                    picker.delegate = self
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

        private func dispatchBackup(_ data: Data, filename: String) {
            guard let webView,
                  let jsonData = try? JSONSerialization.data(withJSONObject: [
                    "filename": filename,
                    "dataBase64": data.base64EncodedString(),
                  ]),
                  let json = String(data: jsonData, encoding: .utf8) else { return }
            webView.evaluateJavaScript(
                "window.dispatchEvent(new CustomEvent('knittingEditorNativeBackupSelected',{detail:\(json)}));",
                completionHandler: nil
            )
        }

        private func dispatchError(message: String) {
            guard let webView,
                  let jsonData = try? JSONSerialization.data(withJSONObject: message),
                  let json = String(data: jsonData, encoding: .utf8) else { return }
            webView.evaluateJavaScript(
                "window.dispatchEvent(new CustomEvent('knittingEditorNativeError',{detail:\(json)}));",
                completionHandler: nil
            )
        }

        private func bridgeErrorMessage(_ error: NativeBridgeMessage.MessageError) -> String {
            switch error {
            case .fileTooLarge: return "出力ファイルが大きすぎます"
            case .invalidFile: return "出力ファイルを検証できませんでした"
            default: return "アプリ連携メッセージを処理できませんでした"
            }
        }

        private func cleanupPendingExport() {
            if let pendingExportURL {
                try? FileManager.default.removeItem(at: pendingExportURL)
            }
            pendingExportURL = nil
        }
    }
}
