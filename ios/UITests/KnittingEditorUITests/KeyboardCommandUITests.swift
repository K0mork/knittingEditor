import UIKit
import XCTest

/// iPadにハードウェアキーボードをつないだときの、メニューバーのショートカットを確かめる。
///
/// `typeKey(_:modifierFlags:)`はハードウェアキーボードのキー入力を送るため、
/// ソフトウェアキーボードを経由せずにメニューのショートカットへ届く。
@MainActor
final class KeyboardCommandUITests: XCTestCase {
    private static let timeout: TimeInterval = KnittingEditorUITests.editorAppearanceTimeout

    override func setUpWithError() throws {
        try super.setUpWithError()
        continueAfterFailure = false
        try XCTSkipUnless(
            UIDevice.current.userInterfaceIdiom == .pad,
            "メニューバーはiPadだけに出るため、iPadのSimulatorで実行する"
        )
        XCUIDevice.shared.orientation = .portrait
    }

    /// ⌘Z・⇧⌘Zで盤面の編集を1件ずつ取り消し・やり直す。Web側のキー操作と二重に
    /// 実行されると、1回の⌘Zで2件戻ってしまう。
    func testUndoAndRedoShortcutsStepBoardHistoryOnce() {
        let app = launchEditor()
        let canvas = createEmptyDocument(named: "ショートカット履歴", in: app)

        canvas.coordinate(withNormalizedOffset: CGVector(dx: 0.4, dy: 0.5)).tap()
        waitForStitchCount(1, on: canvas, in: app)
        canvas.coordinate(withNormalizedOffset: CGVector(dx: 0.6, dy: 0.5)).tap()
        waitForStitchCount(2, on: canvas, in: app)

        app.typeKey("z", modifierFlags: .command)
        waitForStitchCount(1, on: canvas, in: app)
        assertStitchCountStays(1, on: canvas, in: app)

        app.typeKey("z", modifierFlags: [.command, .shift])
        waitForStitchCount(2, on: canvas, in: app)
        assertStitchCountStays(2, on: canvas, in: app)

        // ⌘Zはページの`keydown`へ届かないが、キーボードがあるとみなして
        // 記号の一覧にEscapeでの閉じ方を案内する。Escapeで閉じる動きはWeb側の既存の処理で、
        // ここでは確かめない。
        app.descendants(matching: .any)
            .matching(NSPredicate(format: "label == %@", "編み目記号を選ぶ"))
            .firstMatch
            .tap()
        XCTAssertTrue(
            app.staticTexts
                .matching(NSPredicate(format: "label CONTAINS %@", "Escapeで閉じます"))
                .firstMatch
                .waitForExistence(timeout: Self.timeout),
            app.debugDescription
        )
        app.buttons["閉じる"].tap()
        XCTAssertTrue(waitForDisappearance(of: app.staticTexts["編み目記号"], timeout: Self.timeout), app.debugDescription)
    }

    /// 新規作成・書き出し・使い方をショートカットから開ける。
    /// ⌘キーの長押しで出る一覧はXCUITestから出せない（`perform(withKeyModifiers:)`は
    /// キーを押し続けない）ため、一覧に載るメニューの項目をショートカットで確かめる。
    func testFileAndHelpShortcutsOpenEditorActions() {
        let app = launchEditor()

        // ⌘N: 新しい編み図の名前を聞くダイアログ。
        createEmptyDocument(named: "ショートカット出力", in: app)

        // ⌘S・⌥⌘S・⇧⌘E・⌘P: 出力ファイルを作り、ネイティブの保存画面まで届く。
        for (key, modifiers, filename) in [
            ("s", XCUIElement.KeyModifierFlags.command, "ショートカット出力.knit"),
            ("s", [.command, .option], "knitting-editor-backup.knit"),
            ("e", [.command, .shift], "ショートカット出力.png"),
            ("p", .command, "ショートカット出力.pdf"),
        ] as [(String, XCUIElement.KeyModifierFlags, String)] {
            app.typeKey(key, modifierFlags: modifiers)
            let alert = app.alerts["ファイルを保存"]
            XCTAssertTrue(alert.waitForExistence(timeout: Self.timeout), "\(filename)の保存画面が出ない: \(app.debugDescription)")
            XCTAssertTrue(alert.staticTexts[filename].exists, "\(filename)ではない: \(alert.debugDescription)")
            alert.buttons["キャンセル"].tap()
            XCTAssertTrue(waitForDisappearance(of: alert, timeout: 10), app.debugDescription)
        }

        // ⇧⌘H: 使い方ページへ移る。
        app.typeKey("h", modifierFlags: [.command, .shift])
        XCTAssertTrue(
            app.webViews.firstMatch.staticTexts["棒針編み図の作り方"].waitForExistence(timeout: Self.timeout),
            app.debugDescription
        )
    }

