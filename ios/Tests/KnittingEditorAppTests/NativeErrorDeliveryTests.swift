import Observation
import UIKit
import UniformTypeIdentifiers
import XCTest
@preconcurrency import WebKit
@testable import knittingEditor

/// 読めないバックアップの通知を、編集画面が購読を始めるまで保留する。
final class NativeErrorDeliveryTests: XCTestCase {
    @MainActor
    private final class Harness {
        let model = WebViewModel()
        let webView = WKWebView(frame: .zero)
        var scripts: [String] = []

        init() {
            model.evaluateScript = { [unowned self] webView, script in
                XCTAssertTrue(webView === self.webView, "モデルに接続したWebViewへ送る")
                self.scripts.append(script)
            }
        }

        func attach(ready: Bool = false) {
            model.attach(webView)
            if ready { model.webContentDidBecomeReady() }
        }

        func assertErrors(_ messages: [String], file: StaticString = #filePath, line: UInt = #line) throws {
            XCTAssertEqual(scripts.count, messages.count, "エラーを各1回だけ送る", file: file, line: line)
            for (script, message) in zip(scripts, messages) {
                let data = try JSONSerialization.data(withJSONObject: message, options: [.fragmentsAllowed])
                let json = try XCTUnwrap(String(data: data, encoding: .utf8), file: file, line: line)
                XCTAssertTrue(script.contains("knittingEditorNativeError"), "ネイティブエラーのイベントを送る", file: file, line: line)
                XCTAssertTrue(script.contains("detail:\(json)"), "メッセージをJSONとして渡す", file: file, line: line)
            }
        }

        func assertNoRedeliveryAfterGuide(file: StaticString = #filePath, line: UInt = #line) {
            let delivered = scripts
            model.webContentDidStartNavigation(to: URL(string: "knitting-local://bundle/guide/"))
            model.webContentDidStartNavigation(to: LocalWebSchemeHandler.indexURL)
            model.webContentDidBecomeReady()
            XCTAssertEqual(scripts, delivered, "使い方ページから戻っても配送済みの通知を再送しない", file: file, line: line)
        }
    }

