import Foundation
import XCTest
@testable import knittingEditor

final class EditorCommandsTests: XCTestCase {
    /// Web側`ios/Web/src/nativeBridge.ts`の`NATIVE_COMMANDS`と同じ並び・綴り。
    /// どちらかだけを変えると、メニューを選んでも何も起きなくなる。
    func testCommandNamesMatchWebBridge() {
        XCTAssertEqual(EditorCommand.allCases.map(\.rawValue), [
            "newDocument", "restoreBackup", "exportBackup", "exportAllBackup",
            "exportPng", "exportPdf", "undo", "redo", "openGuide",
        ])
    }

    func testDispatchScriptSendsCommandEvent() {
        XCTAssertEqual(
            EditorCommand.exportPdf.dispatchScript,
            "window.dispatchEvent(new CustomEvent('knittingEditorNativeCommand',{detail:'exportPdf'}));"
        )
        // 名前は英字だけなので、文字列へそのまま埋め込んでも引用符を壊さない。
        for command in EditorCommand.allCases {
            XCTAssertTrue(command.rawValue.allSatisfy { $0.isASCII && $0.isLetter }, command.rawValue)
        }
    }

    func testCommandsAreDisabledUntilEditorIsReady() {
        let state = EditorCommandState(canUndo: true, canRedo: true)
        for command in EditorCommand.allCases {
            XCTAssertFalse(WebViewModel.canPerform(command, webContentReady: false, state: state), command.rawValue)
            XCTAssertTrue(WebViewModel.canPerform(command, webContentReady: true, state: state), command.rawValue)
        }
    }

    /// iPadOSの「開く…」（`open:`）は、編集画面が復元を受け付けるときだけ選べる。
    @MainActor
    func testSystemOpenCommandFollowsRestoreAvailability() {
        let delegate = AppDelegate()
        let open = #selector(AppDelegate.open(_:))
        XCTAssertFalse(delegate.canPerformAction(open, withSender: nil), "編集画面がまだ無い")
        let model = WebViewModel()
        delegate.model = model
        XCTAssertFalse(delegate.canPerformAction(open, withSender: nil), "編集画面の準備ができていない")
    }

    func testUndoAndRedoFollowWebHistoryState() {
        let empty = EditorCommandState()
        XCTAssertFalse(WebViewModel.canPerform(.undo, webContentReady: true, state: empty))
        XCTAssertFalse(WebViewModel.canPerform(.redo, webContentReady: true, state: empty))
        XCTAssertTrue(WebViewModel.canPerform(.newDocument, webContentReady: true, state: empty))

        let undoOnly = EditorCommandState(canUndo: true, canRedo: false)
        XCTAssertTrue(WebViewModel.canPerform(.undo, webContentReady: true, state: undoOnly))
        XCTAssertFalse(WebViewModel.canPerform(.redo, webContentReady: true, state: undoOnly))
    }

    /// 保存画面・共有シート・Document Pickerを出している間は、どの項目も選べない表示にする。
    func testCommandsAreDisabledWhileNativeSheetIsPresented() {
        let state = EditorCommandState(canUndo: true, canRedo: true)
        for command in EditorCommand.allCases {
            XCTAssertFalse(
                WebViewModel.canPerform(command, webContentReady: true, presentingNativeUI: true, state: state),
                command.rawValue
            )
        }
    }

    @MainActor
    func testModelFollowsNativePresentation() {
        let model = WebViewModel()
        model.webContentDidBecomeReady()
        XCTAssertTrue(model.canPerform(.exportPdf))
        model.isPresentingNativeUI = true
        XCTAssertFalse(model.canPerform(.exportPdf))
        model.isPresentingNativeUI = false
        XCTAssertTrue(model.canPerform(.exportPdf))
    }

    @MainActor
    func testModelStartsWithoutHistory() {
        let model = WebViewModel()
        XCTAssertEqual(model.editorCommandState, EditorCommandState())
        XCTAssertFalse(model.isPresentingNativeUI)
        XCTAssertFalse(model.canPerform(.newDocument), "編集画面が準備できるまではメニューを選べない")
    }

    func testDecodeCommandState() {
        XCTAssertEqual(
            NativeBridgeMessage.decode(body: ["version": 1, "type": "commandState", "canUndo": true, "canRedo": false]),
            .success(.commandState(EditorCommandState(canUndo: true, canRedo: false)))
        )
        XCTAssertEqual(
            NativeBridgeMessage.decode(body: ["version": 1, "type": "commandState", "canUndo": true]),
            .failure(.invalidEnvelope)
        )
        XCTAssertEqual(
            NativeBridgeMessage.decode(body: ["version": 1, "type": "commandState", "canUndo": "yes", "canRedo": false]),
            .failure(.invalidEnvelope)
        )
    }
}
