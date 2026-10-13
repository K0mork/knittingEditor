#if DEBUG
import XCTest
@testable import knittingEditor

final class DebugEditorConfigurationTests: XCTestCase {
    func testMissingAndInvalidDelayDoNotInjectConfiguration() {
        XCTAssertNil(DebugEditorConfiguration.userScriptSource(environment: [:]))
        for value in ["-1", "1.5", "NaN", "2147483648", "0;alert(1)"] {
            XCTAssertNil(DebugEditorConfiguration.userScriptSource(environment: ["KNITTING_EDITOR_AUTOSAVE_DELAY_MS": value]))
        }
    }

    func testValidDelayIsInjectedAsNumber() {
        for value in ["0", "400", "3600000", "2147483647"] {
            XCTAssertEqual(
                DebugEditorConfiguration.userScriptSource(environment: ["KNITTING_EDITOR_AUTOSAVE_DELAY_MS": value]),
                "window.knittingEditorDebugConfiguration=Object.freeze({autosaveDelayMs:\(value)});"
            )
        }
    }
}
#endif
