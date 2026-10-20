import XCTest
@testable import knittingEditor

final class FoldRegionTests: XCTestCase {
    func testVerticalFrameAlreadyIncludesMarginsAndUsesWebViewCoordinates() {
        let fold = FoldRegion.select([.init(frame: CGRect(x: 455.5, y: 0, width: 40, height: 669), isActive: true)])
        XCTAssertEqual(fold, FoldRegion(axis: "vertical", start: 455.5, end: 495.5))
        XCTAssertEqual(FoldRegion.script(fold), "window.dispatchEvent(new CustomEvent('knittingEditorNativeFoldChanged',{detail:{axis:'vertical',start:455.5,end:495.5}}));")
    }

    func testHorizontalAndInactiveRegions() {
        let fold = FoldRegion.select([
            .init(frame: CGRect(x: 100, y: 0, width: 40, height: 669), isActive: false),
            .init(frame: CGRect(x: 0, y: 300, width: 951, height: 40), isActive: true),
        ])
        XCTAssertEqual(fold, FoldRegion(axis: "horizontal", start: 300, end: 340))
    }

    func testUnfoldAndInvalidFramesClearTheFold() {
        XCTAssertNil(FoldRegion.select([]))
        for frame in [CGRect.zero, .null, .infinite, CGRect(x: 0, y: 0, width: CGFloat.nan, height: 10)] {
            XCTAssertNil(FoldRegion.select([.init(frame: frame, isActive: true)]))
        }
        XCTAssertNil(FoldRegion.select([.init(frame: CGRect(x: 0, y: 0, width: 40, height: 600), isActive: false)]))
        XCTAssertEqual(FoldRegion.script(nil), "window.dispatchEvent(new CustomEvent('knittingEditorNativeFoldChanged',{detail:null}));")
    }
}
