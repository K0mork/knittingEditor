import XCTest
@preconcurrency import WebKit
@testable import knittingEditor

final class LocalWebSchemeHandlerTests: XCTestCase {
    @MainActor
    func testWebContentReadinessStartsFalseAndBecomesTrue() {
        let model = WebViewModel()

        XCTAssertFalse(model.webContentReady)
        XCTAssertTrue(model.isPreparingEditor)
        model.webContentDidBecomeReady()
        XCTAssertTrue(model.webContentReady)
        XCTAssertFalse(model.isPreparingEditor)
    }

    @MainActor
    func testNavigationSuspendsBridgeDeliveryUntilEditorReportsReadyAgain() {
        let model = WebViewModel()
        model.webContentDidBecomeReady()

        model.webContentDidStartNavigation(to: URL(string: "knitting-local://bundle/guide/index.html"))
        XCTAssertFalse(model.webContentReady, "使い方ページではバックアップイベントの購読者が存在しない")
        XCTAssertFalse(model.isPreparingEditor, "編集画面以外で読み込み表示を出したままにしない")

        model.webContentDidStartNavigation(to: LocalWebSchemeHandler.indexURL)
        XCTAssertFalse(model.webContentReady)
        XCTAssertTrue(model.isPreparingEditor)

        model.webContentDidBecomeReady()
        XCTAssertTrue(model.webContentReady)
        XCTAssertFalse(model.isPreparingEditor)
    }

    func testEditorPageDetectionAcceptsOnlyBundledIndex() {
        XCTAssertTrue(WebViewModel.isEditorPage(LocalWebSchemeHandler.indexURL))
        XCTAssertTrue(WebViewModel.isEditorPage(URL(string: "knitting-local://bundle/")))
        XCTAssertFalse(WebViewModel.isEditorPage(URL(string: "knitting-local://bundle/guide/")))
        XCTAssertFalse(WebViewModel.isEditorPage(URL(string: "https://knittingeditor.com/index.html")))
        XCTAssertFalse(WebViewModel.isEditorPage(nil))
    }

    func testExportFileKeepsTheDocumentNameForTheSaveSheet() {
        let directory = URL(fileURLWithPath: "/tmp/AAAA-BBBB", isDirectory: true)

        XCTAssertEqual(
            WebViewContainer.Coordinator.exportFileURL(in: directory, filename: "冬のセーター.knit", mimeType: "application/gzip").lastPathComponent,
            "冬のセーター.knit",
            "保存画面には編み図名のファイル名を提案する"
        )
        XCTAssertEqual(
            WebViewContainer.Coordinator.exportFileURL(in: directory, filename: "冬のセーター", mimeType: "image/png").lastPathComponent,
            "冬のセーター.png",
            "拡張子が無い場合はMIME種別から補う"
        )
        XCTAssertEqual(
            WebViewContainer.Coordinator.exportFileURL(in: directory, filename: "chart", mimeType: "application/octet-stream").pathExtension,
            "dat"
        )
    }

    func testExportPickerResultIsNotTreatedAsBackupImport() {
        let exported = URL(fileURLWithPath: "/private/var/mobile/Documents/chart.knit")

        XCTAssertEqual(
            WebViewContainer.Coordinator.pickerOutcome(purpose: .exportFile, urls: [exported]),
            .finishExport,
            "書き出し完了のURLを取り込むと、保存した編み図が複製されてしまう"
        )
        XCTAssertEqual(
            WebViewContainer.Coordinator.pickerOutcome(purpose: .importBackup, urls: [exported]),
            .importBackup(exported)
        )
        XCTAssertEqual(WebViewContainer.Coordinator.pickerOutcome(purpose: .importBackup, urls: []), .ignore)
        XCTAssertEqual(WebViewContainer.Coordinator.pickerOutcome(purpose: nil, urls: [exported]), .ignore)
    }

    func testOnlyInboxCopiesAreDeletedAfterImport() {
        let documents = URL(fileURLWithPath: "/private/var/mobile/Containers/Data/Application/App/Documents", isDirectory: true)

        XCTAssertTrue(
            WebViewModel.isImportedCopy(documents.appendingPathComponent("Inbox/chart.knit"), documentsDirectory: documents)
        )
        XCTAssertFalse(
            WebViewModel.isImportedCopy(documents.appendingPathComponent("chart.knit"), documentsDirectory: documents),
            "in-place編集を有効化しても利用者の原本を削除しない"
        )
        XCTAssertFalse(
            WebViewModel.isImportedCopy(URL(fileURLWithPath: "/private/var/mobile/InboxOther/chart.knit"), documentsDirectory: documents)
        )
        XCTAssertFalse(
            WebViewModel.isImportedCopy(URL(string: "knitting-local://bundle/chart.knit")!, documentsDirectory: documents)
        )
    }