    private func missingBackupURL() -> URL {
        FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString, isDirectory: true)
            .appendingPathComponent("missing.knit")
    }

    @MainActor
    func testMissingIncomingBackupThrows() {
        XCTAssertThrowsError(try WebViewModel.readIncomingBackup(at: missingBackupURL()), "存在しないファイルを読み込めた扱いにしない")
    }

    @MainActor
    func testDeletedIncomingBackupThrows() throws {
        let url = missingBackupURL()
        let directory = url.deletingLastPathComponent()
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: directory) }
        try Data([1, 2, 3]).write(to: url)
        try FileManager.default.removeItem(at: url)

        XCTAssertThrowsError(try WebViewModel.readIncomingBackup(at: url), "選択後に削除されたファイルも例外になる")
    }

    @MainActor
    func testMissingIncomingBackupErrorWaitsForWebViewAndReady() async throws {
        let harness = Harness()
        let task = try XCTUnwrap(harness.model.handleIncomingURL(missingBackupURL()))
        await task.value
        XCTAssertTrue(harness.scripts.isEmpty, "WebViewが無い間はエラーを保留する")

        harness.attach()
        XCTAssertTrue(harness.scripts.isEmpty, "接続後も編集画面の準備を待つ")
        harness.model.webContentDidBecomeReady()
        try harness.assertErrors(["バックアップを読み込めませんでした"])
        harness.assertNoRedeliveryAfterGuide()
    }

    @MainActor
    func testMissingIncomingBackupErrorWaitsForReady() async throws {
        let harness = Harness()
        harness.attach()
        let task = try XCTUnwrap(harness.model.handleIncomingURL(missingBackupURL()))
        await task.value
        XCTAssertTrue(harness.scripts.isEmpty, "起動直後の購読開始前には送らない")

        harness.model.webContentDidBecomeReady()
        try harness.assertErrors(["バックアップを読み込めませんでした"])
        harness.assertNoRedeliveryAfterGuide()
    }

    @MainActor
    func testMissingIncomingBackupErrorIsDeliveredImmediatelyWhenReady() async throws {
        let harness = Harness()
        harness.attach(ready: true)
        let task = try XCTUnwrap(harness.model.handleIncomingURL(missingBackupURL()))
        await task.value

        try harness.assertErrors(["バックアップを読み込めませんでした"])
        harness.assertNoRedeliveryAfterGuide()
    }

    @MainActor
    func testOnlyLatestPendingErrorIsDelivered() throws {
        let harness = Harness()
        harness.attach()
        harness.model.presentError("A")
        harness.model.presentError("B")
        XCTAssertTrue(harness.scripts.isEmpty, "準備前のエラーは送らない")

        harness.model.webContentDidBecomeReady()
        try harness.assertErrors(["B"])
        harness.assertNoRedeliveryAfterGuide()
    }

    @MainActor
    func testIncomingBackupErrorDuringGuideWaitsForEditorReady() async throws {
        let harness = Harness()
        harness.attach(ready: true)
        harness.model.webContentDidStartNavigation(to: URL(string: "knitting-local://bundle/guide/"))
        let task = try XCTUnwrap(harness.model.handleIncomingURL(missingBackupURL()))
        await task.value
        XCTAssertTrue(harness.scripts.isEmpty, "使い方ページには購読者が無いので保留する")

        harness.model.webContentDidStartNavigation(to: LocalWebSchemeHandler.indexURL)
        XCTAssertTrue(harness.scripts.isEmpty, "編集画面へ戻っても購読開始を待つ")
        harness.model.webContentDidBecomeReady()
        try harness.assertErrors(["バックアップを読み込めませんでした"])
        harness.assertNoRedeliveryAfterGuide()
    }

    @MainActor
    func testPendingBackupAndErrorAreDeliveredInOccurrenceOrder() {
        for backupFirst in [true, false] {
            let harness = Harness()
            harness.attach()
            if backupFirst {
                harness.model.deliverBackup(Data([1, 2, 3]), filename: "chart.knit")
                harness.model.presentError("エラー")
            } else {
                harness.model.presentError("エラー")
                harness.model.deliverBackup(Data([1, 2, 3]), filename: "chart.knit")
            }
            XCTAssertTrue(harness.scripts.isEmpty, "どちらの通知も準備前には送らない")

            harness.model.webContentDidBecomeReady()
            let events = harness.scripts.map { script in
                script.contains("knittingEditorNativeBackupSelected") ? "backup" :
                    script.contains("knittingEditorNativeError") ? "error" : "unknown"
            }
            XCTAssertEqual(events, backupFirst ? ["backup", "error"] : ["error", "backup"], "発生した順に各1回だけ送る")
            harness.assertNoRedeliveryAfterGuide()
        }
    }

    @MainActor
    func testReplacingPendingDeliveryKeepsLatestOccurrenceOrder() throws {
        for replaceBackup in [true, false] {
            let harness = Harness()
            harness.attach()
            if replaceBackup { harness.model.deliverBackup(Data([0]), filename: "old.knit") }
            harness.model.presentError("古いエラー")
            harness.model.deliverBackup(Data([1, 2, 3]), filename: "latest.knit")
            if !replaceBackup { harness.model.presentError("新しいエラー") }

            harness.model.webContentDidBecomeReady()
            XCTAssertEqual(harness.scripts.count, 2, "各種類の最新1件だけを保持する")
            let backupIndex = replaceBackup ? 1 : 0
            let errorIndex = replaceBackup ? 0 : 1
            let backup = try XCTUnwrap(harness.scripts.dropFirst(backupIndex).first)
            let error = try XCTUnwrap(harness.scripts.dropFirst(errorIndex).first)
            XCTAssertTrue(backup.contains("knittingEditorNativeBackupSelected"), "新しいバックアップの発生位置へ移す")
            XCTAssertTrue(backup.contains("latest.knit"), "古いバックアップを置き換える")
            XCTAssertTrue(backup.contains(Data([1, 2, 3]).base64EncodedString()), "最新のバックアップのバイト列を渡す")
            XCTAssertTrue(error.contains("knittingEditorNativeError"), "新しいエラーの発生位置へ移す")
            XCTAssertTrue(error.contains(replaceBackup ? "古いエラー" : "新しいエラー"), "最後のエラーだけを渡す")
            harness.assertNoRedeliveryAfterGuide()
        }
    }

    @MainActor
    func testErrorRaisedWhileDeliveringReplacesOlderPendingError() throws {
        let harness = Harness()
        harness.attach()
        harness.model.deliverBackup(Data([1, 2, 3]), filename: "chart.knit")
        harness.model.presentError("古いエラー")
        // バックアップを渡せなかったときのように、配送の途中で新しいエラーが起きる場合。
        let record = harness.model.evaluateScript
        harness.model.evaluateScript = { [unowned harness] webView, script in
            record(webView, script)
            if script.contains("knittingEditorNativeBackupSelected") { harness.model.presentError("新しいエラー") }
        }

        harness.model.webContentDidBecomeReady()
        XCTAssertEqual(harness.scripts.count, 2, "古いエラーは新しいエラーに置き換わり、送らない")
        XCTAssertTrue(harness.scripts[0].contains("knittingEditorNativeBackupSelected"))
        XCTAssertTrue(harness.scripts[1].contains("新しいエラー"), "新しいエラーのあとに古いエラーを送らない")
        harness.assertNoRedeliveryAfterGuide()
    }

    /// `updateUIView`は毎回`attach`を呼ぶ。保留の出し入れで観測中の値が変わると、SwiftUIが描き直して
    /// また`attach`を呼び、起動画面のまま止まる（このPRの途中で起きた）。
    @MainActor
    func testDeliveringPendingNoticesDoesNotInvalidateObservedState() throws {
        let harness = Harness()
        harness.attach(ready: true)
        var invalidated = false
        withObservationTracking {
            harness.model.attach(harness.webView)
        } onChange: {
            invalidated = true
        }

        harness.model.presentError("エラー")
        harness.model.deliverBackup(Data([1, 2, 3]), filename: "chart.knit")
        harness.model.attach(harness.webView)

        XCTAssertEqual(harness.scripts.count, 2, "準備済みなので両方すぐ送る")
        XCTAssertFalse(invalidated, "通知の保留と配送で画面の再描画を起こさない")
    }

    @MainActor
    func testMissingPickerBackupReportsErrorAndClearsPresentationState() throws {
        let harness = Harness()
        harness.attach(ready: true)
        let defaults = UserDefaults(suiteName: "NativeErrorDeliveryTests.\(UUID().uuidString)")!
        let coordinator = WebViewContainer.Coordinator(model: harness.model, reviewRequestTracker: ReviewRequestTracker(defaults: defaults))
        let picker = UIDocumentPickerViewController(forOpeningContentTypes: [.data])
        coordinator.pickerPurpose = .importBackup
        harness.model.isPresentingNativeUI = true

        coordinator.documentPicker(picker, didPickDocumentsAt: [missingBackupURL()])

        try harness.assertErrors(["バックアップを読み込めませんでした"])
        XCTAssertFalse(harness.model.isPresentingNativeUI, "読み込みに失敗しても操作できる状態へ戻す")
        XCTAssertNil(coordinator.pickerPurpose, "選択画面の用途を残さない")
        harness.assertNoRedeliveryAfterGuide()
    }

    @MainActor
    func testUnsupportedIncomingFileReturnsNoTaskAndDefersError() throws {
        let harness = Harness()
        harness.attach()

        XCTAssertNil(harness.model.handleIncomingURL(missingBackupURL().appendingPathExtension("txt")), "対象外の拡張子では読み込みを始めない")
        XCTAssertTrue(harness.scripts.isEmpty, "形式のエラーも準備前には送らない")
        harness.model.webContentDidBecomeReady()
        try harness.assertErrors(["対応していないファイル形式です"])
    }
}

