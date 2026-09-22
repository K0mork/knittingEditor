import XCTest

@MainActor
final class KnittingEditorUITests: XCTestCase {
    /// 手動配置のSplit View・可変ウィンドウを検証する実行では、向きを変えると
    /// 配置が全画面へ戻るため、向きに触れない。
    private var preservesManualWindow: Bool {
        ProcessInfo.processInfo.environment["KNITTING_EDITOR_MANUAL_WINDOW"] == "1"
    }

    /// 実機は起動時に端末の物理的な向きを引き継ぐため、各テストを縦向きから始める。
    override func setUp() {
        super.setUp()
        guard !preservesManualWindow else { return }
        XCUIDevice.shared.orientation = .portrait
    }

    override func tearDown() {
        if !preservesManualWindow {
            XCUIDevice.shared.orientation = .portrait
        }
        super.tearDown()
    }

    func testLaunchShowsLocalEditorContainer() {
        let app = XCUIApplication()
        app.launch()
        XCTAssertTrue(
            app.webViews.firstMatch.waitForExistence(timeout: 15)
                || app.otherElements["knittingEditorWebView"].waitForExistence(timeout: 1),
            "SwiftUI root should expose the local WebView container"
        )
    }

    /// 使い方ページは同梱資産だがReactの`webReady`を送らない。編集画面と同じ
    /// 読み込み表示を出したままにせず、戻ったときに編集画面が再び使えることを確認する。
    func testGuideNavigationReturnsToUsableEditor() {
        let app = XCUIApplication()
        app.launch()

        XCTAssertTrue(app.webViews.firstMatch.waitForExistence(timeout: 15))
        let guideLink = app.links["使い方"]
        XCTAssertTrue(guideLink.waitForExistence(timeout: 15), app.debugDescription)
        guideLink.tap()

        XCTAssertTrue(
            app.webViews.firstMatch.staticTexts["ブラウザで棒針編み図を作る方法"].waitForExistence(timeout: 15),
            app.debugDescription
        )
        XCTAssertFalse(
            app.otherElements["editorLoadingOverlay"].exists,
            "使い方ページで編集画面の読み込み表示を残さない: \(app.debugDescription)"
        )

        app.links["棒針編み図エディタへ戻る"].tap()
        XCTAssertTrue(app.buttons["保存"].waitForExistence(timeout: 20), app.debugDescription)
        XCTAssertFalse(app.otherElements["editorLoadingOverlay"].exists, app.debugDescription)
    }

    /// 2本指ジェスチャで盤面へ記号が入らないことを確認する。
    ///
    /// ほぼ同時に2本指で触れても、先に触れた指の位置へ記号が置かれてしまう不具合があった。
    /// 触れた瞬間に記号を確定していたためで、1本指のタップは指を離すまで保留するようにした。
    func testTwoFingerGestureDoesNotDrawOnBoard() {
        let app = XCUIApplication()
        app.launch()

        XCTAssertTrue(app.webViews.firstMatch.waitForExistence(timeout: 15))
        createDocument(named: "2本指確認", in: app)

        let webView = app.webViews.firstMatch
        let emptyCanvas = webView.otherElements
            .matching(NSPredicate(format: "label CONTAINS %@", "記号0個"))
            .firstMatch
        XCTAssertTrue(emptyCanvas.waitForExistence(timeout: 15), app.debugDescription)

        emptyCanvas.pinch(withScale: 2.0, velocity: 1.0)
        emptyCanvas.pinch(withScale: 0.5, velocity: -1.0)

        // 記号数は0のまま変わらない。増えていれば指の位置へ記号が入っている。
        let stillEmpty = XCTNSPredicateExpectation(
            predicate: NSPredicate(format: "NOT (label CONTAINS %@)", "記号0個"),
            object: emptyCanvas
        )
        XCTAssertEqual(
            XCTWaiter.wait(for: [stillEmpty], timeout: 3),
            .timedOut,
            "2本指ジェスチャで盤面へ記号が入った: \(app.debugDescription)"
        )

        // 1本指のタップでは従来どおり記号を置ける。
        emptyCanvas.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
        XCTAssertTrue(
            webView.otherElements
                .matching(NSPredicate(format: "label CONTAINS %@", "記号1個"))
                .firstMatch
                .waitForExistence(timeout: 10),
            app.debugDescription
        )
    }

