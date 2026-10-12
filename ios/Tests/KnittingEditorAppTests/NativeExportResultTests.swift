import UIKit
import UniformTypeIdentifiers
import XCTest
@preconcurrency import WebKit
@testable import knittingEditor

/// 書き出しの結果（保存・共有した／取りやめた）をWebへ返す経路（#122）。
final class NativeExportResultTests: XCTestCase {
    private func exportBody(id: Any?, dataBase64: String = Data([1, 2, 3]).base64EncodedString()) -> [String: Any] {
        var body: [String: Any] = [
            "version": 1,
            "type": "exportFile",
            "filename": "chart.knit",
            "mimeType": "application/gzip",
            "dataBase64": dataBase64,
        ]
        body["id"] = id
        return body
    }

    func testDecodeKeepsExportRequestID() {
        XCTAssertEqual(
            NativeBridgeMessage.decode(body: exportBody(id: "export-1_a")),
            .success(.exportFile(data: Data([1, 2, 3]), filename: "chart.knit", mimeType: "application/gzip", requestID: "export-1_a"))
        )
    }

    func testDecodeAcceptsExportWithoutRequestID() {
        XCTAssertEqual(
            NativeBridgeMessage.decode(body: exportBody(id: nil)),
            .success(.exportFile(data: Data([1, 2, 3]), filename: "chart.knit", mimeType: "application/gzip", requestID: nil))
        )
    }

    func testDecodeRejectsMalformedRequestID() {
        for id: Any in ["", String(repeating: "a", count: 65), "a'b", "a b", "</script>", 1] {
            XCTAssertEqual(NativeBridgeMessage.decode(body: exportBody(id: id)), .failure(.invalidEnvelope), "\(id)")
        }
    }

    func testRequestIDIsReadFromRejectedExportSoWebStopsWaiting() {
        let body = exportBody(id: "export-2", dataBase64: "")
        XCTAssertEqual(NativeBridgeMessage.decode(body: body), .failure(.invalidFile))
        XCTAssertEqual(NativeBridgeMessage.exportRequestID(body: body), "export-2")
        XCTAssertNil(NativeBridgeMessage.exportRequestID(body: ["version": 1, "type": "openBackup", "id": "export-2"]))
    }

    func testResultScriptDispatchesIdAndSavedFlag() {
        XCTAssertEqual(
            NativeExportResult.script(requestID: "export-3", saved: true),
            "window.dispatchEvent(new CustomEvent('knittingEditorNativeExportFinished',{detail:{\"id\":\"export-3\",\"saved\":true}}));"
        )
        XCTAssertEqual(
            NativeExportResult.script(requestID: "export-3", saved: false),
            "window.dispatchEvent(new CustomEvent('knittingEditorNativeExportFinished',{detail:{\"id\":\"export-3\",\"saved\":false}}));"
        )
    }

    // MARK: - Coordinator

    @MainActor
    private final class Harness {
        let model = WebViewModel()
        let coordinator: WebViewContainer.Coordinator
        var reports: [(String, Bool)] = []
        var statuses: [NativeExportResult.Status?] = []

        init() {
            let defaults = UserDefaults(suiteName: "NativeExportResultTests.\(UUID().uuidString)")!
            coordinator = WebViewContainer.Coordinator(model: model, reviewRequestTracker: ReviewRequestTracker(defaults: defaults))
            coordinator.reportExportResult = { [unowned self] id, saved, status in
                self.reports.append((id, saved))
                self.statuses.append(status)
            }
        }

        /// 保存画面へ渡す直前の状態を作り、一時ファイルのディレクトリを返す。
        func prepareExport(requestID: String? = "export-1") throws -> URL {
            XCTAssertTrue(coordinator.preparePendingExport(
                data: Data([1, 2, 3]),
                filename: "chart.knit",
                mimeType: "application/gzip",
                requestID: requestID
            ))
            let directory = try XCTUnwrap(coordinator.pendingExport?.directory)
            XCTAssertTrue(FileManager.default.fileExists(atPath: directory.path))
            model.isPresentingNativeUI = true
            return directory
        }

        func assertFinished(_ expected: [(String, Bool)], directory: URL, file: StaticString = #filePath, line: UInt = #line) {
            XCTAssertEqual(reports.map(\.0), expected.map(\.0), file: file, line: line)
            XCTAssertEqual(reports.map(\.1), expected.map(\.1), file: file, line: line)
            XCTAssertNil(coordinator.pendingExport, file: file, line: line)
            XCTAssertFalse(model.isPresentingNativeUI, file: file, line: line)
            XCTAssertFalse(FileManager.default.fileExists(atPath: directory.path), file: file, line: line)
        }
    }

