import UIKit
import XCTest

/// iPadにハードウェアキーボードをつないだときの、メニューバーのショートカットを確かめる。
///
/// `typeKey(_:modifierFlags:)`はハードウェアキーボードのキー入力を送るため、
/// ソフトウェアキーボードを経由せずにメニューのショートカットへ届く。
@MainActor
final class KeyboardCommandUITests: XCTestCase {
    private static let timeout: TimeInterval = KnittingEditorUITests.editorAppearanceTimeout
    private static let shortcutAttemptTimeout: TimeInterval = 8

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

    /// 範囲を選んでDeleteキーを押すと、画面の「消去」と同じく選んだ範囲の記号と線が消え、
    /// ⌘Z1回でまとめて戻る（#428）。同じキー入力で消去が2回実行されると、
    /// 消去の通知が2回出たり、履歴が2件進んだりする。
    func testDeleteKeyErasesSelectionAsOneHistoryStep() {
        let app = launchEditor()
        let canvas = createEmptyDocument(named: "Deleteキー消去", in: app)
        placeThreeStitchesAndSelectRange(on: canvas, in: app)

        // メニューの項目がWebの状態を反映するまで、キーは捨てられうる。消えるまで送り直す。
        XCTAssertTrue(
            typeDelete(in: app, until: NSPredicate(format: "label CONTAINS %@", "記号0個"), on: canvas),
            "Deleteで選択範囲が消えない: \(canvas.label)"
        )
        waitForStitchCount(0, on: canvas, in: app)
        // 1回目の消去のあとにもう一度実行されていれば、消すものが無いという通知が出る。
        XCTAssertFalse(app.staticTexts["選択範囲に消すものがありません"].exists, app.debugDescription)

        // 1回の⌘Zで、消した3個がまとめて戻る。
        typeHistoryKey([.command], from: 0, to: 3, on: canvas, in: app)
        assertStitchCountStays(3, on: canvas, in: app)
    }

    /// 範囲を選んだまま、モーダルではない入力欄（盤面パネルの「段数」）にフォーカスして
    /// Deleteキーを押す。メニューの「選んだ範囲を消去」が入力欄でも有効なままだと、盤面の
    /// 選択範囲が消えてしまう。入力欄の文字だけが1文字消え、盤面は変わらないことを確かめる（#428）。
    func testDeleteKeyInNonModalTextFieldDeletesOneCharacterAndKeepsSelection() {
        let app = launchEditor(disableAnimations: true)
        let canvas = createEmptyDocument(named: "Deleteキー盤面設定", in: app)
        placeThreeStitchesAndSelectRange(on: canvas, in: app)

        app.buttons["盤面"].tap()
        let rows = app.textFields["段数"]
        XCTAssertTrue(rows.waitForExistence(timeout: Self.timeout), app.debugDescription)
        let before = (rows.value as? String) ?? ""
        // 末尾側を叩いて、キャレットを値の後ろへ置く（`replaceText`と同じ扱い）。
        rows.coordinate(withNormalizedOffset: CGVector(dx: 0.95, dy: 0.5)).tap()

        // 入力欄にフォーカスがあることがメニューへ届くまでの間だけ、キーを送り直す。
        XCTAssertTrue(
            typeDelete(in: app, until: NSPredicate(format: "value != %@", before), on: rows),
            "Deleteで入力中の文字が消えない: \(rows.debugDescription)"
        )
        let after = (rows.value as? String) ?? ""
        XCTAssertEqual(after, String(before.dropLast()), "Deleteは入力欄の文字を1文字だけ消す: \(rows.debugDescription)")

        // 盤面の大きさは変えない。値を戻してから閉じ、選択範囲が消えていないことを確かめる。
        replaceText(before, in: rows, app: app)
        app.buttons["閉じる"].tap()
        XCTAssertTrue(waitForDisappearance(of: rows, timeout: Self.timeout), app.debugDescription)
        waitForStitchCount(3, on: canvas, in: app)
        assertStitchCountStays(3, on: canvas, in: app)
    }