    func testSavePanelShowsBackupActions() {
        let app = XCUIApplication()
        app.launch()
        XCTAssertTrue(app.webViews.firstMatch.waitForExistence(timeout: 15))

        let save = app.buttons["保存"]
        XCTAssertTrue(save.waitForExistence(timeout: 15))
        save.tap()

        XCTAssertTrue(app.buttons["この編み図"].waitForExistence(timeout: 15))
        XCTAssertTrue(app.buttons["全データ"].exists)
        XCTAssertTrue(app.buttons["復元"].exists)
    }

    func testEditAndRelaunchRestoresLocalDocument() {
        let app = XCUIApplication()
        app.launch()

        XCTAssertTrue(app.webViews.firstMatch.waitForExistence(timeout: 15))
        let documents = app.buttons["編み図"]
        XCTAssertTrue(documents.waitForExistence(timeout: 15))
        documents.tap()

        let newDocument = app.buttons["新しい編み図"]
        XCTAssertTrue(newDocument.waitForExistence(timeout: 15))
        newDocument.tap()
        let nameField = app.textFields["入力"]
        XCTAssertTrue(nameField.waitForExistence(timeout: 15))
        replaceText("再起動復元テスト", in: nameField, app: app)
        app.buttons["決定"].tap()

        let webView = app.webViews.firstMatch
        let canvas = webView.otherElements
            .matching(NSPredicate(format: "label CONTAINS %@", "記号0個"))
            .firstMatch
        XCTAssertTrue(canvas.waitForExistence(timeout: 10))
        canvas.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()

        let editedCanvas = webView.otherElements
            .matching(NSPredicate(format: "label CONTAINS %@", "記号1個"))
            .firstMatch
        XCTAssertTrue(editedCanvas.waitForExistence(timeout: 10))
        waitForDocumentSave(named: "再起動復元テスト", in: webView)

        app.terminate()
        app.launch()

        let relaunchedWebView = app.webViews.firstMatch
        XCTAssertTrue(relaunchedWebView.waitForExistence(timeout: 15))
        let restoredCanvas = relaunchedWebView.otherElements
            .matching(NSPredicate(format: "label CONTAINS %@", "記号1個"))
            .firstMatch
        XCTAssertTrue(restoredCanvas.waitForExistence(timeout: 10))
    }

    func testDocumentSwitchAutosavesEachDocument() {
        let app = XCUIApplication()
        app.launch()

        XCTAssertTrue(app.webViews.firstMatch.waitForExistence(timeout: 15))
        let documents = app.buttons["編み図"]
        XCTAssertTrue(documents.waitForExistence(timeout: 15))
        documents.tap()

        let newDocument = app.buttons["新しい編み図"]
        XCTAssertTrue(newDocument.waitForExistence(timeout: 15))
        newDocument.tap()
        let nameField = app.textFields["入力"]
        XCTAssertTrue(nameField.waitForExistence(timeout: 15))
        replaceText("M2切替A", in: nameField, app: app)
        app.buttons["決定"].tap()

        let webView = app.webViews.firstMatch
        let emptyCanvas = webView.otherElements
            .matching(NSPredicate(format: "label CONTAINS %@", "記号0個"))
            .firstMatch
        XCTAssertTrue(emptyCanvas.waitForExistence(timeout: 10))
        emptyCanvas.coordinate(withNormalizedOffset: CGVector(dx: 0.35, dy: 0.5)).tap()
        let editedCanvas = webView.otherElements
            .matching(NSPredicate(format: "label CONTAINS %@", "記号1個"))
            .firstMatch
        XCTAssertTrue(editedCanvas.waitForExistence(timeout: 10))
        waitForDocumentSave(named: "M2切替A", in: webView)

        documents.tap()
        newDocument.tap()
        XCTAssertTrue(nameField.waitForExistence(timeout: 15))
        replaceText("M2切替B", in: nameField, app: app)
        app.buttons["決定"].tap()

        let secondEmptyCanvas = webView.otherElements
            .matching(NSPredicate(format: "label CONTAINS %@", "記号0個"))
            .firstMatch
        XCTAssertTrue(secondEmptyCanvas.waitForExistence(timeout: 10))
        secondEmptyCanvas.coordinate(withNormalizedOffset: CGVector(dx: 0.65, dy: 0.5)).tap()
        XCTAssertTrue(
            webView.otherElements
                .matching(NSPredicate(format: "label CONTAINS %@", "記号1個"))
                .firstMatch
                .waitForExistence(timeout: 10)
        )
        waitForDocumentSave(named: "M2切替B", in: webView)
        documents.tap()
        let documentA = app.buttons
            .matching(NSPredicate(format: "label BEGINSWITH %@", "M2切替A"))
            .firstMatch
        XCTAssertTrue(documentA.waitForExistence(timeout: 15))
        documentA.tap()
        XCTAssertTrue(
            webView.otherElements
                .matching(NSPredicate(format: "label CONTAINS %@", "記号1個"))
                .firstMatch
                .waitForExistence(timeout: 10)
        )

        documents.tap()
        let documentB = app.buttons
            .matching(NSPredicate(format: "label BEGINSWITH %@", "M2切替B"))
            .firstMatch
        XCTAssertTrue(documentB.waitForExistence(timeout: 15))
        documentB.tap()
        XCTAssertTrue(
            webView.otherElements
                .matching(NSPredicate(format: "label CONTAINS %@", "記号1個"))
                .firstMatch
                .waitForExistence(timeout: 10)
        )
    }