    func testEditorWebViewStartsWithNonZeroFrame() {
        XCTAssertGreaterThan(WebViewContainer.initialFrameSize.width, 0)
        XCTAssertGreaterThan(WebViewContainer.initialFrameSize.height, 0)
    }

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

    func testResourceURLRefusesAssetsOutsideTheWebDirectory() {
        let bundle = Bundle(for: LocalWebSchemeHandler.self)
        for path in ["/Info.plist", "/PrivacyInfo.xcprivacy", "/knittingEditor"] {
            XCTAssertNil(
                LocalWebSchemeHandler.resourceURL(
                    for: URL(string: "knitting-local://bundle\(path)")!,
                    bundle: bundle
                ),
                "同梱Web資産の外側を配信しない: \(path)"
            )
        }
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
        defer { dispose(webView) }
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
        defer { dispose(webView) }
        try await loadIndex(in: webView)
        try await Task.sleep(nanoseconds: 500_000_000)

        let hasNoRequests = try await webView.evaluateJavaScript(
            "(window.__knittingEditorNetworkRequests ?? []).length === 0"
        )
        XCTAssertEqual(hasNoRequests as? Int, 1)
    }

    /// 機内モードで編集資産がオフライン動作することを確認する。
    ///
    /// 端末を機内モードにしてから、有線接続で次のように実行する。
    /// 無線ペアリングの端末は機内モードで到達できなくなるため、ケーブルが必要。
    ///
    ///     TEST_RUNNER_KNITTING_EDITOR_AIRPLANE_MODE=1 xcodebuild test ... \
    ///       -only-testing:knittingEditorTests/LocalWebSchemeHandlerTests/testAirplaneModeServesEditorWithoutNetwork
    @MainActor
    func testAirplaneModeServesEditorWithoutNetwork() async throws {
        try XCTSkipUnless(
            ProcessInfo.processInfo.environment["KNITTING_EDITOR_AIRPLANE_MODE"] == "1",
            "端末を機内モードにしたうえで、TEST_RUNNER_KNITTING_EDITOR_AIRPLANE_MODE=1を付けて実行する"
        )
        let webView = try makeWebView(networkProbe: true)
        defer { dispose(webView) }
        try await loadIndex(in: webView)
        try await Task.sleep(nanoseconds: 1_000_000_000)

        // 機内モードになっていない状態で成功したことにしない。
        let online = try await webView.evaluateJavaScript("navigator.onLine")
        XCTAssertEqual(
            (online as? NSNumber)?.boolValue,
            false,
            "端末が機内モードになっていない。navigator.onLineがtrueのままである"
        )

        // 同梱資産だけで編集画面が構築できている。
        let title = try await webView.evaluateJavaScript("document.title")
        XCTAssertEqual(title as? String, "棒針編み図エディタ")
        let hasCanvas = try await webView.evaluateJavaScript("document.querySelector('canvas.board-canvas') !== null")
        XCTAssertEqual((hasCanvas as? NSNumber)?.boolValue, true, "オフラインで盤面を描画できていない")

        // 実行中に通信APIを一切呼んでいない。
        let requests = try await webView.evaluateJavaScript(
            "JSON.stringify(window.__knittingEditorNetworkRequests ?? [])"
        )
        XCTAssertEqual(requests as? String, "[]", "機内モードで通信APIが呼ばれた")
    }

    @MainActor
    func testStableOriginAndWebsiteDataSurviveWebViewReplacement() async throws {
        let firstWebView = try makeWebView()
        defer { dispose(firstWebView) }
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
        defer { dispose(secondWebView) }
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
        // iOS 27 ではゼロサイズの WKWebView が WebKit プロセスを起動せず、
        // ナビゲーション完了通知が返らない場合がある。実画面に近い最小サイズを与える。
        return WKWebView(frame: CGRect(x: 0, y: 0, width: 320, height: 320), configuration: configuration)
    }

    @MainActor
    private func dispose(_ webView: WKWebView) {
        webView.stopLoading()
        webView.navigationDelegate = nil
        webView.uiDelegate = nil
        webView.configuration.userContentController.removeAllUserScripts()
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
