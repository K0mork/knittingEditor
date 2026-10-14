import Photos
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

    /// Webが正規化した名前をブリッジで受け取り、各形式の一時ファイルを作れる。
    @MainActor
    func testNormalizedTrickyNamesPrepareNativeFilesForEveryExportFormat() throws {
        let bytes = Data([1, 2, 3])
        for (ext, mime) in [("png", "image/png"), ("pdf", "application/pdf"), ("knit", "application/gzip")] {
            for (original, normalized) in [
                ("春/秋", "春_秋"),
                ("試作..完成", "試作_完成"),
                ("試作\\修正版", "試作_修正版"),
                (String(repeating: "春", count: 177), String(repeating: "春", count: 179 - ext.count)),
            ] {
                let unsafe = "\(original).\(ext)"
                let filename = "\(normalized).\(ext)"
                func decode(_ name: String) -> Result<NativeBridgeMessage, NativeBridgeMessage.MessageError> {
                    NativeBridgeMessage.decode(body: [
                        "version": 1, "type": "exportFile", "filename": name,
                        "mimeType": mime, "dataBase64": bytes.base64EncodedString(), "id": "filename-test",
                    ])
                }
                XCTAssertEqual(decode(unsafe), .failure(.invalidFile), unsafe)
                XCTAssertEqual(decode(filename), .success(.exportFile(data: bytes, filename: filename, mimeType: mime, requestID: "filename-test")))
                let harness = Harness()
                XCTAssertTrue(harness.coordinator.preparePendingExport(data: bytes, filename: filename, mimeType: mime, requestID: "filename-test"))
                let pending = try XCTUnwrap(harness.coordinator.pendingExport)
                defer { harness.coordinator.cancelExportOptions() }
                XCTAssertEqual(pending.url.lastPathComponent, filename)
                XCTAssertEqual(pending.url.deletingLastPathComponent(), pending.directory)
                XCTAssertEqual(try Data(contentsOf: pending.url), bytes)
            }
        }
    }

    // MARK: - Coordinator

    @MainActor
    private final class Harness {
        let model = WebViewModel()
        let coordinator: WebViewContainer.Coordinator
        var reports: [(String, Bool)] = []
        var statuses: [NativeExportResult.Status?] = []
        var messages: [String?] = []
        var guideSections: [String?] = []

        init() {
            let defaults = UserDefaults(suiteName: "NativeExportResultTests.\(UUID().uuidString)")!
            coordinator = WebViewContainer.Coordinator(model: model, reviewRequestTracker: ReviewRequestTracker(defaults: defaults))
            coordinator.reportExportResult = { [unowned self] id, saved, status, notice in
                self.reports.append((id, saved))
                self.statuses.append(status)
                self.messages.append(notice?.message)
                self.guideSections.append(notice?.guideSection)
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
    func testEveryExportMimeTypeReportsShareCompletionCancellationAndError() throws {
        for (ext, mime) in [("png", "image/png"), ("pdf", "application/pdf"), ("knit", "application/gzip")] {
            for status in [NativeExportResult.Status.completed, .cancelled, .error] {
                let harness = Harness()
                XCTAssertTrue(harness.coordinator.preparePendingExport(data: Data([1, 2, 3]), filename: "chart.\(ext)", mimeType: mime, requestID: "export-1"))
                let directory = try XCTUnwrap(harness.coordinator.pendingExport?.directory)
                harness.model.isPresentingNativeUI = true
                harness.coordinator.finishSharing(completed: status == .completed, error: status == .error ? NSError(domain: "test", code: 1) : nil)
                harness.assertFinished([("export-1", status == .completed)], directory: directory)
                XCTAssertEqual(harness.statuses, [status])
            }
        }
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
            XCTAssertEqual(harness.messages, ["共有に失敗しました。もう一度共有を試してください。"])
            XCTAssertEqual(harness.guideSections, [nil])
        }
        XCTAssertEqual(
            NativeExportResult.script(requestID: "export-1", saved: false, status: .error),
            #"window.dispatchEvent(new CustomEvent('knittingEditorNativeExportFinished',{detail:{"id":"export-1","saved":false,"status":"error"}}));"#
        )
    }

    /// 写真への追加を拒否されたときの「画像を保存」が返すエラー（Simulatorで確かめた形）。
    private let photosAddDenied = NSError(
        domain: "ALAssetsLibraryErrorDomain",
        code: -1,
        userInfo: [NSUnderlyingErrorKey: NSError(domain: PHPhotosErrorDomain, code: PHPhotosError.Code.accessUserDenied.rawValue)]
    )

    func testShareFailureMessageExplainsSettingsOnlyWhenPhotosAdditionWasDenied() {
        let generic = "共有に失敗しました。もう一度共有を試してください。"
        let photos = "写真に保存できませんでした。設定アプリの「棒針編み図」→「写真」で追加を許可してから、もう一度お試しください。"
        let message = { WebViewContainer.Coordinator.shareFailureNotice(activityType: $0, error: $1).message }
        XCTAssertEqual(message(.saveToCameraRoll, photosAddDenied), photos)
        XCTAssertEqual(message(.saveToCameraRoll, NSError(domain: PHPhotosErrorDomain, code: PHPhotosError.Code.accessUserDenied.rawValue)), photos)
        // 写真の保存でも、拒否以外の失敗は今までどおり。
        XCTAssertEqual(message(.saveToCameraRoll, NSError(domain: "ALAssetsLibraryErrorDomain", code: -1)), generic)
        XCTAssertEqual(message(.saveToCameraRoll, NSError(domain: PHPhotosErrorDomain, code: PHPhotosError.Code.accessRestricted.rawValue)), generic)
        // 写真の保存以外は、同じエラーでも今までどおり。
        XCTAssertEqual(message(.copyToPasteboard, photosAddDenied), generic)
        XCTAssertEqual(message(nil, photosAddDenied), generic)
        XCTAssertEqual(message(nil, NSError(domain: "test", code: 1)), generic)
    }

    @MainActor
    func testDeniedPhotosSaveSendsItsMessageToWeb() throws {
        let harness = Harness()
        let directory = try harness.prepareExport()
        harness.coordinator.finishSharing(completed: false, error: photosAddDenied, activityType: .saveToCameraRoll)
        harness.assertFinished([("export-1", false)], directory: directory)
        XCTAssertEqual(harness.statuses, [.error])
        XCTAssertEqual(
            harness.messages,
            ["写真に保存できませんでした。設定アプリの「棒針編み図」→「写真」で追加を許可してから、もう一度お試しください。"]
        )
        // Webは、この節を開く「やり方を見る」をトーストに添える。
        XCTAssertEqual(harness.guideSections, ["allow-photos"])
        XCTAssertNil(
            WebViewContainer.Coordinator.shareFailureNotice(activityType: .saveToCameraRoll, error: NSError(domain: "test", code: 1)).guideSection
        )
        XCTAssertEqual(
            NativeExportResult.script(requestID: "export-1", saved: false, status: .error, notice: .init(message: "案内", guideSection: "allow-photos")),
            #"window.dispatchEvent(new CustomEvent('knittingEditorNativeExportFinished',{detail:{"guideSection":"allow-photos","id":"export-1","message":"案内","saved":false,"status":"error"}}));"#
        )
        XCTAssertEqual(
            NativeExportResult.script(requestID: "export-1", saved: false, status: .error, notice: .init(message: "案内")),
            #"window.dispatchEvent(new CustomEvent('knittingEditorNativeExportFinished',{detail:{"id":"export-1","message":"案内","saved":false,"status":"error"}}));"#
        )
    }

    func testShareAnchorUsesSmallCenterRectAtAnyWindowSize() {
        for bounds in [CGRect(x: 0, y: 0, width: 1024, height: 768), CGRect(x: 0, y: 0, width: 320, height: 1024)] {
            XCTAssertEqual(WebViewContainer.Coordinator.shareAnchor(in: bounds), CGRect(x: bounds.midX, y: bounds.midY, width: 1, height: 1))
        }
    }

    @MainActor
    func testSharePopoverRepositionUsesCurrentBoundsAndKeepsSourceView() throws {
        let harness = Harness()
        let sourceView = UIView(frame: CGRect(x: 0, y: 0, width: 1366, height: 1024))
        let activity = UIActivityViewController(activityItems: ["chart.knit"], applicationActivities: nil)
        let popover = try XCTUnwrap(activity.popoverPresentationController)
        popover.sourceView = sourceView
        var rect = WebViewContainer.Coordinator.shareAnchor(in: sourceView.bounds)
        popover.sourceRect = rect

        // 表示後の縮小と、boundsの原点が変わる場合の両方を検証する。
        for bounds in [CGRect(x: 0, y: 0, width: 320, height: 1024), CGRect(x: 20, y: 30, width: 320, height: 768)] {
            sourceView.bounds = bounds
            var view = sourceView
            harness.coordinator.popoverPresentationController(popover, willRepositionPopoverTo: &rect, in: &view)

            XCTAssertEqual(rect, CGRect(x: bounds.midX, y: bounds.midY, width: 1, height: 1))
            XCTAssertTrue(bounds.contains(rect))
            XCTAssertTrue(view === sourceView)
            XCTAssertTrue(popover.sourceView === sourceView)
        }
    }

    @MainActor
    func testSharePopoverDismissalKeepsExportPendingWithoutReportingResult() throws {
        let harness = Harness()
        let directory = try harness.prepareExport()
        defer { harness.coordinator.finishSharing(completed: false) }
        // 誤ってdocumentPickerWasCancelledを呼ぶと、この用途が消える。
        harness.coordinator.pickerPurpose = .importBackup
        let pendingURL = try XCTUnwrap(harness.coordinator.pendingExport?.url)
        let activity = UIActivityViewController(activityItems: ["chart.knit"], applicationActivities: nil)
        let popover = try XCTUnwrap(activity.popoverPresentationController)

        harness.coordinator.presentationControllerDidDismiss(popover)
        harness.coordinator.presentationControllerDidDismiss(popover)

        XCTAssertTrue(harness.reports.isEmpty)
        XCTAssertTrue(harness.statuses.isEmpty)
        XCTAssertEqual(harness.coordinator.pendingExport?.directory, directory)
        XCTAssertEqual(harness.coordinator.pendingExport?.url, pendingURL)
        XCTAssertTrue(FileManager.default.fileExists(atPath: pendingURL.path))
        XCTAssertTrue(harness.model.isPresentingNativeUI)
        XCTAssertEqual(harness.coordinator.pickerPurpose, .importBackup)
    }

    @MainActor
    func testShareCompletionAfterPopoverDismissalReportsCompletionOrErrorOnce() throws {
        for status in [NativeExportResult.Status.completed, .error] {
            let harness = Harness()
            let directory = try harness.prepareExport()
            harness.coordinator.pickerPurpose = .importBackup
            let activity = UIActivityViewController(activityItems: ["chart.knit"], applicationActivities: nil)
            let popover = try XCTUnwrap(activity.popoverPresentationController)

            harness.coordinator.presentationControllerDidDismiss(popover)
            XCTAssertTrue(harness.reports.isEmpty)
            XCTAssertNotNil(harness.coordinator.pendingExport)
            // エラーがある場合はcompletedが真でも.errorを優先する。
            harness.coordinator.finishSharing(completed: true, error: status == .error ? NSError(domain: "test", code: 1) : nil)
            harness.coordinator.presentationControllerDidDismiss(popover)
            harness.coordinator.finishSharing(completed: true)

            harness.assertFinished([("export-1", status == .completed)], directory: directory)
            XCTAssertEqual(harness.statuses, [status])
            XCTAssertEqual(harness.coordinator.pickerPurpose, .importBackup)
        }
    }

    @MainActor
    func testDocumentPickerPresentationDismissalStillCancelsExport() throws {
        let harness = Harness()
        let directory = try harness.prepareExport()
        harness.coordinator.pickerPurpose = .exportFile
        let picker = UIDocumentPickerViewController(forOpeningContentTypes: [.data])
        let presentation = UIPresentationController(presentedViewController: picker, presenting: nil)

        harness.coordinator.presentationControllerDidDismiss(presentation)

        harness.assertFinished([("export-1", false)], directory: directory)
        XCTAssertNil(harness.coordinator.pickerPurpose)
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