    /// iPadの全画面以外（Split View・可変ウィンドウ）での操作を検証する。
    ///
    /// ウィンドウ分割はXCUITestから作れないため、手で配置してから次のように実行する。
    /// 配置を壊さないよう、このテストはアプリを起動し直さない。
    ///
    ///     TEST_RUNNER_KNITTING_EDITOR_MANUAL_WINDOW=1 xcodebuild test \
    ///       -only-testing:knittingEditorUITests/KnittingEditorUITests/testManualWindowKeepsPrimaryFlowsUsable ...
    func testManualWindowKeepsPrimaryFlowsUsable() throws {
        try XCTSkipUnless(
            ProcessInfo.processInfo.environment["KNITTING_EDITOR_MANUAL_WINDOW"] == "1",
            "Split View・可変ウィンドウを手で配置したうえで、TEST_RUNNER_KNITTING_EDITOR_MANUAL_WINDOW=1を付けて実行する"
        )
        let app = XCUIApplication()
        if app.state != .runningForeground {
            app.activate()
        }
        XCTAssertTrue(app.webViews.firstMatch.waitForExistence(timeout: 20), app.debugDescription)

        // 配置が失われた状態で実行すると全画面のまま通ってしまうため、
        // 画面より小さいウィンドウであることを先に確認する。
        let window = app.windows.firstMatch.frame
        let screen = XCUIScreen.main.screenshot().image.size
        XCTAssertTrue(
            window.width < screen.width - 1 || window.height < screen.height - 1,
            "Split View・可変ウィンドウの配置になっていない window=\(window) screen=\(screen)"
        )
        // 証跡としてどの大きさで検証したかを残す。
        XCTContext.runActivity(named: "検証したウィンドウ window=\(window) screen=\(screen)") { _ in }

        assertPrimaryControlsAreUsable(in: app)
        assertWithinWindow(app.buttons["編み図"], in: app)

        for panel in ["盤面", "ブロック", "保存"] {
            app.buttons[panel].tap()
            let close = app.buttons["閉じる"]
            XCTAssertTrue(close.waitForExistence(timeout: 10), "\(panel)パネルを開けない window=\(window): \(app.debugDescription)")
            XCTAssertTrue(close.isHittable, "\(panel)パネルを閉じられない window=\(window): \(app.debugDescription)")
            close.tap()
        }

        // 盤面の状態に依存しないよう、空の編み図を作ってから描画を確認する。
        // 小さいウィンドウでのダイアログとキーボード入力もここで通る。
        app.buttons["編み図"].tap()
        let newDocument = app.buttons["新しい編み図"]
        XCTAssertTrue(newDocument.waitForExistence(timeout: 10), app.debugDescription)
        newDocument.tap()
        let nameField = app.textFields["入力"]
        XCTAssertTrue(nameField.waitForExistence(timeout: 10), app.debugDescription)
        replaceText("可変ウィンドウ確認", in: nameField, app: app)
        app.buttons["決定"].tap()

        let canvas = app.webViews.firstMatch.otherElements
            .matching(NSPredicate(format: "label CONTAINS %@", "記号0個"))
            .firstMatch
        XCTAssertTrue(canvas.waitForExistence(timeout: 15), app.debugDescription)
        assertWithinWindow(canvas, in: app)
        canvas.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
        XCTAssertTrue(
            app.webViews.firstMatch.otherElements
                .matching(NSPredicate(format: "label CONTAINS %@", "記号1個"))
                .firstMatch
                .waitForExistence(timeout: 10),
            "可変ウィンドウで盤面へ描画できない window=\(window): \(app.debugDescription)"
        )
    }