/// WebContent終了後の復旧と、文書をまたぐ配送の境界を検証する。
final class WebContentRecoveryTests: XCTestCase {
    @MainActor
    private final class RecordingWebView: WKWebView {
        var currentURL: URL?
        var loadedRequests: [URLRequest] = []
        var reloadCount = 0

        override var url: URL? { currentURL }

        override func load(_ request: URLRequest) -> WKNavigation? {
            loadedRequests.append(request)
            return nil
        }

        override func reload() -> WKNavigation? {
            reloadCount += 1
            return nil
        }
    }

    @MainActor
    func testInitialLoadFailureRetryLoadsBundledIndexWithoutURL() {
        let model = WebViewModel()
        let webView = RecordingWebView(frame: .zero)
        model.attach(webView)
        let coordinator = WebViewContainer.Coordinator(model: model)
        coordinator.webView(webView, didFailProvisionalNavigation: nil, withError: NSError(domain: "test", code: 1))
        model.retryEditorLoad()
        XCTAssertEqual(webView.loadedRequests.map(\.url), [LocalWebSchemeHandler.indexURL])
        XCTAssertEqual(webView.reloadCount, 0)
        model.webContentDidBecomeReady()
    }

    @MainActor
    func testTerminationAndRetryUseDefaultReloadForExistingDocument() {
        let model = WebViewModel()
        let webView = RecordingWebView(frame: .zero)
        webView.currentURL = LocalWebSchemeHandler.indexURL
        model.attach(webView)
        model.webContentDidBecomeReady()
        let coordinator = WebViewContainer.Coordinator(model: model)
        coordinator.webViewWebContentProcessDidTerminate(webView)
        XCTAssertEqual(webView.reloadCount, 1)
        model.editorLoadDidFail()
        coordinator.webViewWebContentProcessDidTerminate(webView)
        XCTAssertEqual(webView.reloadCount, 1)
        XCTAssertNotNil(model.editorLoadFailure)
        model.retryEditorLoad()
        XCTAssertEqual(webView.reloadCount, 2)
        XCTAssertTrue(webView.loadedRequests.isEmpty)
        model.webContentDidBecomeReady()
    }

