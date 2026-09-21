import XCTest

@MainActor
final class KnittingEditorUITests: XCTestCase {
    override func tearDown() {
        XCUIDevice.shared.orientation = .portrait
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
        nameField.tap()
        nameField.typeText("再起動復元テスト")
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
        nameField.tap()
        nameField.typeText("M2切替A")
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
        nameField.tap()
        nameField.typeText("M2切替B")
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
        nameField.tap()
        nameField.typeText("アプリ更新復元fixture")
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

    func testBackupExportShowsNativeFileActions() throws {
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

        XCTAssertTrue(app.buttons["ファイルに保存"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.buttons["共有"].exists)
        app.buttons["ファイルに保存"].tap()

        let pickerCancel = app.descendants(matching: .any)
            .matching(identifier: "キャンセル")
            .firstMatch
        let englishPickerCancel = app.descendants(matching: .any)
            .matching(identifier: "Cancel")
            .firstMatch
        XCTAssertTrue(
            pickerCancel.waitForExistence(timeout: 10) || englishPickerCancel.waitForExistence(timeout: 10),
            app.debugDescription
        )
        if ProcessInfo.processInfo.environment["SIMULATOR_DEVICE_NAME"] != nil {
            throw XCTSkip("iOS SimulatorのUIDocumentPicker外部ウィンドウはXCTestからキャンセル操作できないため、実機で検証する")
        }
        cancelDocumentPicker(in: app)
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

    private func cancelDocumentPicker(in app: XCUIApplication) {
        let localizedCancel = app.descendants(matching: .any)
            .matching(identifier: "キャンセル")
            .firstMatch
        let englishCancel = app.descendants(matching: .any)
            .matching(identifier: "Cancel")
            .firstMatch
        let cancel = localizedCancel.waitForExistence(timeout: 10) ? localizedCancel : englishCancel
        XCTAssertTrue(cancel.waitForExistence(timeout: 15), app.debugDescription)
        if cancel.isHittable {
            cancel.tap()
        } else {
            cancel.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
        }
        assertDisappears(cancel, from: app)
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

    private func assertDisappears(_ element: XCUIElement, from app: XCUIApplication) {
        let disappearance = XCTNSPredicateExpectation(
            predicate: NSPredicate(format: "exists == false"),
            object: element
        )
        let result = XCTWaiter.wait(for: [disappearance], timeout: 15)
        XCTAssertTrue(result == .completed, app.debugDescription)
    }

    private func requireAppUpdateProbe() throws {
        if !FileManager.default.fileExists(atPath: "/tmp/knitting-editor-app-update-probe") {
            throw XCTSkip("専用のアプリ更新シミュレーションスクリプトからのみ実行する")
        }
    }
}