    func testSeedDocumentForAppUpdateProbe() throws {
        try requireAppUpdateProbe()
        let app = XCUIApplication()
        let appUpdateElementTimeout: TimeInterval = 60
        app.launch()

        XCTAssertTrue(app.webViews.firstMatch.waitForExistence(timeout: appUpdateElementTimeout))
        let documents = app.buttons["編み図"]
        XCTAssertTrue(documents.waitForExistence(timeout: appUpdateElementTimeout))
        documents.tap()
        let newDocument = app.buttons["新しい編み図"]
        XCTAssertTrue(newDocument.waitForExistence(timeout: appUpdateElementTimeout))
        newDocument.tap()
        let nameField = app.textFields["入力"]
        XCTAssertTrue(nameField.waitForExistence(timeout: appUpdateElementTimeout))
        replaceText("アプリ更新復元fixture", in: nameField, app: app)
        app.buttons["決定"].tap()

        let webView = app.webViews.firstMatch
        let canvas = webView.otherElements
            .matching(NSPredicate(format: "label CONTAINS %@", "記号0個"))
            .firstMatch
        XCTAssertTrue(canvas.waitForExistence(timeout: 10))
        canvas.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
        XCTAssertTrue(
            webView.otherElements
                .matching(NSPredicate(format: "label CONTAINS %@", "記号1個"))
                .firstMatch
                .waitForExistence(timeout: 10)
        )
        waitForDocumentSave(named: "アプリ更新復元fixture", in: webView)
    }

    func testUpdatedAppRestoresSeedDocument() throws {
        try requireAppUpdateProbe()
        let app = XCUIApplication()
        let appUpdateElementTimeout: TimeInterval = 60
        app.launch()

        XCTAssertTrue(app.webViews.firstMatch.waitForExistence(timeout: appUpdateElementTimeout))
        let documents = app.buttons["編み図"]
        XCTAssertTrue(documents.waitForExistence(timeout: appUpdateElementTimeout))
        documents.tap()
        let restoredDocument = app.buttons
            .matching(NSPredicate(format: "label BEGINSWITH %@", "アプリ更新復元fixture"))
            .firstMatch
        XCTAssertTrue(restoredDocument.waitForExistence(timeout: appUpdateElementTimeout), app.debugDescription)
        restoredDocument.tap()

        XCTAssertTrue(
            app.webViews.firstMatch.otherElements
                .matching(NSPredicate(format: "label CONTAINS %@", "記号1個"))
                .firstMatch
                .waitForExistence(timeout: 10),
            app.debugDescription
        )
    }