    @MainActor
    func testCommittedNavigationInvalidatesExportResult() throws {
        let model = WebViewModel()
        let webView = RecordingWebView(frame: .zero)
        webView.currentURL = URL(string: "knitting-local://bundle/guide/")
        let coordinator = WebViewContainer.Coordinator(model: model)
        XCTAssertTrue(coordinator.preparePendingExport(data: Data([1]), filename: "chart.knit", mimeType: "application/gzip", requestID: "old"))
        let directory = try XCTUnwrap(coordinator.pendingExport?.directory)
        defer { try? FileManager.default.removeItem(at: directory) }
        coordinator.webView(webView, didCommit: nil)
        XCTAssertNil(coordinator.pendingExport?.requestID)
        XCTAssertFalse(model.isPreparingEditor)
        XCTAssertTrue(FileManager.default.fileExists(atPath: directory.path))
    }

    @MainActor
    func testTerminationPreparesEditorAndReadyClearsFailure() {
        let model = WebViewModel()
        model.webContentDidBecomeReady()
        XCTAssertTrue(model.webContentProcessDidTerminate(now: Date(timeIntervalSince1970: 100)))
        XCTAssertTrue(model.isPreparingEditor)
        XCTAssertFalse(model.webContentReady)
        model.webContentDidBecomeReady()
        XCTAssertFalse(model.isPreparingEditor)
        XCTAssertTrue(model.webContentReady)
        XCTAssertNil(model.editorLoadFailure)
    }

    @MainActor
    func testRapidRepeatedTerminationStopsEvenAfterReady() {
        for ready in [true, false] {
            let model = WebViewModel()
            XCTAssertTrue(model.webContentProcessDidTerminate(now: Date(timeIntervalSince1970: 100)))
            if ready { model.webContentDidBecomeReady() }
            XCTAssertFalse(model.webContentProcessDidTerminate(now: Date(timeIntervalSince1970: 105)))
            XCTAssertNotNil(model.editorLoadFailure)
            XCTAssertTrue(model.isPreparingEditor)
        }
    }

    @MainActor
    func testConsecutiveRecoveryCapStopsSlowFailures() {
        let model = WebViewModel()
        XCTAssertTrue(model.webContentProcessDidTerminate(now: Date(timeIntervalSince1970: 100)))
        XCTAssertTrue(model.webContentProcessDidTerminate(now: Date(timeIntervalSince1970: 111)))
        XCTAssertFalse(model.webContentProcessDidTerminate(now: Date(timeIntervalSince1970: 122)))
        XCTAssertNotNil(model.editorLoadFailure)
    }

    @MainActor
    func testLaterTerminationCanRecoverAgain() {
        let model = WebViewModel()
        XCTAssertTrue(model.webContentProcessDidTerminate(now: Date(timeIntervalSince1970: 100)))
        model.webContentDidBecomeReady()
        XCTAssertTrue(model.webContentProcessDidTerminate(now: Date(timeIntervalSince1970: 111)))
        model.webContentDidBecomeReady()
    }

    @MainActor
    func testFailedRecoveryAndRetry() {
        let model = WebViewModel()
        let webView = WKWebView(frame: .zero)
        model.attach(webView)
        var reloads = 0
        model.reloadWebView = { view in
            XCTAssertTrue(view === webView)
            reloads += 1
        }
        XCTAssertTrue(model.webContentProcessDidTerminate())
        model.editorLoadDidFail()
        XCTAssertNotNil(model.editorLoadFailure)
        model.retryEditorLoad()
        XCTAssertEqual(reloads, 1)
        XCTAssertNil(model.editorLoadFailure)
        XCTAssertTrue(model.isPreparingEditor)
        XCTAssertFalse(model.webContentReady)
        model.webContentDidBecomeReady()
        XCTAssertNil(model.editorLoadFailure)
    }