    /// ⌘Oで復元するバックアップを選ぶ画面が出る。
    func testRestoreShortcutOpensBackupPicker() {
        let app = launchEditor()
        app.typeKey("o", modifierFlags: .command)
        // Document Pickerは別プロセスのUIで、閉じるボタンのidentifierが`Cancel`になる。
        let picker = app.descendants(matching: .any).matching(identifier: "Cancel").firstMatch
        XCTAssertTrue(picker.waitForExistence(timeout: Self.timeout), app.debugDescription)
        add(screenshot(named: "⌘Oで開いた復元の選択画面"))
    }

    // MARK: - 補助

    private func launchEditor() -> XCUIApplication {
        let app = XCUIApplication()
        app.launch()
        XCTAssertTrue(app.buttons["保存"].waitForExistence(timeout: Self.timeout), app.debugDescription)
        return app
    }

    /// ⌘Nで新しい編み図を作り、空の盤面を返す。
    @discardableResult
    private func createEmptyDocument(named name: String, in app: XCUIApplication) -> XCUIElement {
        app.typeKey("n", modifierFlags: .command)
        let field = app.textFields["入力"]
        XCTAssertTrue(field.waitForExistence(timeout: Self.timeout), "⌘Nでダイアログが出ない: \(app.debugDescription)")
        replaceText(name, in: field, app: app)
        app.buttons["決定"].tap()
        XCTAssertTrue(waitForDisappearance(of: field, timeout: Self.timeout), app.debugDescription)
        let canvas = app.webViews.firstMatch.otherElements
            .matching(NSPredicate(format: "label CONTAINS %@", "編み図編集盤面"))
            .firstMatch
        XCTAssertTrue(canvas.waitForExistence(timeout: Self.timeout), app.debugDescription)
        XCTAssertTrue(
            app.webViews.firstMatch.staticTexts
                .matching(NSPredicate(format: "label CONTAINS %@", name))
                .firstMatch
                .waitForExistence(timeout: Self.timeout),
            app.debugDescription
        )
        waitForStitchCount(0, on: canvas, in: app)
        return canvas
    }

    /// 入力欄の値を置き換える。`KnittingEditorUITests`の同名の処理と同じく、末尾を叩いて
    /// キャレットを値の後ろへ置き、消してから入力し、反映を待って確かめる。
    private func replaceText(_ text: String, in field: XCUIElement, app: XCUIApplication) {
        field.coordinate(withNormalizedOffset: CGVector(dx: 0.95, dy: 0.5)).tap()
        for _ in 0..<2 {
            let current = (field.value as? String) ?? ""
            let deletes = String(repeating: XCUIKeyboardKey.delete.rawValue, count: current.count + text.count + 2)
            field.typeText(deletes + text)
            let reached = XCTNSPredicateExpectation(predicate: NSPredicate(format: "value == %@", text), object: field)
            if XCTWaiter.wait(for: [reached], timeout: 10) == .completed { return }
        }
        XCTAssertEqual(field.value as? String, text, app.debugDescription)
    }

    private func waitForStitchCount(_ count: Int, on canvas: XCUIElement, in app: XCUIApplication) {
        let reached = XCTNSPredicateExpectation(
            predicate: NSPredicate(format: "label CONTAINS %@", "記号\(count)個"),
            object: canvas
        )
        XCTAssertEqual(
            XCTWaiter.wait(for: [reached], timeout: Self.timeout),
            .completed,
            "記号が\(count)個にならない: \(canvas.label)"
        )
    }

    /// 少し待っても記号数が変わらないこと。二重に実行されていれば、ここで減る・増える。
    private func assertStitchCountStays(_ count: Int, on canvas: XCUIElement, in app: XCUIApplication) {
        let changed = XCTNSPredicateExpectation(
            predicate: NSPredicate(format: "NOT (label CONTAINS %@)", "記号\(count)個"),
            object: canvas
        )
        XCTAssertEqual(XCTWaiter.wait(for: [changed], timeout: 2), .timedOut, "記号数が\(count)個から変わった: \(canvas.label)")
    }

    private func waitForDisappearance(of element: XCUIElement, timeout: TimeInterval) -> Bool {
        let gone = XCTNSPredicateExpectation(predicate: NSPredicate(format: "exists == false"), object: element)
        return XCTWaiter.wait(for: [gone], timeout: timeout) == .completed
    }

    private func screenshot(named name: String) -> XCTAttachment {
        let attachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        return attachment
    }
}