    /// ⌘Nのダイアログの入力欄でDeleteキーを押すと、盤面ではなく入力中の文字が1文字消える。
    /// ダイアログは`aria-modal`で、範囲を選んでいなくてもメニューは無効になるため、ここで
    /// 確かめるのは入力欄へのキー配送と、ダイアログ表示中に盤面を書き換えないことである
    /// （範囲あり＋モーダルでない入力欄の危険なケースは、上のテストで確かめる）。
    func testDeleteKeyInDialogTextFieldDeletesOnlyOneCharacter() {
        let app = launchEditor(disableAnimations: true)
        let canvas = createEmptyDocument(named: "Deleteキー入力欄", in: app)
        canvas.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
        waitForStitchCount(1, on: canvas, in: app)

        let field = app.textFields["入力"]
        XCTAssertTrue(typeShortcut("n", .command, in: app, until: Self.exists, on: field), "⌘Nでダイアログが出ない: \(app.debugDescription)")
        let initial = "新しい編み図"
        XCTAssertTrue(waitForValue(of: field, toBe: initial, timeout: Self.timeout), app.debugDescription)
        field.tap()
        field.typeText("abc")
        let entered = XCTNSPredicateExpectation(predicate: NSPredicate(format: "value CONTAINS %@", "abc"), object: field)
        XCTAssertEqual(XCTWaiter.wait(for: [entered], timeout: Self.timeout), .completed, "入力できない: \(field.debugDescription)")
        let typed = (field.value as? String) ?? ""

        // 入力欄にフォーカスがあることがメニューへ届くまでの間だけ、キーを送り直す。
        XCTAssertTrue(
            typeDelete(in: app, until: NSPredicate(format: "value != %@", typed), on: field),
            "Deleteで入力中の文字が消えない: \(field.debugDescription)"
        )
        // 入力欄のどこにキャレットがあっても、Deleteは1文字だけ消す。
        let afterDelete = (field.value as? String) ?? ""
        XCTAssertEqual(afterDelete.count, typed.count - 1, "Deleteは1文字だけ消す: \(field.debugDescription)")
        // ダイアログ（`aria-modal`）を開いている間は、後ろの盤面がアクセシビリティの木に出ない。
        // 閉じてから、盤面が消えていないことを確かめる。
        app.buttons["キャンセル"].tap()
        XCTAssertTrue(waitForDisappearance(of: field, timeout: Self.timeout), app.debugDescription)
        waitForStitchCount(1, on: canvas, in: app)
    }

