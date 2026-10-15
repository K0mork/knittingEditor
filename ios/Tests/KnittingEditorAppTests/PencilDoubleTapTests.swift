import UIKit
import XCTest
@testable import knittingEditor

final class PencilDoubleTapTests: XCTestCase {
    /// iPadの設定（設定 > Apple Pencil の「ダブルタップ」）に従い、道具の切り替えのときだけ描く⇔消すを送る（#269）。
    func testDoubleTapFollowsThePencilSetting() {
        XCTAssertEqual(PencilDoubleTap.command(for: .switchEraser), .toggleEraser)
        XCTAssertEqual(PencilDoubleTap.command(for: .switchPrevious), .toggleEraser)
        XCTAssertNil(PencilDoubleTap.command(for: .ignore), "設定が「オフ」なら何もしない")
        XCTAssertNil(PencilDoubleTap.command(for: .showColorPalette))
        if #available(iOS 17.5, *) {
            XCTAssertNil(PencilDoubleTap.command(for: .showInkAttributes))
            XCTAssertNil(PencilDoubleTap.command(for: .showContextualPalette))
            XCTAssertNil(PencilDoubleTap.command(for: .runSystemShortcut))
        }
    }

    /// 切り替えは、ほかの命令と同じく編集画面の準備ができてから、保存画面などを出していない間だけ送る。
    func testToggleIsSentOnlyWhenTheEditorAcceptsCommands() {
        let state = EditorCommandState()
        XCTAssertTrue(WebViewModel.canPerform(.toggleEraser, webContentReady: true, state: state))
        XCTAssertFalse(WebViewModel.canPerform(.toggleEraser, webContentReady: false, state: state))
        XCTAssertFalse(WebViewModel.canPerform(.toggleEraser, webContentReady: true, presentingNativeUI: true, state: state))
    }
}
