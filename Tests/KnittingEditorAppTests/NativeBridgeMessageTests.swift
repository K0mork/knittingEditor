import Foundation
import XCTest
@testable import knittingEditor

final class NativeBridgeMessageTests: XCTestCase {
    /// Web側の復元テストと同じfixtureファイルを読む。Base64をテストへ複製すると、
    /// fixtureを更新したときに往復互換が壊れても気付けない。
    private func interopFixtureBase64() throws -> String {
        let url = try XCTUnwrap(
            Bundle(for: Self.self).url(forResource: "knitting-editor-v2-interop.knit", withExtension: "b64"),
            "`.knit`往復fixtureがテストバンドルへ同梱されていません"
        )
        return try String(contentsOf: url, encoding: .utf8).trimmingCharacters(in: .whitespacesAndNewlines)
    }

    func testInteropFixtureSurvivesNativeBridgeEnvelope() throws {
        let fixtureData = try XCTUnwrap(Data(base64Encoded: try interopFixtureBase64()))

        let message = NativeBridgeMessage.decode(body: [
            "version": 1,
            "type": "exportFile",
            "filename": "interop.knit",
            "mimeType": "application/gzip",
            "dataBase64": fixtureData.base64EncodedString(),
        ])

        XCTAssertEqual(
            message,
            .success(.exportFile(data: fixtureData, filename: "interop.knit", mimeType: "application/gzip"))
        )
    }

    func testDecodeExportFile() {
        let message = NativeBridgeMessage.decode(body: [
            "version": 1,
            "type": "exportFile",
            "filename": "chart.knit",
            "mimeType": "application/gzip",
            "dataBase64": Data([1, 2, 3]).base64EncodedString(),
        ])
        XCTAssertEqual(message, .success(.exportFile(data: Data([1, 2, 3]), filename: "chart.knit", mimeType: "application/gzip")))
    }

    func testDecodeRejectsPathTraversalFilename() {
        let result = NativeBridgeMessage.decode(body: [
            "version": 1,
            "type": "exportFile",
            "filename": "../chart.knit",
            "mimeType": "application/gzip",
            "dataBase64": Data([1]).base64EncodedString(),
        ])
        XCTAssertEqual(result, .failure(.invalidFile))
    }

    func testDecodeRejectsUnsupportedMimeTypeAndUnsafeFilenames() {
        func decode(filename: String, mimeType: String = "application/gzip") -> Result<NativeBridgeMessage, NativeBridgeMessage.MessageError> {
            NativeBridgeMessage.decode(body: [
                "version": 1,
                "type": "exportFile",
                "filename": filename,
                "mimeType": mimeType,
                "dataBase64": Data([1]).base64EncodedString(),
            ])
        }

        XCTAssertEqual(decode(filename: "chart.knit", mimeType: "text/html"), .failure(.invalidFile))
        XCTAssertEqual(decode(filename: "sub/chart.knit"), .failure(.invalidFile))
        XCTAssertEqual(decode(filename: "sub\\chart.knit"), .failure(.invalidFile))
        XCTAssertEqual(decode(filename: "chart\u{0}.knit"), .failure(.invalidFile))
        XCTAssertEqual(decode(filename: "chart\n.knit"), .failure(.invalidFile))
        XCTAssertEqual(decode(filename: "   "), .failure(.invalidFile))
        XCTAssertEqual(decode(filename: String(repeating: "a", count: 181)), .failure(.invalidFile))
    }

    func testDecodeRejectsEmptyAndOversizedPayloads() {
        XCTAssertEqual(
            NativeBridgeMessage.decode(body: [
                "version": 1,
                "type": "exportFile",
                "filename": "chart.png",
                "mimeType": "image/png",
                "dataBase64": "",
            ]),
            .failure(.invalidFile)
        )
        XCTAssertEqual(
            NativeBridgeMessage.decode(body: [
                "version": 1,
                "type": "exportFile",
                "filename": "chart.png",
                "mimeType": "image/png",
                "dataBase64": Data(count: NativeBridgeLimits.maxFileBytes + 1).base64EncodedString(),
            ]),
            .failure(.fileTooLarge)
        )
    }

    func testDecodeRejectsUnknownTypeAndVersion() {
        XCTAssertEqual(
            NativeBridgeMessage.decode(body: ["version": 1, "type": "unknown"]),
            .failure(.unsupportedType)
        )
        XCTAssertEqual(
            NativeBridgeMessage.decode(body: ["version": 2, "type": "openBackup"]),
            .failure(.unsupportedVersion)
        )
    }

    func testDecodeRejectsMissingVersionAsInvalidEnvelope() {
        XCTAssertEqual(
            NativeBridgeMessage.decode(body: ["type": "openBackup"]),
            .failure(.invalidEnvelope)
        )
    }

    func testDecodeWebReady() {
        XCTAssertEqual(
            NativeBridgeMessage.decode(body: ["version": 1, "type": "webReady"]),
            .success(.webReady)
        )
    }
}
