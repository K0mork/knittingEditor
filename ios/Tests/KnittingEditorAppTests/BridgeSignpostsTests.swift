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

#if DEBUG
    /// `ios/scripts/summarize-bridge-intervals.py`が読む1行の形式。
    func testIntervalLogLineHasFixedTabSeparatedFields() {
        let line = BridgeIntervalLog.line(
            name: "BridgeExportWrite",
            duration: .seconds(1) + .microseconds(234_567),
            bytes: 42,
            mimeType: "image/png",
            end: Date(timeIntervalSince1970: 1_793_577_600.5)
        )
        XCTAssertEqual(line, "BridgeExportWrite\t1234.567\t42\timage/png\t2026-11-02T00:00:00.500Z")
    }

    func testIntervalLogLineKeepsOneRecordPerLine() {
        let line = BridgeIntervalLog.line(
            name: "BridgeBackupRead", duration: .zero, bytes: 0, mimeType: "a\tb\nc", end: Date(timeIntervalSince1970: 0)
        )
        XCTAssertEqual(line.split(separator: "\t", omittingEmptySubsequences: false).count, 5)
        XCTAssertFalse(line.contains("\n"))
        XCTAssertTrue(line.hasPrefix("BridgeBackupRead\t0.000\t0\ta b c\t"))
    }
#endif
}