    /// 入力欄で文字を打っている間の⌘Z・⇧⌘Zは、盤面ではなく入力中の文字を取り消し・やり直す。
    /// 標準の「取り消す」をメニューで置き換えたため、盤面に戻せる編集が無いときもメニューを通す。
    func testUndoAndRedoShortcutsEditTextFieldInsteadOfBoard() {
        let app = launchEditor(disableAnimations: true)

        // 盤面に戻せる編集が無いとき。起動直後は履歴が空。
        XCTAssertFalse(app.buttons["元に戻す"].isEnabled, app.debugDescription)
        assertTypingUndoAndRedo(in: app)
        XCTAssertFalse(app.buttons["元に戻す"].isEnabled, app.debugDescription)

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
            // run 41401344226ではアラート消失後のキー8回がSpringBoardの
            // SBMainSwitcherWindowへ届き、アプリには届かなかった（#44）。
            // 消失だけで入力先が戻ったとみなさず、盤面を変えない見出しを叩いてから次のキーを送る。
            app.webViews.firstMatch.staticTexts["棒針編み図エディタ"].firstMatch.tap()
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

    /// ハードウェアキーボードのショートカットが、押した最初の1回で効くかをSimulatorで測る（#303）。
    ///
    /// 実機のiPadにキーボードをつないだ確認（#501）の前段として、SimulatorのXCUITestが送るキーで測る。
    /// 実機のハードウェアキーボードでの確認の代わりにはならない。
    /// キーは送り直さず、1回目で期待する変化が出た回だけを数える。1回目で出ないときは、
    /// アプリがまったく反応しない状態かを見分けるためにもう1回だけ送る。
    /// 100%でなくてもテストは成功させ、結果を`FIRST_PRESS`の行と添付に残す。
    ///
    /// 実行例:
    ///     TEST_RUNNER_KNITTING_EDITOR_KEYBOARD_FIRST_PRESS=1 \
    ///     TEST_RUNNER_KNITTING_EDITOR_KEYBOARD_FIRST_PRESS_RUNS=10 \
    ///     xcodebuild test ... \
    ///       -only-testing:knittingEditorUITests/KeyboardCommandUITests/testShortcutsTakeEffectOnFirstPress
    ///
    /// 起動直後の状況では、編集画面が準備できてから最初のキーまで1.0秒だけ固定で待つ。
    /// 編集後の状況では待たずに押す。
    func testShortcutsTakeEffectOnFirstPress() throws {
        try XCTSkipUnless(
            ProcessInfo.processInfo.environment["KNITTING_EDITOR_KEYBOARD_FIRST_PRESS"] == "1",
            "手動計測用。TEST_RUNNER_KNITTING_EDITOR_KEYBOARD_FIRST_PRESS=1を付けて実行する"
        )
        let environment = ProcessInfo.processInfo.environment
        let runs = max(1, Int(environment["KNITTING_EDITOR_KEYBOARD_FIRST_PRESS_RUNS"] ?? "") ?? 5)
        // 1回の計測には起動と2つの状況がある。CIの既定（240秒）では足りないため、
        // 実行する回数に合わせて上限を広げる（このテストは環境変数があるときだけ動く）。
        executionTimeAllowance = TimeInterval(max(900, runs * 240))

        let record = FirstPressRecord()
        var failure: String?
        let suffix = UUID().uuidString.prefix(8)
        // 途中のassertでテストが止まっても、それまでの集計表と添付を残す。
        addTeardownBlock {
            self.addFirstPressSummary(record, runs: runs)
        }

        for run in 1...runs {
            let app = launchEditor()
            let canvas = editorCanvas(in: app)
            XCTAssertTrue(canvas.waitForExistence(timeout: Self.timeout), app.debugDescription)
            // 起動直後の状況だけ、編集画面が準備できてから最初のキーまで固定で1.0秒待つ。
            Thread.sleep(forTimeInterval: Self.firstPressSettleTime)
            if let action = measureFirstPresses(
                .afterLaunch,
                run: run,
                app: app,
                canvas: canvas,
                seedHistory: true,
                record: record
            ) {
                failure = "\(run)回目の起動直後、\(action.shortcut)が2回押しても効かない"
                app.terminate()
                break
            }

            let editedCanvas = prepareAfterEditing(in: app, run: run, suffix: suffix)
            if let action = measureFirstPresses(
                .afterEditing,
                run: run,
                app: app,
                canvas: editedCanvas,
                seedHistory: false,
                record: record
            ) {
                failure = "\(run)回目の編集後、\(action.shortcut)が2回押しても効かない"
                app.terminate()
                break
            }
            app.terminate()
        }

        if let failure {
            XCTFail(failure)
        }
    }

    /// 途中で終わった回でも結果を残せるよう、`addTeardownBlock`から集計表と添付を出す。
    private func addFirstPressSummary(_ record: FirstPressRecord, runs: Int) {
        // 添付やログは公開され得るため、利用者が付けた端末名ではなくSimulator名か機種名を残す。
        let device = ProcessInfo.processInfo.environment["SIMULATOR_DEVICE_NAME"] ?? UIDevice.current.model
        var summary = [
            "FIRST_PRESS 結果 device=\(device) os=\(UIDevice.current.systemVersion) " +
                "runs=\(runs) settle=\(Self.firstPressSettleTime)秒(起動直後のみ)",
            "FIRST_PRESS 注: 試行0は未計測（途中で終了した場合）",
            "FIRST_PRESS 状況,ショートカット,1回目成功,試行,2回目で反応",
        ]
        for situation in FirstPressSituation.allCases {
            for action in Self.measuredActions {
                let tally = record.tallies[FirstPressKey(situation: situation, action: action)] ?? FirstPressTally()
                summary.append(
                    "FIRST_PRESS \(situation.rawValue),\(action.shortcut)," +
                        "\(tally.firstPressSuccesses),\(tally.attempts),\(tally.retried)"
                )
            }
        }
        for line in summary { print(line) }

        let attachment = XCTAttachment(string: (summary + record.lines).joined(separator: "\n"))
        attachment.name = "FIRST_PRESS summary"
        attachment.lifetime = .keepAlways
        add(attachment)
    }

    // MARK: - 最初の1回の計測

    /// 編集画面が準備できてから、最初のキーを送るまでの固定の待ち。
    private static let firstPressSettleTime: TimeInterval = 1.0

    private enum FirstPressSituation: String, CaseIterable, Hashable {
        case afterLaunch = "起動直後"
        case afterEditing = "編集後"
    }

    /// 測る順番。⌘Oを最初のキーとして押す。⌘Z・⇧⌘Zは、履歴が無い起動直後でも効くよう、
    /// 押す直前に記号を1個だけ置く（`seedHistory`）。
    private static let measuredActions: [FirstPressAction] = [
        .restore,
        .newDocument,
        .exportBackup,
        .exportAllBackup,
        .exportPng,
        .exportPdf,
        .undo,
        .redo,
        .guide,
    ]

    private enum FirstPressAction: String, Hashable {
        case restore
        case newDocument
        case exportBackup
        case exportAllBackup
        case exportPng
        case exportPdf
        case undo
        case redo
        case guide

        /// ログと表に出す表記。
        var shortcut: String {
            switch self {
            case .restore: return "⌘O"
            case .newDocument: return "⌘N"
            case .exportBackup: return "⌘S"
            case .exportAllBackup: return "⌥⌘S"
            case .exportPng: return "⇧⌘E"
            case .exportPdf: return "⌘P"
            case .undo: return "⌘Z"
            case .redo: return "⇧⌘Z"
            case .guide: return "⇧⌘H"
            }
        }

        var key: String {
            switch self {
            case .restore: return "o"
            case .newDocument: return "n"
            case .exportBackup, .exportAllBackup: return "s"
            case .exportPng: return "e"
            case .exportPdf: return "p"
            case .undo, .redo: return "z"
            case .guide: return "h"
            }
        }

        var modifiers: XCUIElement.KeyModifierFlags {
            switch self {
            case .restore, .newDocument, .exportBackup, .exportPdf, .undo:
                return .command
            case .exportAllBackup:
                return [.command, .option]
            case .exportPng, .redo, .guide:
                return [.command, .shift]
            }
        }

        /// 「ファイルを保存」の確認を出す書き出し。押す前に、前の確認が残っていないことを確かめる。
        var isExport: Bool {
            switch self {
            case .exportBackup, .exportAllBackup, .exportPng, .exportPdf:
                return true
            default:
                return false
            }
        }
    }

    private enum FirstPressOutcome {
        case firstPress
        case retry
        case noReaction

        var label: String {
            switch self {
            case .firstPress: return "1回目で反応"
            case .retry: return "2回目で反応"
            case .noReaction: return "2回とも反応なし"
            }
        }
    }

    private struct FirstPressKey: Hashable {
        let situation: FirstPressSituation
        let action: FirstPressAction
    }

    /// 計測中の集計。`addTeardownBlock`のクロージャ（`@Sendable`）から読むため参照型にする。
    /// XCTestはテストメソッドと後片付けを同じスレッドで順に呼ぶので、同時には触られない。
    private final class FirstPressRecord: @unchecked Sendable {
        var tallies: [FirstPressKey: FirstPressTally] = [:]
        var lines: [String] = []
    }

    private struct FirstPressTally {
        var attempts = 0
        var firstPressSuccesses = 0
        var retried = 0

        mutating func record(_ outcome: FirstPressOutcome) {
            attempts += 1
            switch outcome {
            case .firstPress: firstPressSuccesses += 1
            case .retry: retried += 1
            case .noReaction: break
            }
        }
    }

    private struct FirstPressProbe {
        let predicate: NSPredicate
        let object: Any
    }

    /// 1つの状況で、対象のショートカットを順番に1回だけ押して測る。
    /// アプリがまったく反応しなかったショートカットを返す（そのときテストは失敗する）。
    private func measureFirstPresses(
        _ situation: FirstPressSituation,
        run: Int,
        app: XCUIApplication,
        canvas: XCUIElement,
        seedHistory: Bool,
        record: FirstPressRecord
    ) -> FirstPressAction? {
        var historySeeded = !seedHistory
        for action in Self.measuredActions {
            if action == .undo {
                if !historySeeded {
                    placeSymbols(1, on: canvas, startingAt: CGVector(dx: 0.85, dy: 0.25))
                    historySeeded = true
                }
                waitForHistoryButton(action, in: app)
            }
            if action == .redo {
                waitForHistoryButton(action, in: app)
            }
            // 使い方は、押す前にアプリが保存を待つ（`guideNavigation.ts`）。保存待ちで
            // 開かない回をキーの失敗と数えないよう、保存済みになってから押す。
            if action == .guide {
                waitForDocumentSaved(before: action.shortcut, in: app)
            }

            // 書き出しは、前の保存画面が閉じていることを押す前に確かめる。閉じ損ねた
            // アラートが残っていると、その存在を1回目の反応と誤認する。
            if action.isExport {
                XCTAssertFalse(
                    app.alerts["ファイルを保存"].exists,
                    "前の書き出しの保存画面が閉じていないため、\(action.shortcut)の1回目を測れない: " +
                        "\(app.debugDescription)"
                )
            }

            let probe = makeProbe(for: action, app: app, canvas: canvas)
            let outcome: FirstPressOutcome
            if pressOnce(action, in: app, probe: probe) {
                outcome = .firstPress
            } else if pressOnce(action, in: app, probe: probe) {
                outcome = .retry
            } else {
                outcome = .noReaction
            }

            let key = FirstPressKey(situation: situation, action: action)
            record.tallies[key, default: FirstPressTally()].record(outcome)
            let line = "FIRST_PRESS run=\(run) situation=\(situation.rawValue) " +
                "shortcut=\(action.shortcut) outcome=\(outcome.label)"
            record.lines.append(line)
            print(line)

            if outcome == .noReaction {
                add(screenshot(named: "FIRST_PRESS失敗-\(run)-\(situation.rawValue)-\(action.shortcut)"))
                let state = XCTAttachment(string:
                    "FIRST_PRESS failure run=\(run) situation=\(situation.rawValue) " +
                        "shortcut=\(action.shortcut) state=\(app.state.rawValue)\n\(app.debugDescription)"
                )
                state.name = "FIRST_PRESS失敗時の状態-\(run)-\(situation.rawValue)-\(action.shortcut)"
                state.lifetime = .keepAlways
                add(state)
                return action
            }

            // 編集後の最後のショートカットのあとは、次の計測のためにアプリを終了する。
            if action == .guide && situation == .afterEditing { break }
            reset(action, in: app)
        }
        return nil
    }

    /// 1回目のキーを送り、`probe`が成り立つまで待つ。送り直しはしない。
    private func pressOnce(_ action: FirstPressAction, in app: XCUIApplication, probe: FirstPressProbe) -> Bool {
        app.typeKey(action.key, modifierFlags: action.modifiers)
        let reached = XCTNSPredicateExpectation(predicate: probe.predicate, object: probe.object)
        return XCTWaiter.wait(for: [reached], timeout: Self.shortcutAttemptTimeout) == .completed
    }

    private func makeProbe(
        for action: FirstPressAction,
        app: XCUIApplication,
        canvas: XCUIElement
    ) -> FirstPressProbe {
        switch action {
        case .restore:
            return FirstPressProbe(
                predicate: NSPredicate(format: "exists == true"),
                object: SystemSheet.element(in: app)
            )
        case .newDocument:
            return FirstPressProbe(
                predicate: NSPredicate(format: "exists == true"),
                object: app.textFields["入力"]
            )
        case .exportBackup, .exportAllBackup, .exportPng, .exportPdf:
            // アラートのメッセージ（ファイル名）まで確かめる。同じアラートが残っているだけの
            // 状態や、別の書き出しのアラートを反応と数えない。
            let alert = app.alerts["ファイルを保存"]
            let filename = alert.staticTexts.matching(Self.filenamePredicate(for: action)).firstMatch
            return FirstPressProbe(
                predicate: NSPredicate(format: "exists == true"),
                object: filename
            )
        case .undo, .redo:
            // 1回のキーで履歴が1件だけ戻る・進むことを、記号数で確かめる。
            let before = stitchCount(of: canvas)
            let after = action == .undo ? before - 1 : before + 1
            return FirstPressProbe(
                predicate: NSPredicate(format: "label CONTAINS %@", "記号\(after)個"),
                object: canvas
            )
        case .guide:
            return FirstPressProbe(
                predicate: NSPredicate(format: "exists == true"),
                object: app.webViews.firstMatch.staticTexts["棒針編み図の作り方"].firstMatch
            )
        }
    }

    /// 書き出しの保存画面に出るファイル名。既存の`testFileAndHelpShortcutsOpenEditorActions`と
    /// 同じく、現在の編み図名は起動直後に分からないため、⌘Sは拡張子で、全データは固定名で確かめる。
    private static func filenamePredicate(for action: FirstPressAction) -> NSPredicate {
        switch action {
        case .exportBackup:
            return NSPredicate(format: "label ENDSWITH %@", ".knit")
        case .exportAllBackup:
            return NSPredicate(format: "label == %@", "knitting-editor-backup.knit")
        case .exportPng:
            return NSPredicate(format: "label ENDSWITH %@", ".png")
        case .exportPdf:
            return NSPredicate(format: "label ENDSWITH %@", ".pdf")
        default:
            return NSPredicate(value: false)
        }
    }

    /// 1つのショートカットが開いたダイアログやシートを閉じ、次のキーをアプリへ戻す。
    /// 閉じられなかったまま次を測ると、キーが閉じ損ねた画面に吸われて誤った結果になるため、
    /// どれも閉じた・戻れたことを確かめ、できなければその場で失敗にする（使い方ページは1回、
    /// ほかは3回まで試す）。
    private func reset(_ action: FirstPressAction, in app: XCUIApplication) {
        switch action {
        case .restore:
            XCTAssertTrue(
                dismissSystemSheet(in: app),
                "⌘Oで開いた選択画面を閉じられない: \(app.debugDescription)"
            )
            focusEditor(in: app)
        case .newDocument:
            let field = app.textFields["入力"]
            for _ in 0..<3 where field.exists {
                let cancel = app.buttons["キャンセル"]
                if cancel.exists && cancel.isHittable { cancel.tap() }
                if waitForDisappearance(of: field, timeout: 5) { break }
            }
            XCTAssertTrue(
                waitForDisappearance(of: field, timeout: 5),
                "⌘Nのダイアログを閉じられない: \(app.debugDescription)"
            )
            focusEditor(in: app)
        case .exportBackup, .exportAllBackup, .exportPng, .exportPdf:
            let alert = app.alerts["ファイルを保存"]
            for _ in 0..<3 where alert.exists {
                let cancel = alert.buttons["キャンセル"]
                if cancel.exists && cancel.isHittable { cancel.tap() }
                if waitForDisappearance(of: alert, timeout: 5) { break }
            }
            XCTAssertTrue(
                waitForDisappearance(of: alert, timeout: 5),
                "書き出しの保存画面を閉じられない: \(app.debugDescription)"
            )
            focusEditor(in: app)
        case .undo, .redo:
            // 盤面の状態だけを変える。⌘Zの効果は次の⇧⌘Zで戻す。
            break
        case .guide:
            XCTAssertTrue(
                returnFromGuide(in: app),
                "使い方ページから編集画面へ戻れない: \(app.debugDescription)"
            )
        }
    }

    /// ⌘Oで開いたシステムの選択画面を閉じる。
    ///
    /// 閉じるボタンは、押せると判定した直後に消えることがある（#44）。`tap()`は対象が
    /// 消えているとその場でテストを失敗にするため、枠を`snapshot()`で取り、その中心を
    /// 座標で押す。枠が取れなければ画面の下スワイプへ落とし、3回まで試す。
    private func dismissSystemSheet(in app: XCUIApplication) -> Bool {
        let sheet = SystemSheet.element(in: app)
        for _ in 0..<3 where sheet.exists {
            let close = SystemSheet.closeButton(in: app)
            let closeExists = close.waitForExistence(timeout: 2)
            let closeHittable = closeExists && close.isHittable
            let closeFrame = closeHittable ? (try? close.snapshot())?.frame : nil
            if let closeFrame, !closeFrame.isEmpty {
                app.coordinate(withNormalizedOffset: .zero)
                    .withOffset(CGVector(dx: closeFrame.midX, dy: closeFrame.midY))
                    .tap()
                if waitForDisappearance(of: sheet, timeout: 5) { return true }
            }
            app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.15)).press(
                forDuration: 0.05,
                thenDragTo: app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.98)),
                withVelocity: .default,
                thenHoldForDuration: 0.0
            )
            if waitForDisappearance(of: sheet, timeout: 5) { return true }
        }
        return !sheet.exists
    }

    /// 編み図を新しく作り、記号を3個置いて「盤面」パネルを開閉する。
    /// ショートカットを押す前の、編集を続けた状態にする。
    private func prepareAfterEditing(in app: XCUIApplication, run: Int, suffix: Substring) -> XCUIElement {
        let canvas = createEmptyDocument(named: "初回押下-\(suffix)-\(run)", in: app)
        placeSymbols(3, on: canvas)

        let boardPanel = app.buttons["盤面"]
        XCTAssertTrue(boardPanel.waitForExistence(timeout: Self.timeout), app.debugDescription)
        boardPanel.tap()
        let rows = app.textFields["段数"]
        XCTAssertTrue(rows.waitForExistence(timeout: Self.timeout), "盤面パネルが開かない: \(app.debugDescription)")
        app.buttons["閉じる"].tap()
        XCTAssertTrue(waitForDisappearance(of: rows, timeout: Self.timeout), app.debugDescription)
        return canvas
    }

    /// 盤面の空いているマスに記号を置く。埋まっているマスでは記号数が変わらないため、別の位置を試す。
    /// `startingAt`は、履歴を作るために1個だけ置くときの位置。編集後の状況で使う位置とは分け、
    /// 前回の編み図が復元されていても空いている可能性を高くする。
    private func placeSymbols(_ count: Int, on canvas: XCUIElement, startingAt preferred: CGVector? = nil) {
        var positions: [CGVector] = []
        if let preferred { positions.append(preferred) }
        positions += [
            CGVector(dx: 0.35, dy: 0.35),
            CGVector(dx: 0.40, dy: 0.50),
            CGVector(dx: 0.50, dy: 0.50),
            CGVector(dx: 0.60, dy: 0.50),
            CGVector(dx: 0.65, dy: 0.65),
            CGVector(dx: 0.30, dy: 0.70),
            CGVector(dx: 0.20, dy: 0.20),
            CGVector(dx: 0.80, dy: 0.30),
            CGVector(dx: 0.25, dy: 0.80),
            CGVector(dx: 0.75, dy: 0.75),
            CGVector(dx: 0.15, dy: 0.50),
            CGVector(dx: 0.85, dy: 0.50),
        ]
        var placed = 0
        for position in positions where placed < count {
            let before = stitchCount(of: canvas)
            canvas.coordinate(withNormalizedOffset: position).tap()
            let changed = XCTNSPredicateExpectation(
                predicate: NSPredicate(format: "NOT (label CONTAINS %@)", "記号\(before)個"),
                object: canvas
            )
            if XCTWaiter.wait(for: [changed], timeout: 5) == .completed {
                placed += 1
            }
        }
        XCTAssertEqual(placed, count, "記号を\(count)個置けない: \(canvas.label)")
    }

    /// 盤面の読み上げ用ラベルから記号数を読む（「…、記号3個、…」）。
    private func stitchCount(of canvas: XCUIElement) -> Int {
        let label = canvas.label
        guard let range = label.range(of: #"記号\d+個"#, options: .regularExpression) else { return 0 }
        return Int(label[range].filter(\.isNumber)) ?? 0
    }

    /// ヘッダーの保存状態が「保存済み」になり、「保存中」が消えるまで待つ。
    /// 自動保存が「保存失敗」になったときは、`timeout`まで待たずにその場で止める。
    private func waitForDocumentSaved(before shortcut: String, in app: XCUIApplication) {
        let webView = app.webViews.firstMatch
        let saved = webView.staticTexts
            .matching(NSPredicate(format: "label ENDSWITH %@", "保存済み"))
            .firstMatch
        let failed = webView.staticTexts
            .matching(NSPredicate(format: "label ENDSWITH %@", "保存失敗"))
            .firstMatch
        let saving = webView.staticTexts
            .matching(NSPredicate(format: "label CONTAINS %@", "保存中"))
            .firstMatch
        // 状態は読み上げ用に「、保存済み」のように読点が付くので終わりで照合する
        // （「保存済みブロックはありません。」には一致しない）。
        var saveState = ""
        let deadline = Date().addingTimeInterval(Self.timeout)
        while Date() < deadline {
            if failed.exists {
                saveState = "保存失敗"
                break
            }
            if saved.exists {
                saveState = "保存済み"
                break
            }
            _ = saved.waitForExistence(timeout: 0.5)
        }
        guard saveState == "保存済み" else {
            add(screenshot(named: "保存の完了を確認できない-\(shortcut)"))
            let seen = saveState.isEmpty ? "なし" : saveState
            if saveState == "保存失敗" {
                XCTFail("保存に失敗したため\(shortcut)を測れない（見えた状態: \(seen)）: \(app.debugDescription)")
            } else {
                XCTFail("保存の完了を確認できないため\(shortcut)を測れない（見えた状態: \(seen)）: \(app.debugDescription)")
            }
            return
        }
        let notSaving = XCTNSPredicateExpectation(predicate: NSPredicate(format: "exists == false"), object: saving)
        XCTAssertEqual(
            XCTWaiter.wait(for: [notSaving], timeout: Self.timeout),
            .completed,
            "自動保存が完了しない: \(app.debugDescription)"
        )
    }

    /// メニューの「元に戻す」「やり直す」が選べる状態になるまで待つ。
    /// 押す前に待たないと、Webの`commandState`がメニューへ届く前のキーを測ってしまう。
    private func waitForHistoryButton(_ action: FirstPressAction, in app: XCUIApplication) {
        let button = app.buttons[action == .undo ? "元に戻す" : "やり直す"]
        XCTAssertTrue(button.waitForExistence(timeout: Self.timeout), app.debugDescription)
        let enabled = XCTNSPredicateExpectation(predicate: NSPredicate(format: "isEnabled == true"), object: button)
        XCTAssertEqual(
            XCTWaiter.wait(for: [enabled], timeout: Self.timeout),
            .completed,
            "\(button.label)が選べる状態にならない: \(app.debugDescription)"
        )
    }

    private func editorCanvas(in app: XCUIApplication) -> XCUIElement {
        app.webViews.firstMatch.otherElements
            .matching(NSPredicate(format: "label CONTAINS %@", "編み図編集盤面"))
            .firstMatch
    }

    /// シートを閉じたあと、キーがアプリへ戻るよう編集画面の見出しを叩く。
    /// 続けてキーを送るとSpringBoardへ届くことがあるため（#44）。
    private func focusEditor(in app: XCUIApplication) {
        let heading = app.webViews.firstMatch.staticTexts["棒針編み図エディタ"].firstMatch
        if heading.exists && heading.isHittable {
            heading.tap()
        }
    }

    /// 使い方ページの先頭近くにある「編集画面へ戻る」を押し、編集画面が使えるまで待つ。
    private func returnFromGuide(in app: XCUIApplication) -> Bool {
        let back = app.links["編集画面へ戻る"].firstMatch
        guard back.waitForExistence(timeout: 5) else { return false }
        // 先頭のリンクは見出しと導入文のすぐ下にあり、iPadの縦向きではスクロールせずに押せる。
        back.tap()
        let ready = app.buttons["出力"].waitForExistence(timeout: Self.timeout)
        let overlayGone = waitForDisappearance(
            of: app.descendants(matching: .any)["editorLoadingOverlay"],
            timeout: Self.timeout
        )
        return ready && overlayGone
    }

    // MARK: - 補助

    private func launchEditor(disableAnimations: Bool = false) -> XCUIApplication {
        let app = XCUIApplication()
        if disableAnimations { app.launchArguments.append("-uiTestingDisableAnimations") }
        app.launch()
        XCTAssertTrue(app.buttons["出力"].waitForExistence(timeout: Self.timeout), app.debugDescription)
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
    /// CIのSimulatorでは合成したキーがUIKitでショートカットと扱われず、文字入力へ回ることもある。
    /// 再送の機会を増やしつつテスト1件の上限150秒に収めるため、既定は8回、各8秒（計64秒）待つ。
    private func typeShortcut(
        _ key: String,
        _ modifiers: XCUIElement.KeyModifierFlags,
        in app: XCUIApplication,
        until predicate: NSPredicate,
        on object: Any,
        attempts: Int = 8
    ) -> Bool {
        for _ in 0..<attempts {
            app.typeKey(key, modifierFlags: modifiers)
            let reached = XCTNSPredicateExpectation(predicate: predicate, object: object)
            if XCTWaiter.wait(for: [reached], timeout: Self.shortcutAttemptTimeout) == .completed { return true }
        }
        add(screenshot(named: "ショートカット失敗-\(key)-\(modifiers.rawValue)"))
        // 画面写真だけでは、編集画面が残ったのか、アラートや入力欄が残ったのかを追えない。
        // 時刻とPIDを含む要素の木も添え、システムログでキーの配送先を照合できるようにする。
        let state = XCTAttachment(string:
            "時刻=\(Date()) key=\(key) modifiers=\(modifiers.rawValue) 試行=\(attempts) " +
                "state=\(app.state.rawValue)\n\(app.debugDescription)"
        )
        state.name = "ショートカット失敗時の状態-\(key)-\(modifiers.rawValue)"
        state.lifetime = .keepAlways
        add(state)
        return false
    }

    /// Deleteキーを送り、`predicate`が成り立つまで待つ。成り立たなければ送り直す。
    ///
    /// メニューの「選んだ範囲を消去」は、Webの`commandState`がSwiftUIのメニューへ届くまで
    /// 選べず、その間に押したキーはWebViewへ落ちて捨てられる。XCUITestからメニューの状態は
    /// 読めないため、期待した変化が起きないときだけ送り直す。二重に消したときは値や記号数が
    /// 期待と変わるので、呼び出し側の確認で失敗させる。
    private func typeDelete(in app: XCUIApplication, until predicate: NSPredicate, on object: Any, attempts: Int = 4) -> Bool {
        for _ in 0..<attempts {
            // Xcode 27.2の`typeKey`は`XCUIKeyboardKey.delete`（U+007F）をキーに変換できず、何も送らない
            // （testmanagerdのログに`not in the character map`、`Generating events -- []`）。
            // 記号の「⌫」（U+232B）ならハードウェアキーボードのDelete（HIDの0x2A）が送られる。
            app.typeKey("\u{232B}", modifierFlags: [])
            let reached = XCTNSPredicateExpectation(predicate: predicate, object: object)
            if XCTWaiter.wait(for: [reached], timeout: Self.shortcutAttemptTimeout) == .completed { return true }
        }
        add(screenshot(named: "Deleteキー失敗"))
        let state = XCTAttachment(string:
            "時刻=\(Date()) key=Delete 試行=\(attempts) state=\(app.state.rawValue)\n\(app.debugDescription)"
        )
        state.name = "Deleteキー失敗時の状態"
        state.lifetime = .keepAlways
        add(state)
        return false
    }

    /// 隣り合う3マスに記号を置き、「範囲」で囲んで選択範囲の操作帯を出す。
    private func placeThreeStitchesAndSelectRange(on canvas: XCUIElement, in app: XCUIApplication) {
        let cells = [
            CGVector(dx: 0.45, dy: 0.48),
            CGVector(dx: 0.50, dy: 0.48),
            CGVector(dx: 0.55, dy: 0.48),
        ]
        for (index, cell) in cells.enumerated() {
            canvas.coordinate(withNormalizedOffset: cell).tap()
            waitForStitchCount(index + 1, on: canvas, in: app)
        }

        app.switches["範囲"].tap()
        let start = canvas.coordinate(withNormalizedOffset: CGVector(dx: 0.35, dy: 0.40))
        let end = canvas.coordinate(withNormalizedOffset: CGVector(dx: 0.68, dy: 0.60))
        start.press(forDuration: 0.05, thenDragTo: end)
        XCTAssertTrue(
            app.buttons["選択範囲を消去"].waitForExistence(timeout: 10),
            "範囲を選択できない: \(app.debugDescription)"
        )
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
