import Observation
import SwiftUI
import WebKit

@MainActor
@Observable
final class WebViewModel {
    @ObservationIgnored weak var webView: WKWebView?

    func attach(_ webView: WKWebView) {
        self.webView = webView
    }

    func flushPendingSave() {
        webView?.evaluateJavaScript(
            "window.dispatchEvent(new Event('knittingEditorAppWillResignActive'))",
            completionHandler: nil
        )
    }
}

struct WebViewContainer: UIViewRepresentable {
    let model: WebViewModel

    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        configuration.setURLSchemeHandler(
            LocalWebSchemeHandler(bundle: .main),
            forURLScheme: LocalWebSchemeHandler.scheme
        )

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.allowsBackForwardNavigationGestures = false
        webView.isOpaque = false
        webView.backgroundColor = .systemBackground
        model.attach(webView)
        webView.load(URLRequest(url: LocalWebSchemeHandler.indexURL))
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        model.attach(webView)
    }

    static func dismantleUIView(_ webView: WKWebView, coordinator: Coordinator) {
        webView.stopLoading()
        webView.navigationDelegate = nil
    }

    @MainActor
    final class Coordinator: NSObject, WKNavigationDelegate {
        func webView(
            _ webView: WKWebView,
            decidePolicyFor navigationAction: WKNavigationAction,
            decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
        ) {
            guard let url = navigationAction.request.url,
                  url.scheme == LocalWebSchemeHandler.scheme else {
                decisionHandler(.cancel)
                return
            }
            decisionHandler(.allow)
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
    }
}
