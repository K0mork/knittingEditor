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
            .success(.exportFile(data: fixtureData, filename: "interop.knit", mimeType: "application/gzip", requestID: nil))
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
        XCTAssertEqual(message, .success(.exportFile(data: Data([1, 2, 3]), filename: "chart.knit", mimeType: "application/gzip", requestID: nil)))
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

    func testExportFilenameBoundariesKeepNativeValidation() {
        for (extensionName, mimeType) in [("png", "image/png"), ("pdf", "application/pdf"), ("knit", "application/gzip")] {
            func decode(_ filename: String) -> Result<NativeBridgeMessage, NativeBridgeMessage.MessageError> {
                NativeBridgeMessage.decode(body: [
                    "version": 1, "type": "exportFile", "filename": filename,
                    "mimeType": mimeType, "dataBase64": Data([1]).base64EncodedString(),
                ])
            }
            for name in ["春/秋", "試作..完成", "試作\\修正版", "試作\u{85}完成", "試作\u{200b}完成", String(repeating: "春", count: 177)] {
                XCTAssertEqual(decode("\(name).\(extensionName)"), .failure(.invalidFile))
            }
            for stem in [String(repeating: "春", count: 179 - extensionName.count), "春_秋", "試作_完成", "試作_修正版", String(repeating: "🧶", count: 179 - extensionName.count), String(repeating: "か\u{3099}", count: 179 - extensionName.count)] {
                let filename = "\(stem).\(extensionName)"
                XCTAssertEqual(decode(filename), .success(.exportFile(data: Data([1]), filename: filename, mimeType: mimeType, requestID: nil)))
            }
        }
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
