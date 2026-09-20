import XCTest
import UIKit

@MainActor
final class KnittingEditorUITests: XCTestCase {
    func testLaunchShowsLocalEditorContainer() {
        let app = XCUIApplication()
        app.launch()
        XCTAssertTrue(
            app.webViews.firstMatch.waitForExistence(timeout: 15)
                || app.otherElements["knittingEditorWebView"].waitForExistence(timeout: 1),
            "SwiftUI root should expose the local WebView container"
        )
    }

    func testSavePanelShowsBackupActions() {
        let app = XCUIApplication()
        app.launch()
        XCTAssertTrue(app.webViews.firstMatch.waitForExistence(timeout: 15))

        let save = app.buttons["保存"]
        XCTAssertTrue(save.waitForExistence(timeout: 5))
        save.tap()

        XCTAssertTrue(app.buttons["この編み図"].waitForExistence(timeout: 5))
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
        XCTAssertTrue(newDocument.waitForExistence(timeout: 5))
        newDocument.tap()
        let nameField = app.textFields["入力"]
        XCTAssertTrue(nameField.waitForExistence(timeout: 5))
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
        XCTAssertTrue(newDocument.waitForExistence(timeout: 5))
        newDocument.tap()
        let nameField = app.textFields["入力"]
        XCTAssertTrue(nameField.waitForExistence(timeout: 5))
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

        documents.tap()
        newDocument.tap()
        XCTAssertTrue(nameField.waitForExistence(timeout: 5))
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

        documents.tap()
        let documentA = app.buttons
            .matching(NSPredicate(format: "label BEGINSWITH %@", "M2切替A"))
            .firstMatch
        XCTAssertTrue(documentA.waitForExistence(timeout: 5))
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
        XCTAssertTrue(documentB.waitForExistence(timeout: 5))
        documentB.tap()
        XCTAssertTrue(
            webView.otherElements
                .matching(NSPredicate(format: "label CONTAINS %@", "記号1個"))
                .firstMatch
                .waitForExistence(timeout: 10)
        )
    }

    func testBackupExportShowsNativeFileActions() throws {
        if ProcessInfo.processInfo.environment["CI"] == "true",
           UIDevice.current.userInterfaceIdiom == .phone {
            throw XCTSkip("Xcode 15.4 CIのiPhone SimulatorではWebKitがgzipバックアップ生成中に無応答になるため、iPadの同一導線とPNG/PDF導線で検証する")
        }
        let app = XCUIApplication()
        app.launch()

        XCTAssertTrue(app.webViews.firstMatch.waitForExistence(timeout: 15))
        let save = app.buttons["保存"]
        XCTAssertTrue(save.waitForExistence(timeout: 5))
        save.tap()

        let currentDocument = app.buttons["この編み図"]
        XCTAssertTrue(currentDocument.waitForExistence(timeout: 5))
        currentDocument.tap()

        XCTAssertTrue(app.buttons["ファイルに保存"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.buttons["共有"].exists)
        app.buttons["ファイルに保存"].tap()

        let localizedPickerCancel = app.otherElements["キャンセル"]
        let englishPickerCancel = app.otherElements["Cancel"]
        let pickerCancel = localizedPickerCancel.exists ? localizedPickerCancel : englishPickerCancel
        XCTAssertTrue(pickerCancel.waitForExistence(timeout: 10), app.debugDescription)
        if pickerCancel.isHittable {
            pickerCancel.tap()
        } else {
            pickerCancel.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
        }
    }

    func testPngAndPdfExportsReachNativeFileActions() {
        let app = XCUIApplication()
        app.launch()

        XCTAssertTrue(app.webViews.firstMatch.waitForExistence(timeout: 15))
        let save = app.buttons["保存"]
        XCTAssertTrue(save.waitForExistence(timeout: 5))
        save.tap()

        let png = app.buttons["PNGを保存"]
        XCTAssertTrue(png.waitForExistence(timeout: 5))
        png.tap()
        XCTAssertTrue(app.buttons["ファイルに保存"].waitForExistence(timeout: 15))
        app.buttons["キャンセル"].tap()

        let pdf = app.buttons["PDFを保存"]
        XCTAssertTrue(pdf.waitForExistence(timeout: 5))
        pdf.tap()
        XCTAssertTrue(app.buttons["ファイルに保存"].waitForExistence(timeout: 15))
        app.buttons["キャンセル"].tap()
    }
}
