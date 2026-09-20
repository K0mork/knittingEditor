import Foundation
import XCTest
@testable import knittingEditor

private let interopFixtureBase64 = "H4sIALngr2oAA22OwUoDMRCG32XOiUyjtHRvq4J4FNSD0kOaTGvoblKys7ZQevDsTbz5Aj6C+DxC8S2cSHvrMHwM/P/M/BuYpdxahgoWMTCHONfkA6cMCp4pdyFFqIyCjgO7pwvLtknz+4NwqoDWy5SZfF1uGDRDjWNt8Bax+u8TRHyQYz65vqXIHVSPGwhe3LOw5j6TXtFUIw7EFG1LIuw+vn6+335fXnfvn3uTiDmtZFmyuNTIIL8dNWWC+qaWui64LDgvqO8Krgpk2WWy+5SDkRmOxngmwRAV9Et/VNlOFEyb5BYl8WT7B+a2uSkqAQAA"

final class NativeBridgeMessageTests: XCTestCase {
    func testInteropFixtureSurvivesNativeBridgeEnvelope() throws {
        let fixtureData = try XCTUnwrap(Data(base64Encoded: interopFixtureBase64))

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
