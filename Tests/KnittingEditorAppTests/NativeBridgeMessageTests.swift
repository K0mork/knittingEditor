import Foundation
import XCTest
@testable import knittingEditor

final class NativeBridgeMessageTests: XCTestCase {
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

    func testDecodeRejectsUnknownTypeAndVersion() {
        XCTAssertEqual(
            NativeBridgeMessage.decode(body: ["version": 1, "type": "unknown"]),
            .failure(.unsupportedType)
        )
        XCTAssertEqual(
            NativeBridgeMessage.decode(body: ["version": 2, "type": "openBackup"]),
            .failure(.invalidEnvelope)
        )
    }
}