    /// `.knit`の書き出しがシステムの保存UIまで到達し、閉じたあと編集画面へ戻れることを確認する。
    ///
    /// iOS 27のDocument Pickerは別プロセスのUIで「キャンセル」ボタンを持たず、
    /// 閉じる操作は「<」→「×」か下スワイプである。要素は`isHittable`がfalseで直接タップできないため、
    /// 画面座標の下スワイプで閉じる。シートの有無はidentifier `Cancel`の存在で判定する
    /// （実機で表示中のみ存在し、閉じると消えることを確認済み）。
    func testBackupExportSheetDismissesBackToEditor() throws {
        if ProcessInfo.processInfo.environment["CI"] == "true" {
            throw XCTSkip("Xcode 15.4 CI SimulatorではWebKitがgzipバックアップ生成中に無応答になるため、保存パネル・PNG/PDF導線とローカルSimulatorで検証する")
        }
        let app = XCUIApplication()
        app.launch()

        XCTAssertTrue(app.webViews.firstMatch.waitForExistence(timeout: 15))
        let save = app.buttons["保存"]
        XCTAssertTrue(save.waitForExistence(timeout: 15))
        save.tap()

        let currentDocument = app.buttons["この編み図"]
        XCTAssertTrue(currentDocument.waitForExistence(timeout: 15))
        currentDocument.tap()

        XCTAssertTrue(app.buttons["ファイルに保存"].waitForExistence(timeout: 15))
        XCTAssertTrue(app.buttons["共有"].exists)
        app.buttons["ファイルに保存"].tap()

        let systemSheet = app.descendants(matching: .any).matching(identifier: "Cancel").firstMatch
        XCTAssertTrue(systemSheet.waitForExistence(timeout: 20), app.debugDescription)

        let dismissal = dismissSystemSheet(in: app)

        // 実機のフルスイートでまれに閉じられないことがある。原因究明のため、
        // 失敗時にどの手段まで試したかと画面を必ず残す。
        if systemSheet.exists {
            add(screenshotAttachment(named: "保存シートが閉じない"))
        }
        assertDisappears(systemSheet, from: app, note: dismissal)
        assertBecomesHittable(app.webViews.firstMatch, in: app, note: dismissal)
        XCTAssertEqual(app.state, .runningForeground, "\(dismissal): \(app.debugDescription)")
    }

    func testPngAndPdfExportsReachNativeFileActions() {
        let app = XCUIApplication()
        app.launch()

        XCTAssertTrue(app.webViews.firstMatch.waitForExistence(timeout: 15))
        let save = app.buttons["保存"]
        XCTAssertTrue(save.waitForExistence(timeout: 15))
        save.tap()

        let png = app.buttons["PNGを保存"]
        XCTAssertTrue(png.waitForExistence(timeout: 15))
        png.tap()
        let pngFileSave = app.buttons["ファイルに保存"]
        XCTAssertTrue(pngFileSave.waitForExistence(timeout: 15))
        cancelExportAlert(in: app)

        let pdf = app.buttons["PDFを保存"]
        XCTAssertTrue(pdf.waitForExistence(timeout: 15))
        pdf.tap()
        let pdfFileSave = app.buttons["ファイルに保存"]
        XCTAssertTrue(pdfFileSave.waitForExistence(timeout: 15))
        cancelExportAlert(in: app)
    }

