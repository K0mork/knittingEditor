import XCTest
@preconcurrency import WebKit
@testable import knittingEditor

final class LocalWebSchemeHandlerTests: XCTestCase {
    func testIndexURLUsesStableLocalOrigin() {
        XCTAssertEqual(LocalWebSchemeHandler.indexURL.absoluteString, "knitting-local://bundle/index.html")
        XCTAssertEqual(LocalWebSchemeHandler.indexURL.scheme, LocalWebSchemeHandler.scheme)
    }

    func testResourceURLRejectsUnexpectedOriginAndTraversal() {
        let bundle = Bundle(for: LocalWebSchemeHandler.self)
        XCTAssertNil(
            LocalWebSchemeHandler.resourceURL(
                for: URL(string: "https://bundle/index.html")!,
                bundle: bundle
            )
        )
        XCTAssertNil(
            LocalWebSchemeHandler.resourceURL(
                for: URL(string: "knitting-local://bundle/../Info.plist")!,
                bundle: bundle
            )
        )
    }

    func testResourceURLFindsBundledWebAsset() {
        let bundle = Bundle(for: LocalWebSchemeHandler.self)
        XCTAssertNotNil(
            LocalWebSchemeHandler.resourceURL(
                for: URL(string: "knitting-local://bundle/index.html")!,
                bundle: bundle
            )
        )
    }

    func testResourceURLResolvesDirectoryIndexes() {
        let bundle = Bundle(for: LocalWebSchemeHandler.self)
        let root = LocalWebSchemeHandler.resourceURL(
            for: URL(string: "knitting-local://bundle/")!,
            bundle: bundle
        )
        let guide = LocalWebSchemeHandler.resourceURL(
            for: URL(string: "knitting-local://bundle/guide/")!,
            bundle: bundle
        )
        XCTAssertEqual(root?.lastPathComponent, "index.html")
        XCTAssertEqual(guide?.lastPathComponent, "index.html")
        XCTAssertEqual(guide?.deletingLastPathComponent().lastPathComponent, "guide")
    }

    @MainActor
    func testGuideDirectoryURLLoadsBundledIndex() async throws {
        let webView = try makeWebView()
        let delegate = NavigationDelegate()
        webView.navigationDelegate = delegate
        webView.load(URLRequest(url: URL(string: "knitting-local://bundle/guide/")!))
        try await delegate.waitForLoad()

        let title = try await webView.evaluateJavaScript("document.title")
        XCTAssertEqual(title as? String, "棒針編み図エディタの使い方")
    }

    @MainActor
    func testLocalEditorDoesNotInvokeRuntimeNetworkAPIs() async throws {
        let webView = try makeWebView(networkProbe: true)
        try await loadIndex(in: webView)
        try await Task.sleep(nanoseconds: 500_000_000)

        let hasNoRequests = try await webView.evaluateJavaScript(
            "(window.__knittingEditorNetworkRequests ?? []).length === 0"
        )
        XCTAssertEqual(hasNoRequests as? Int, 1)
    }

    @MainActor
    func testStableOriginAndWebsiteDataSurviveWebViewReplacement() async throws {
        let firstWebView = try makeWebView()
        try await loadIndex(in: firstWebView)
        let stored = try await firstWebView.callAsyncJavaScript(
            """
            const request = indexedDB.open('knitting-editor-update-probe-v1', 1);
            request.onupgradeneeded = () => request.result.createObjectStore('probe', { keyPath: 'id' });
            const database = await new Promise((resolve, reject) => {
              request.onsuccess = () => resolve(request.result);
              request.onerror = () => reject(request.error ?? new Error('open failed'));
            });
            await new Promise((resolve, reject) => {
              const transaction = database.transaction('probe', 'readwrite');
              transaction.objectStore('probe').put({ id: 'release-1', value: 'persisted' });
              transaction.oncomplete = resolve;
              transaction.onerror = () => reject(transaction.error ?? new Error('write failed'));
            });
            database.close();
            return true;
            """,
            arguments: [:],
            in: nil,
            contentWorld: .page
        )
        XCTAssertEqual(stored as? Bool, true)

        firstWebView.stopLoading()
        firstWebView.navigationDelegate = nil
        let secondWebView = try makeWebView()
        try await loadIndex(in: secondWebView)
        let restored = try await secondWebView.callAsyncJavaScript(
            """
            const request = indexedDB.open('knitting-editor-update-probe-v1', 1);
            const database = await new Promise((resolve, reject) => {
              request.onsuccess = () => resolve(request.result);
              request.onerror = () => reject(request.error ?? new Error('open failed'));
            });
            const value = await new Promise((resolve, reject) => {
              const transaction = database.transaction('probe', 'readonly');
              const get = transaction.objectStore('probe').get('release-1');
              get.onsuccess = () => resolve(get.result?.value ?? null);
              get.onerror = () => reject(get.error ?? new Error('read failed'));
            });
            database.close();
            return value;
            """,
            arguments: [:],
            in: nil,
            contentWorld: .page
        )
        XCTAssertEqual(restored as? String, "persisted")
    }

    @MainActor
    private func makeWebView(networkProbe: Bool = false) throws -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        if networkProbe {
            let probe = """
            (() => {
              const requests = [];
              window.__knittingEditorNetworkRequests = requests;
              const record = (value) => requests.push(String(value ?? ''));
              const originalFetch = window.fetch;
              window.fetch = function(input) {
                record(typeof input === 'string' ? input : input?.url);
                return originalFetch.apply(this, arguments);
              };
              const originalOpen = XMLHttpRequest.prototype.open;
              XMLHttpRequest.prototype.open = function(method, url) {
                record(url);
                return originalOpen.apply(this, arguments);
              };
              const OriginalWebSocket = window.WebSocket;
              window.WebSocket = function(url) {
                record(url);
                return new OriginalWebSocket(...arguments);
              };
              const OriginalEventSource = window.EventSource;
              window.EventSource = function(url) {
                record(url);
                return new OriginalEventSource(...arguments);
              };
            })();
            """
            configuration.userContentController.addUserScript(
                WKUserScript(source: probe, injectionTime: .atDocumentStart, forMainFrameOnly: false)
            )
        }
        configuration.setURLSchemeHandler(
            LocalWebSchemeHandler(bundle: Bundle(for: LocalWebSchemeHandler.self)),
            forURLScheme: LocalWebSchemeHandler.scheme
        )
        return WKWebView(frame: .zero, configuration: configuration)
    }

    @MainActor
    private func loadIndex(in webView: WKWebView) async throws {
        let delegate = NavigationDelegate()
        webView.navigationDelegate = delegate
        webView.load(URLRequest(url: LocalWebSchemeHandler.indexURL))
        try await delegate.waitForLoad()
    }
}

@MainActor
private final class NavigationDelegate: NSObject, WKNavigationDelegate {
    private var continuation: CheckedContinuation<Void, Error>?

    func waitForLoad() async throws {
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            self.continuation = continuation
        }
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        continuation?.resume()
        continuation = nil
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        continuation?.resume(throwing: error)
        continuation = nil
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        continuation?.resume(throwing: error)
        continuation = nil
    }
}