    @MainActor
    func testSavingFromDocumentPickerReportsSaved() throws {
        let harness = Harness()
        let directory = try harness.prepareExport()
        let picker = UIDocumentPickerViewController(forOpeningContentTypes: [.data])
        harness.coordinator.pickerPurpose = .exportFile

        harness.coordinator.documentPicker(picker, didPickDocumentsAt: [URL(fileURLWithPath: "/tmp/chart.knit")])

        harness.assertFinished([("export-1", true)], directory: directory)
    }

    @MainActor
    func testCancellingDocumentPickerReportsNotSaved() throws {
        let harness = Harness()
        let directory = try harness.prepareExport()
        harness.coordinator.pickerPurpose = .exportFile

        harness.coordinator.documentPickerWasCancelled(UIDocumentPickerViewController(forOpeningContentTypes: [.data]))

        harness.assertFinished([("export-1", false)], directory: directory)
    }

    @MainActor
    func testShareSheetReportsWhetherSharingCompleted() throws {
        let completed = Harness()
        let completedDirectory = try completed.prepareExport()
        completed.coordinator.finishSharing(completed: true)
        completed.coordinator.finishSharing(completed: true)
        completed.assertFinished([("export-1", true)], directory: completedDirectory)
        XCTAssertEqual(completed.statuses, [.completed])

        let cancelled = Harness()
        let cancelledDirectory = try cancelled.prepareExport()
        cancelled.coordinator.finishSharing(completed: false)
        cancelled.assertFinished([("export-1", false)], directory: cancelledDirectory)
        XCTAssertEqual(cancelled.statuses, [.cancelled])
    }

    @MainActor
    func testShareErrorOverridesCompletionAndReportsOnce() throws {
        for completed in [false, true] {
            let harness = Harness()
            let directory = try harness.prepareExport()
            harness.coordinator.finishSharing(completed: completed, error: NSError(domain: "test", code: 1))
            harness.coordinator.finishSharing(completed: true)
            harness.assertFinished([("export-1", false)], directory: directory)
            XCTAssertEqual(harness.statuses, [.error])
        }
        XCTAssertEqual(
            NativeExportResult.script(requestID: "export-1", saved: false, status: .error),
            #"window.dispatchEvent(new CustomEvent('knittingEditorNativeExportFinished',{detail:{"id":"export-1","saved":false,"status":"error"}}));"#
        )
    }

    func testShareAnchorUsesSmallCenterRectAtAnyWindowSize() {
        for bounds in [CGRect(x: 0, y: 0, width: 1024, height: 768), CGRect(x: 0, y: 0, width: 320, height: 1024)] {
            XCTAssertEqual(WebViewContainer.Coordinator.shareAnchor(in: bounds), CGRect(x: bounds.midX, y: bounds.midY, width: 1, height: 1))
        }
    }

    @MainActor
    func testCancellingConfirmationAlertReportsNotSaved() throws {
        let harness = Harness()
        let directory = try harness.prepareExport()

        harness.coordinator.cancelExportOptions()

        harness.assertFinished([("export-1", false)], directory: directory)
    }

    @MainActor
    func testExportWithoutRequestIDReportsNothing() throws {
        let harness = Harness()
        let directory = try harness.prepareExport(requestID: nil)

        harness.coordinator.finishSharing(completed: true)

        harness.assertFinished([], directory: directory)
    }

    @MainActor
    func testNavigationDropsRequestIDOfPreviousDocument() throws {
        let harness = Harness()
        let directory = try harness.prepareExport()
        let webView = WKWebView(frame: .zero)

        harness.coordinator.webView(webView, didCommit: nil)
        XCTAssertNotNil(harness.coordinator.pendingExport, "保存画面は開いたままなので、一時ファイルは残す")
        harness.coordinator.finishSharing(completed: true)

        harness.assertFinished([], directory: directory)
    }

    @MainActor
    func testReportReachesWebPageAsCustomEvent() async throws {
        let model = WebViewModel()
        let webView = WKWebView(frame: CGRect(x: 0, y: 0, width: 100, height: 100))
        model.attach(webView)
        webView.loadHTMLString(
            """
            <script>
            window.results = [];
            window.addEventListener('knittingEditorNativeExportFinished', (event) => window.results.push(event.detail));
            </script>
            """,
            baseURL: nil
        )
        let deadline = Date().addingTimeInterval(10)
        while (try? await webView.evaluateJavaScript("Array.isArray(window.results)")) as? Bool != true {
            guard Date() < deadline else { return XCTFail("テスト用のページを読み込めませんでした") }
            try await Task.sleep(nanoseconds: 50_000_000)
        }

        model.reportExportFinished(requestID: "export-4", saved: false)
        model.reportExportFinished(requestID: "export-5", saved: true)

        let json = try await webView.evaluateJavaScript("JSON.stringify(window.results)") as? String
        XCTAssertEqual(json, #"[{"id":"export-4","saved":false},{"id":"export-5","saved":true}]"#)
    }
}
