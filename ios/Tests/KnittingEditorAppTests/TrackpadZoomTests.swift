import XCTest
import UIKit
@testable import knittingEditor

final class TrackpadZoomTests: XCTestCase {
    func testScriptFormatsFiniteNumbersWithoutLocaleFormatting() {
        XCTAssertEqual(
            TrackpadZoom.dispatchScript(factor: 1.0312, x: 412.5, y: 300),
            "window.dispatchEvent(new CustomEvent('knittingEditorNativeZoom',{detail:{factor:1.0312,x:412.5,y:300.0}}));"
        )
        XCTAssertNotNil(TrackpadZoom.dispatchScript(factor: 0.8, x: -12.5, y: 0))
    }

    func testInvalidNumbersAreRejected() {
        for factor in [0, -1, Double.nan, Double.infinity, -Double.infinity] {
            XCTAssertNil(TrackpadZoom.dispatchScript(factor: factor, x: 1, y: 2))
        }
        XCTAssertNil(TrackpadZoom.dispatchScript(factor: 1, x: .nan, y: 2))
        XCTAssertNil(TrackpadZoom.dispatchScript(factor: 1, x: 1, y: .infinity))
    }

    @MainActor
    func testZoomUsesCommandGatingWithoutDependingOnHistory() {
        let model = WebViewModel()
        XCTAssertFalse(model.canPerform(.zoomIn))
        model.webContentDidBecomeReady()
        XCTAssertTrue(model.canPerform(.zoomIn))
        XCTAssertTrue(model.canPerform(.zoomOut))
        XCTAssertFalse(model.canPerform(.undo))
        model.isPresentingNativeUI = true
        XCTAssertFalse(model.canPerform(.zoomIn))
        XCTAssertFalse(model.canPerform(.zoomOut))
    }

    @MainActor
    func testRecognizerDoesNotDelayOrCancelFingerTouches() {
        let handler = TrackpadZoomHandler(model: WebViewModel())
        XCTAssertFalse(handler.recognizer.cancelsTouchesInView)
        XCTAssertFalse(handler.recognizer.delaysTouchesBegan)
        XCTAssertFalse(handler.recognizer.delaysTouchesEnded)
        XCTAssertTrue(handler.gestureRecognizer(handler.recognizer, shouldRecognizeSimultaneouslyWith: UIPinchGestureRecognizer()))
        XCTAssertFalse(handler.gestureRecognizer(handler.recognizer, shouldReceive: UIEvent()))
    }
}
