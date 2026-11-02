import XCTest
@testable import knittingEditor

final class BridgeSignpostsTests: XCTestCase {
    func testDocumentedIntervalNamesRemainStable() {
        XCTAssertEqual(String(describing: BridgeSignposts.exportDecode), "BridgeExportDecode")
        XCTAssertEqual(String(describing: BridgeSignposts.exportWrite), "BridgeExportWrite")
        XCTAssertEqual(String(describing: BridgeSignposts.backupRead), "BridgeBackupRead")
        XCTAssertEqual(String(describing: BridgeSignposts.backupEncode), "BridgeBackupEncode")
        XCTAssertEqual(String(describing: BridgeSignposts.backupJavaScript), "BridgeBackupJavaScript")
    }
}