    @MainActor
    func testTimeoutFailsOnlyWhileRecovering() {
        let model = WebViewModel()
        XCTAssertTrue(model.webContentProcessDidTerminate())
        model.editorRecoveryDidTimeOut(id: UUID())
        XCTAssertNil(model.editorLoadFailure)
        model.editorRecoveryDidTimeOut()
        XCTAssertNotNil(model.editorLoadFailure)
        model.retryEditorLoad()
        model.webContentDidBecomeReady()
        model.editorRecoveryDidTimeOut()
        XCTAssertNil(model.editorLoadFailure)
    }

    @MainActor
    func testLoadFailuresShowRetryOnlyForUnreadyEditor() {
        let model = WebViewModel()
        let coordinator = WebViewContainer.Coordinator(model: model)
        let webView = WKWebView(frame: .zero)
        let error = NSError(domain: "test", code: 1)
        coordinator.webView(webView, didFailProvisionalNavigation: nil, withError: error)
        XCTAssertNotNil(model.editorLoadFailure)
        model.retryEditorLoad()
        coordinator.webView(webView, didFail: nil, withError: error)
        XCTAssertNotNil(model.editorLoadFailure)
        model.webContentDidBecomeReady()
        model.editorLoadDidFail()
        XCTAssertNil(model.editorLoadFailure)
        model.webContentDidStartNavigation(to: URL(string: "knitting-local://bundle/guide/"))
        model.editorLoadDidFail()
        XCTAssertNil(model.editorLoadFailure)
        XCTAssertTrue(model.webContentProcessDidTerminate())
        XCTAssertFalse(model.isPreparingEditor)
    }

    @MainActor
    func testPendingDeliveriesWaitAndDeliveredNoticesAreNotReplayed() {
        let model = WebViewModel()
        let webView = WKWebView(frame: .zero)
        model.attach(webView)
        var scripts: [String] = []
        model.evaluateScript = { _, script in scripts.append(script) }
        model.presentError("配送済み")
        model.webContentDidBecomeReady()
        XCTAssertEqual(scripts.count, 1)
        model.webContentDidStartNavigation(to: LocalWebSchemeHandler.indexURL)
        model.deliverBackup(Data([1]), filename: "chart.knit")
        model.presentError("保留中")
        XCTAssertTrue(model.webContentProcessDidTerminate())
        XCTAssertEqual(scripts.count, 1)
        model.webContentDidBecomeReady()
        XCTAssertEqual(scripts.count, 3)
        XCTAssertTrue(scripts[1].contains("chart.knit"))
        XCTAssertTrue(scripts[2].contains("保留中"))
        model.webContentDidBecomeReady()
        XCTAssertEqual(scripts.count, 3)
    }

    @MainActor
    func testTerminationInvalidatesExportResultButKeepsFileUntilDismissal() throws {
        let model = WebViewModel()
        let coordinator = WebViewContainer.Coordinator(model: model)
        let webView = WKWebView(frame: .zero)
        model.reloadWebView = { _ in }
        var results: [String] = []
        coordinator.reportExportResult = { id, _, _, _ in results.append(id) }
        XCTAssertTrue(coordinator.preparePendingExport(data: Data([1]), filename: "chart.knit", mimeType: "application/gzip", requestID: "old"))
        let directory = try XCTUnwrap(coordinator.pendingExport?.directory)
        defer { try? FileManager.default.removeItem(at: directory) }
        model.isPresentingNativeUI = true
        coordinator.webViewWebContentProcessDidTerminate(webView)
        XCTAssertNil(coordinator.pendingExport?.requestID)
        XCTAssertTrue(FileManager.default.fileExists(atPath: directory.path))
        XCTAssertTrue(model.isPresentingNativeUI)
        model.webContentDidBecomeReady()
        coordinator.finishSharing(completed: true)
        XCTAssertTrue(results.isEmpty)
        XCTAssertFalse(FileManager.default.fileExists(atPath: directory.path))
        XCTAssertFalse(model.isPresentingNativeUI)
    }
}
