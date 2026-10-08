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

        typeHistoryKey([.command], from: 2, to: 1, on: canvas, in: app)
        assertStitchCountStays(1, on: canvas, in: app)

        typeHistoryKey([.command, .shift], from: 1, to: 2, on: canvas, in: app)
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

    /// 入力欄で文字を打っている間の⌘Z・⇧⌘Zは、盤面ではなく入力中の文字を取り消し・やり直す。
    /// 標準の「取り消す」をメニューで置き換えたため、盤面に戻せる編集が無いときもメニューを通す。
    func testUndoAndRedoShortcutsEditTextFieldInsteadOfBoard() {
        let app = launchEditor()

        // 盤面に戻せる編集が無いとき。起動直後は履歴が空。
        XCTAssertFalse(app.buttons["元に戻す"].isEnabled, app.debugDescription)
        assertTypingUndoAndRedo(in: app)

        // 盤面に戻せる編集があるとき。文字だけが戻り、盤面は戻らない。
        let canvas = createEmptyDocument(named: "文字の取り消し", in: app)
        canvas.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
        waitForStitchCount(1, on: canvas, in: app)
        XCTAssertTrue(app.buttons["元に戻す"].isEnabled, app.debugDescription)
        assertTypingUndoAndRedo(in: app)
        waitForStitchCount(1, on: canvas, in: app)
        assertStitchCountStays(1, on: canvas, in: app)
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
            let alert = app.alerts["ファイルを保存"]
            XCTAssertTrue(
                typeShortcut(key, modifiers, in: app, until: Self.exists, on: alert),
                "\(filename)の保存画面が出ない: \(app.debugDescription)"
            )
            XCTAssertTrue(alert.staticTexts[filename].exists, "\(filename)ではない: \(alert.debugDescription)")
            alert.buttons["キャンセル"].tap()
            XCTAssertTrue(waitForDisappearance(of: alert, timeout: 10), app.debugDescription)
        }

        // ⇧⌘H: 使い方ページへ移る。
        XCTAssertTrue(
            typeShortcut("h", [.command, .shift], in: app, until: Self.exists, on: app.webViews.firstMatch.staticTexts["棒針編み図の作り方"]),
            app.debugDescription
        )
    }

    /// ⌘Oで復元するバックアップを選ぶ画面が出る。
    func testRestoreShortcutOpensBackupPicker() {
        let app = launchEditor()
        let picker = SystemSheet.element(in: app)
        XCTAssertTrue(typeShortcut("o", .command, in: app, until: Self.exists, on: picker), app.debugDescription)
        add(screenshot(named: "⌘Oで開いた復元の選択画面"))
    }

    // MARK: - 補助

    private func launchEditor() -> XCUIApplication {
        let app = XCUIApplication()
        app.launch()
        XCTAssertTrue(app.buttons["保存"].waitForExistence(timeout: Self.timeout), app.debugDescription)
        // メニューの項目は、編集画面が`webReady`を送って準備中の表示が消えるまで選べない。
        XCTAssertTrue(
            waitForDisappearance(of: app.descendants(matching: .any)["editorLoadingOverlay"], timeout: Self.timeout),
            app.debugDescription
        )
        return app
    }

    private static let exists = NSPredicate(format: "exists == true")

    /// ショートカットを送り、`predicate`が成り立つまで待つ。成り立たなければ送り直す。
    ///
    /// メニューの項目は、`webReady`や`commandState`がSwiftUIのメニューへ反映されるまで選べず、
    /// その間に押したキーはWebViewへ落ちて捨てられる。XCUITestからメニューの状態は読めないため、
    /// 期待した変化が起きないときだけ送り直す。どの操作も、アプリ内のダイアログや保存画面などを
    /// 出している間は重ねて実行されないので、遅れて届いても二重には開かない。
    private func typeShortcut(
        _ key: String,
        _ modifiers: XCUIElement.KeyModifierFlags,
        in app: XCUIApplication,
        until predicate: NSPredicate,
        on object: Any,
        attempts: Int = 4
    ) -> Bool {
        for _ in 0..<attempts {
            app.typeKey(key, modifierFlags: modifiers)
            let reached = XCTNSPredicateExpectation(predicate: predicate, object: object)
            if XCTWaiter.wait(for: [reached], timeout: Self.timeout / Double(attempts)) == .completed { return true }
        }
        return false
    }

    /// ⌘Nで新しい編み図を作り、空の盤面を返す。
    @discardableResult
    private func createEmptyDocument(named name: String, in app: XCUIApplication) -> XCUIElement {
        let field = app.textFields["入力"]
        XCTAssertTrue(typeShortcut("n", .command, in: app, until: Self.exists, on: field), "⌘Nでダイアログが出ない: \(app.debugDescription)")
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

    /// ⌘Nのダイアログの入力欄で文字を打ち、⌘Zで取り消し、⇧⌘Zでやり直してから閉じる。
    private func assertTypingUndoAndRedo(in app: XCUIApplication) {
        let field = app.textFields["入力"]
        XCTAssertTrue(typeShortcut("n", .command, in: app, until: Self.exists, on: field), "⌘Nでダイアログが出ない: \(app.debugDescription)")
        let initial = "新しい編み図"
        XCTAssertTrue(waitForValue(of: field, toBe: initial, timeout: Self.timeout), app.debugDescription)
        // ページから当てたフォーカスだけではキー入力が届かないため、入力欄を叩いてから打つ。
        // 開いた直後は値全体が選ばれており、叩いた後も選択が残れば打った文字で置き換わる。
        field.tap()
        field.typeText("abc")
        let entered = XCTNSPredicateExpectation(predicate: NSPredicate(format: "value CONTAINS %@", "abc"), object: field)
        XCTAssertEqual(XCTWaiter.wait(for: [entered], timeout: Self.timeout), .completed, "入力できない: \(field.debugDescription)")
        let typed = (field.value as? String) ?? ""

        // 入力欄にフォーカスがあることがメニューへ届くまで、キーは捨てられうる。変わらないときだけ送り直す。
        XCTAssertTrue(
            typeShortcut("z", .command, in: app, until: NSPredicate(format: "value != %@", typed), on: field),
            "⌘Zで入力中の文字が戻らない: \(field.debugDescription)"
        )
        let afterUndo = (field.value as? String) ?? ""
        XCTAssertTrue(
            afterUndo == initial || typed.hasPrefix(afterUndo),
            "戻し方が違う: \(afterUndo)"
        )

        XCTAssertTrue(
            typeShortcut("z", [.command, .shift], in: app, until: NSPredicate(format: "value == %@", typed), on: field),
            "⇧⌘Zで入力中の文字をやり直せない: \(field.debugDescription)"
        )

        app.buttons["キャンセル"].tap()
        XCTAssertTrue(waitForDisappearance(of: field, timeout: Self.timeout), app.debugDescription)
    }

    private func waitForValue(of field: XCUIElement, toBe value: String, timeout: TimeInterval) -> Bool {
        let reached = XCTNSPredicateExpectation(predicate: NSPredicate(format: "value == %@", value), object: field)
        return XCTWaiter.wait(for: [reached], timeout: timeout) == .completed
    }

    /// 盤面の履歴を⌘Z・⇧⌘Zで1件動かす。
    ///
    /// キーを押す前に、画面のボタンが選べる状態（メニューへ`commandState`を送った後）になるのを待つ。
    /// 高負荷のSimulatorではキー入力そのものが届かないことがあったため、記号数が変わらないときに
    /// 限って押し直す。二重に実行されて行き過ぎたときは押し直さず、呼び出し側の確認で失敗させる。
    private func typeHistoryKey(
        _ modifiers: XCUIElement.KeyModifierFlags,
        from before: Int,
        to after: Int,
        on canvas: XCUIElement,
        in app: XCUIApplication
    ) {
        let button = app.buttons[modifiers.contains(.shift) ? "やり直す" : "元に戻す"]
        let enabled = XCTNSPredicateExpectation(predicate: NSPredicate(format: "isEnabled == true"), object: button)
        XCTAssertEqual(XCTWaiter.wait(for: [enabled], timeout: Self.timeout), .completed, app.debugDescription)
        for _ in 0..<3 {
            app.typeKey("z", modifierFlags: modifiers)
            let reached = XCTNSPredicateExpectation(
                predicate: NSPredicate(format: "label CONTAINS %@", "記号\(after)個"),
                object: canvas
            )
            if XCTWaiter.wait(for: [reached], timeout: 15) == .completed { return }
            guard canvas.label.contains("記号\(before)個") else { break }
        }
        XCTFail("記号が\(before)個から\(after)個にならない: \(canvas.label)")
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