    func testPrimaryControlsRemainUsableInPortraitAndLandscape() {
        let app = XCUIApplication()
        app.launch()

        XCTAssertTrue(app.webViews.firstMatch.waitForExistence(timeout: 15))
        assertPrimaryControlsAreUsable(in: app)

        XCUIDevice.shared.orientation = .landscapeLeft
        XCTAssertTrue(app.windows.firstMatch.waitForExistence(timeout: 5))
        assertPrimaryControlsAreUsable(in: app)

        app.buttons["編み図"].tap()
        XCTAssertTrue(app.buttons["新しい編み図"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.buttons["閉じる"].isHittable, app.debugDescription)
    }

    func testDocumentDialogRemainsUsableWithKeyboardVisible() {
        let app = XCUIApplication()
        app.launch()

        XCTAssertTrue(app.webViews.firstMatch.waitForExistence(timeout: 15))
        let documents = app.buttons["編み図"]
        XCTAssertTrue(documents.waitForExistence(timeout: 15), app.debugDescription)
        documents.tap()
        let newDocument = app.buttons["新しい編み図"]
        XCTAssertTrue(newDocument.waitForExistence(timeout: 10))
        newDocument.tap()

        let nameField = app.textFields["入力"]
        XCTAssertTrue(nameField.waitForExistence(timeout: 10))
        nameField.tap()
        XCTAssertTrue(app.keyboards.firstMatch.waitForExistence(timeout: 5))
        XCTAssertTrue(app.buttons["キャンセル"].isHittable, app.debugDescription)
        XCTAssertTrue(app.buttons["決定"].isHittable, app.debugDescription)
    }

    func testCoreEditorControlsExposeAccessibleNamesAndState() {
        let app = XCUIApplication()
        app.launch()

        let webView = app.webViews.firstMatch
        XCTAssertTrue(webView.waitForExistence(timeout: 15))
        let stitchPicker = app.descendants(matching: .any)
            .matching(NSPredicate(format: "label == %@", "編み目記号を選ぶ"))
            .firstMatch
        XCTAssertTrue(stitchPicker.waitForExistence(timeout: 10))
        XCTAssertEqual(app.switches["描く"].value as? String, "1")
        XCTAssertEqual(app.switches["消す"].value as? String, "0")
        XCTAssertEqual(app.switches["範囲"].value as? String, "0")
        XCTAssertTrue(app.buttons["保存"].exists)

        let canvas = webView.otherElements
            .matching(NSPredicate(format: "label CONTAINS %@", "編み図編集盤面"))
            .firstMatch
        XCTAssertTrue(canvas.waitForExistence(timeout: 10), webView.debugDescription)
        XCTAssertTrue(canvas.label.contains("描画モード"), canvas.debugDescription)
        XCTAssertTrue(webView.staticTexts
            .matching(NSPredicate(format: "label CONTAINS %@", "保存済み"))
            .firstMatch
            .waitForExistence(timeout: 10), webView.debugDescription)
        XCTAssertTrue(webView.staticTexts
            .matching(NSPredicate(format: "label CONTAINS %@", "選択範囲なし"))
            .firstMatch
            .waitForExistence(timeout: 10), webView.debugDescription)

        app.buttons["保存"].tap()
        XCTAssertTrue(app.staticTexts["保存・出力"].waitForExistence(timeout: 10), app.debugDescription)
        XCTAssertTrue(app.buttons["閉じる"].isHittable, app.debugDescription)
        app.buttons["閉じる"].tap()
        XCTAssertTrue(app.buttons["保存"].isHittable, app.debugDescription)

        stitchPicker.tap()
        XCTAssertTrue(app.staticTexts["編み目記号"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.buttons["閉じる"].isHittable, app.debugDescription)
    }

    func testAccessibilityExtraExtraExtraLargeKeepsPrimaryFlowsUsable() {
        let app = XCUIApplication()
        app.launchArguments += [
            "-UIPreferredContentSizeCategoryName",
            "UICTContentSizeCategoryAccessibilityXXXL",
        ]
        app.launch()

        XCTAssertTrue(app.webViews.firstMatch.waitForExistence(timeout: 15))
        assertPrimaryControlsAreUsable(in: app)

        app.buttons["編み図"].tap()
        XCTAssertTrue(app.buttons["新しい編み図"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.buttons["閉じる"].isHittable, app.debugDescription)
        app.buttons["閉じる"].tap()

        app.buttons["保存"].tap()
        assertHittableAfterScrolling(app.buttons["PNGを保存"], in: app)
        assertHittableAfterScrolling(app.buttons["PDFを保存"], in: app)
        assertHittableAfterScrolling(app.buttons["この編み図"], in: app)
        app.buttons["閉じる"].tap()

        // 横向きの回帰防止。ヘッダーを固定高にしていたため、最大アクセシビリティサイズでは
        // 「編み図」「使い方」が画面上端の外（y=-58）へ押し出されて操作できなかった。
        XCUIDevice.shared.orientation = .landscapeLeft
        XCTAssertTrue(app.buttons["編み図"].waitForExistence(timeout: 10), app.debugDescription)
        assertWithinWindow(app.buttons["編み図"], in: app)
        assertWithinWindow(app.links["使い方"], in: app)
        assertPrimaryControlsAreUsable(in: app)
    }

    /// 要素がウィンドウの内側に収まっていることを確認する。
    ///
    /// Split Viewではウィンドウ幅が小数になり（681.5に対しWebViewは682.0）、
    /// 丸め誤差で1pt未満はみ出して見えることがあるため、その分だけ許容する。
    private func assertWithinWindow(_ element: XCUIElement, in app: XCUIApplication, tolerance: CGFloat = 1) {
        XCTAssertTrue(element.exists, app.debugDescription)
        let window = app.windows.firstMatch.frame.insetBy(dx: -tolerance, dy: -tolerance)
        let frame = element.frame
        XCTAssertTrue(
            window.contains(frame),
            "要素が画面外へはみ出している frame=\(frame) window=\(window): \(app.debugDescription)"
        )
    }

    private func assertHittableAfterScrolling(
        _ element: XCUIElement,
        in app: XCUIApplication,
        maximumScrolls: Int = 24
    ) {
        XCTAssertTrue(element.waitForExistence(timeout: 10), app.debugDescription)
        let dragStart = app.coordinate(withNormalizedOffset: CGVector(dx: 0.75, dy: 0.78))
        let dragEnd = app.coordinate(withNormalizedOffset: CGVector(dx: 0.75, dy: 0.62))
        for _ in 0..<maximumScrolls {
            if element.isHittable {
                return
            }
            dragStart.press(forDuration: 0.05, thenDragTo: dragEnd)
        }
        XCTAssertTrue(element.isHittable, app.debugDescription)
    }

    /// 保存シートを閉じる。
    ///
    /// iPadは「×」ボタン（label `Cancel`）を押せるが、iPhoneでは同じボタンへ到達できず
    /// `isHittable`もfalseになる。ウィンドウ状態によっても押せるかどうかが変わるため、
    /// 押してから閉じたことを確かめ、閉じていなければ画面座標の下スワイプへ落とす。
    /// 戻り値は失敗時の診断用に、どの手段まで試したかを表す。
    @discardableResult
    private func dismissSystemSheet(in app: XCUIApplication) -> String {
        let sheet = app.descendants(matching: .any).matching(identifier: "Cancel").firstMatch
        let closeButton = app.buttons.matching(NSPredicate(format: "label == %@", "Cancel")).firstMatch
        let buttonExists = closeButton.waitForExistence(timeout: 5)
        let buttonHittable = buttonExists && closeButton.isHittable
        if buttonHittable {
            closeButton.tap()
            if waitForDisappearance(of: sheet, timeout: 5) {
                return "閉じ方=×ボタン"
            }
        }
        app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.15)).press(
            forDuration: 0.05,
            thenDragTo: app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.98)),
            withVelocity: .default,
            thenHoldForDuration: 0.0
        )
        return "閉じ方=下スワイプ(×ボタン exists=\(buttonExists) hittable=\(buttonHittable)) window=\(app.windows.firstMatch.frame)"
    }

    private func screenshotAttachment(named name: String) -> XCTAttachment {
        let attachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        return attachment
    }

    private func waitForDisappearance(of element: XCUIElement, timeout: TimeInterval) -> Bool {
        let gone = XCTNSPredicateExpectation(
            predicate: NSPredicate(format: "exists == false"),
            object: element
        )
        return XCTWaiter.wait(for: [gone], timeout: timeout) == .completed
    }

    /// ダイアログの入力欄を確実に置き換える。
    ///
    /// 実機ではキーボードの表示前に入力が始まると先頭文字を取りこぼす（iPadで`M2切替A`が
    /// `2切替A`になった）。初期値が残ると意図しない名前になるため、消してから入力し、
    /// 最後に入力結果を検査する。
    /// 空の盤面から始めるため、名前を指定して新しい編み図を作る。
    private func createDocument(named name: String, in app: XCUIApplication) {
        let documents = app.buttons["編み図"]
        XCTAssertTrue(documents.waitForExistence(timeout: 15), app.debugDescription)
        documents.tap()
        let newDocument = app.buttons["新しい編み図"]
        XCTAssertTrue(newDocument.waitForExistence(timeout: 15), app.debugDescription)
        newDocument.tap()
        let nameField = app.textFields["入力"]
        XCTAssertTrue(nameField.waitForExistence(timeout: 15), app.debugDescription)
        replaceText(name, in: nameField, app: app)
        app.buttons["決定"].tap()
    }

    private func replaceText(_ text: String, in field: XCUIElement, app: XCUIApplication) {
        // 文字の無い右端をタップしてキャレットを末尾へ置く。中央をタップすると環境に
        // よってはキャレットが先頭に入り、後続の削除が何も消さずに初期値が残る
        // （CIのXcode 15.4 Simulatorで`M2切替A新しい編み図`になった）。
        field.coordinate(withNormalizedOffset: CGVector(dx: 0.95, dy: 0.5)).tap()
        // キーボードが出る前に入力すると先頭文字を取りこぼす。出ない環境でも
        // 入力自体は可能なので、待つだけで失敗にはしない。
        _ = app.keyboards.firstMatch.waitForExistence(timeout: 10)
        for _ in 0..<5 {
            guard let current = field.value as? String, !current.isEmpty else { break }
            field.typeText(String(repeating: XCUIKeyboardKey.delete.rawValue, count: current.count + 2))
        }
        field.typeText(text)
        XCTAssertEqual(field.value as? String, text, app.debugDescription)
    }

    private func assertBecomesHittable(_ element: XCUIElement, in app: XCUIApplication, note: String = "") {
        let hittable = XCTNSPredicateExpectation(
            predicate: NSPredicate(format: "isHittable == true"),
            object: element
        )
        XCTAssertEqual(
            XCTWaiter.wait(for: [hittable], timeout: 20),
            .completed,
            "シートを閉じたあとに編集画面へ戻れていない \(note): \(app.debugDescription)"
        )
    }

    private func assertPrimaryControlsAreUsable(in app: XCUIApplication) {
        for name in ["編み図", "盤面", "ブロック", "保存"] {
            let button = app.buttons[name]
            XCTAssertTrue(button.waitForExistence(timeout: 10), "\(name) が見つかりません: \(app.debugDescription)")
            XCTAssertTrue(button.isHittable, "\(name) を操作できません: \(app.debugDescription)")
        }

        let stitchPicker = app.descendants(matching: .any)
            .matching(NSPredicate(format: "label == %@", "編み目記号を選ぶ"))
            .firstMatch
        XCTAssertTrue(stitchPicker.waitForExistence(timeout: 10), app.debugDescription)
        XCTAssertTrue(stitchPicker.isHittable, app.debugDescription)

        for name in ["描く", "消す", "範囲"] {
            XCTAssertTrue(app.switches[name].waitForExistence(timeout: 10), "\(name) が見つかりません: \(app.debugDescription)")
        }
        if !app.switches["範囲"].isHittable {
            let toolbar = app.otherElements
                .matching(NSPredicate(format: "label BEGINSWITH %@", "編集ツール"))
                .firstMatch
            XCTAssertTrue(toolbar.waitForExistence(timeout: 5), app.debugDescription)
            toolbar.swipeLeft()
        }
        XCTAssertTrue(app.switches["範囲"].isHittable, app.debugDescription)
    }

    private func cancelExportAlert(in app: XCUIApplication) {
        let cancel = app.buttons["キャンセル"]
        let fileSave = app.buttons["ファイルに保存"]
        XCTAssertTrue(cancel.waitForExistence(timeout: 15))
        cancel.tap()
        assertDisappears(cancel, from: app)
        assertDisappears(fileSave, from: app)
    }

    private func waitForDocumentSave(named name: String, in webView: XCUIElement) {
        let saved = webView.descendants(matching: .staticText)
            .matching(NSPredicate(format: "label BEGINSWITH %@", name))
            .firstMatch
        XCTAssertTrue(saved.waitForExistence(timeout: 15), webView.debugDescription)

        let saving = webView.descendants(matching: .staticText)
            .matching(NSPredicate(format: "label CONTAINS %@", "（保存中…）"))
            .firstMatch
        let savedExpectation = XCTNSPredicateExpectation(
            predicate: NSPredicate(format: "exists == false"),
            object: saving
        )
        XCTAssertEqual(
            XCTWaiter.wait(for: [savedExpectation], timeout: 15),
            .completed,
            webView.debugDescription
        )
    }

    private func assertDisappears(_ element: XCUIElement, from app: XCUIApplication, note: String = "") {
        let disappearance = XCTNSPredicateExpectation(
            predicate: NSPredicate(format: "exists == false"),
            object: element
        )
        let result = XCTWaiter.wait(for: [disappearance], timeout: 15)
        XCTAssertTrue(result == .completed, "\(note): \(app.debugDescription)")
    }

    private func requireAppUpdateProbe() throws {
        if !FileManager.default.fileExists(atPath: "/tmp/knitting-editor-app-update-probe") {
            throw XCTSkip("専用のアプリ更新シミュレーションスクリプトからのみ実行する")
        }
    }
}
