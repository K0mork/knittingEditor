import UIKit
import XCTest

@MainActor
final class KnittingEditorUITests: XCTestCase {
    /// 手動配置のSplit View・可変ウィンドウを検証する実行では、向きを変えると
    /// 配置が全画面へ戻るため、向きに触れない。
    private var preservesManualWindow: Bool {
        ProcessInfo.processInfo.environment["KNITTING_EDITOR_MANUAL_WINDOW"] == "1"
    }

    /// CIのSimulatorはWebKitの初回起動が遅く、15秒では足りずに失敗することがある。
    /// 待機は要素が現れ次第終わるため、上限を広げても通常実行の所要時間は伸びない。
    static let editorAppearanceTimeout: TimeInterval = 45

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
            app.webViews.firstMatch.waitForExistence(timeout: Self.editorAppearanceTimeout)
                || app.otherElements["knittingEditorWebView"].waitForExistence(timeout: 1),
            "SwiftUI root should expose the local WebView container"
        )
    }

    /// 使い方ページは同梱資産だがReactの`webReady`を送らない。編集画面と同じ
    /// 読み込み表示を出したままにせず、戻ったときに編集画面が再び使えることを確認する。
    ///
    /// 保存の完了待ちはこのテストで行い、移らなかったときの記録と再タップは
    /// `openGuide(with:in:)`が行う（#401）。
    func testGuideNavigationReturnsToUsableEditor() {
        // 保存待ちとガイドの待機が続いても実行時間の上限に掛からないよう、広げる。
        executionTimeAllowance = 240
        let app = XCUIApplication()
        app.launch()

        XCTAssertTrue(app.webViews.firstMatch.waitForExistence(timeout: Self.editorAppearanceTimeout))
        createDocument(named: "使い方保存確認", in: app)
        // 記号数で探すと、描いたあとに同じ要素を見失う。盤面の名前で探して記号数を待つ。
        let canvas = app.webViews.firstMatch.otherElements
            .matching(NSPredicate(format: "label CONTAINS %@", "編み図編集盤面"))
            .firstMatch
        XCTAssertTrue(canvas.waitForExistence(timeout: Self.editorAppearanceTimeout), app.debugDescription)
        waitForStitchCount(0, on: canvas, in: app)
        canvas.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
        waitForStitchCount(1, on: canvas, in: app)
        // アプリは「使い方」を押す前に保存の完了を最大2秒待ち、確かめられなければ
        // 編集画面に残って理由を通知する（`guideNavigation.ts`）。記号を置いた直後の
        // 保存が終わる前に押すと、CIの遅いSimulatorでは仕様どおり残るため、ヘッダーの
        // 保存状態が「保存済み」か「保存失敗」になるまで待ってから押す（#401）。
        // 状態は読み上げ用に「、保存済み」のように読点が付くので終わりで照合する
        // （「保存済みブロックはありません。」には一致しない）。
        let webView = app.webViews.firstMatch
        let savedStatus = webView.staticTexts
            .matching(NSPredicate(format: "label ENDSWITH %@", "保存済み"))
            .firstMatch
        let failedStatus = webView.staticTexts
            .matching(NSPredicate(format: "label ENDSWITH %@", "保存失敗"))
            .firstMatch
        var saveState = ""
        let saveDeadline = Date().addingTimeInterval(Self.editorAppearanceTimeout)
        while Date() < saveDeadline {
            if failedStatus.exists {
                saveState = "保存失敗"
                break
            }
            if savedStatus.exists {
                saveState = "保存済み"
                break
            }
            // 見つからなければ0.5秒だけ待ち、その間の変化を次の周回で読む。
            _ = savedStatus.waitForExistence(timeout: 0.5)
        }
        // 保存を確認できないまま押すと、アプリが編集画面に残って別の失敗も重なる。
        // 状態と画面写真を残してここで止め、「使い方」は押さない（#401）。
        guard saveState == "保存済み" else {
            add(screenshotAttachment(named: "保存の完了を確認できない"))
            XCTFail(
                "保存の完了を待てない（見えた状態: \(saveState.isEmpty ? "なし" : saveState)）: \(app.debugDescription)"
            )
            return
        }
        let guideLink = app.links["使い方"]
        XCTAssertTrue(guideLink.waitForExistence(timeout: Self.editorAppearanceTimeout), app.debugDescription)
        openGuide(with: guideLink, in: app)

        XCTAssertFalse(
            app.otherElements["editorLoadingOverlay"].exists,
            "使い方ページで編集画面の読み込み表示を残さない: \(app.debugDescription)"
        )

        XCTAssertTrue(app.links["編集画面へ戻る"].firstMatch.exists, app.debugDescription)
        XCTAssertFalse(app.links["編み図を作成する"].exists, app.debugDescription)

        // 戻るリンクはページの一番下にある。XCUITestの自動スクロールに任せると、
        // タップ位置が画面の外（y=3275）で計算されて外れ、使い方ページのまま残った（#95）。
        // isHittableでも画面下端のホームインジケータの帯を押して外れることがあるため、
        // リンク全体が帯より上に収まるまで送る。
        // 自分でページを送り、押せる位置に来てから叩く。使い方ページのまま（リンクが残って
        // いる）ときに限って押し直し、最後まで戻らなければ失敗にする。
        let returnLinks = app.links.matching(identifier: "編集画面へ戻る")
        XCTAssertEqual(returnLinks.count, 3, app.debugDescription)
        let back = returnLinks.element(boundBy: 2)
        XCTAssertTrue(back.waitForExistence(timeout: 10), app.debugDescription)
        scrollWebViewUntilHittable(back, in: app)
        // ページの末尾に、アプリから渡したバージョンとビルド番号が出る（#84）。
        let version = app.webViews.firstMatch.staticTexts.matching(
            NSPredicate(format: "label BEGINSWITH %@ AND label CONTAINS %@", "バージョン ", "（ビルド ")
        ).firstMatch
        XCTAssertTrue(version.waitForExistence(timeout: 10), app.debugDescription)
        back.tap()
        let save = app.buttons["出力"]
        if !save.waitForExistence(timeout: 10), back.exists {
            scrollWebViewUntilHittable(back, in: app)
            back.tap()
        }
        XCTAssertTrue(save.waitForExistence(timeout: 20), "使い方ページから編集画面へ戻れない: \(app.debugDescription)")
        XCTAssertFalse(app.otherElements["editorLoadingOverlay"].exists, app.debugDescription)
        let restoredCanvas = app.webViews.firstMatch.otherElements
            .matching(NSPredicate(format: "label CONTAINS %@", "記号1個"))
            .firstMatch
        XCTAssertTrue(restoredCanvas.waitForExistence(timeout: 10), "使い方から戻るとセルが消えた: \(app.debugDescription)")
    }

    /// 2本指ジェスチャで盤面へ記号が入らないことを確認する。
    ///
    /// ほぼ同時に2本指で触れても、先に触れた指の位置へ記号が置かれてしまう不具合があった。
    /// 触れた瞬間に記号を確定していたためで、1本指のタップは指を離すまで保留するようにした。
    func testTwoFingerGestureDoesNotDrawOnBoard() {
        let app = XCUIApplication()
        app.launch()

        XCTAssertTrue(app.webViews.firstMatch.waitForExistence(timeout: Self.editorAppearanceTimeout))
        createDocument(named: "2本指確認", in: app)

        let webView = app.webViews.firstMatch
        let emptyCanvas = webView.otherElements
            .matching(NSPredicate(format: "label CONTAINS %@", "記号0個"))
            .firstMatch
        XCTAssertTrue(emptyCanvas.waitForExistence(timeout: Self.editorAppearanceTimeout), app.debugDescription)

        // 盤面のピンチは、画面全体の拡大を止めても（#81）盤面自身の拡大として効く。
        // 拡大は盤面の描画だけに表れ、アクセシビリティの値には出ないので、盤面の画像で比べる。
        let canvasBeforePinch = emptyCanvas.screenshot().pngRepresentation
        emptyCanvas.pinch(withScale: 2.0, velocity: 1.0)
        XCTAssertNotEqual(
            emptyCanvas.screenshot().pngRepresentation,
            canvasBeforePinch,
            "盤面のピンチで盤面が拡大されない: \(app.debugDescription)"
        )
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
                .waitForExistence(timeout: Self.editorAppearanceTimeout),
            app.debugDescription
        )
    }

    /// 大きな文字で番号帯を確認し、消去モードのピンチが記号を消さないことを確認する。
    func testCanvasLabelsWithLargeTextAndErasePinch() {
        let app = XCUIApplication()
        app.launchArguments += ["-UIPreferredContentSizeCategoryName", "UICTContentSizeCategoryAccessibilityXXXL"]
        app.launch()
        XCTAssertTrue(app.webViews.firstMatch.waitForExistence(timeout: Self.editorAppearanceTimeout))
        createDocument(named: "番号帯確認", in: app)
        let canvas = app.webViews.firstMatch.otherElements
            .matching(NSPredicate(format: "label CONTAINS %@", "編み図編集盤面")).firstMatch
        XCTAssertTrue(canvas.waitForExistence(timeout: Self.editorAppearanceTimeout))
        canvas.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
        waitForStitchCount(1, on: canvas, in: app)
        app.switches["消す"].tap()
        canvas.pinch(withScale: 0.2, velocity: -1.0)
        waitForStitchCount(1, on: canvas, in: app)
        let small = XCTAttachment(screenshot: canvas.screenshot())
        small.name = "大きな文字・縮小した盤面の番号"
        small.lifetime = .keepAlways
        add(small)
        canvas.pinch(withScale: 5.0, velocity: 1.0)
        waitForStitchCount(1, on: canvas, in: app)
        let large = XCTAttachment(screenshot: canvas.screenshot())
        large.name = "大きな文字・拡大した盤面の番号"
        large.lifetime = .keepAlways
        add(large)
        app.switches["範囲"].tap()
        let start = canvas.coordinate(withNormalizedOffset: CGVector(dx: 0.4, dy: 0.4))
        let end = canvas.coordinate(withNormalizedOffset: CGVector(dx: 0.6, dy: 0.6))
        start.press(forDuration: 0.1, thenDragTo: end)
        let selectionBefore = canvas.label
        XCTAssertFalse(selectionBefore.contains("選択範囲なし"))
        canvas.pinch(withScale: 0.5, velocity: -1.0)
        XCTAssertEqual(canvas.label, selectionBefore)
    }

    /// 盤面の外では、WKWebView由来のWebページ特有の挙動を出さない（#81）。
    ///
    /// 対策前は、見出しやツールバーのピンチで画面全体が拡大され（「出力」が約2倍になって
    /// 画面外へ出た）、見出し・ラベル・ボタン・リンクの長押しで文字が選択されて
    /// 「Copy」「Look Up」などのメニューが出た。入力欄の文字選択は
    /// `testDocumentDialogRemainsUsableAfterFocusingInput`で確かめる。
    func testEditorChromeIgnoresPageZoomAndTextSelection() {
        let app = XCUIApplication()
        app.launch()

        let webView = app.webViews.firstMatch
        XCTAssertTrue(webView.waitForExistence(timeout: Self.editorAppearanceTimeout))
        let heading = webView.staticTexts["棒針編み図エディタ"].firstMatch
        let save = app.buttons["出力"]
        XCTAssertTrue(save.waitForExistence(timeout: Self.editorAppearanceTimeout), app.debugDescription)
        XCTAssertTrue(heading.waitForExistence(timeout: 10), app.debugDescription)
        let documentName = documentNameText(below: heading, in: webView)
        XCTAssertTrue(documentName.waitForExistence(timeout: 10), app.debugDescription)
        // ピンチは要素の内側へ寄せた2点で行うため、小さな要素（編み図名）では位置を計算できない。
        let toolbar = webView.otherElements
            .matching(NSPredicate(format: "label BEGINSWITH %@", "編集ツール"))
            .firstMatch
        XCTAssertTrue(toolbar.waitForExistence(timeout: 10), app.debugDescription)

        let headingFrame = heading.frame
        let saveFrame = save.frame
        heading.pinch(withScale: 3.0, velocity: 2.0)
        toolbar.pinch(withScale: 3.0, velocity: 2.0)
        heading.doubleTap()
        assertFrameUnchanged(of: heading, from: headingFrame, in: app, note: "見出し")
        assertFrameUnchanged(of: save, from: saveFrame, in: app, note: "出力")

        for (name, element) in [
            ("見出し", heading),
            // ツール列の「色」は、ダイアログを開くボタンになって文字が読み上げに出なくなった（#115）。
            // 見出しの下の編み図名は、今も操作できない文字として出ている。
            ("ラベル", documentName),
            ("リンク", app.links["使い方"]),
            // 押すと状態が変わるボタンは、長押しの後のタップが効かないことがあり、
            // 後続の操作が不安定になる。選択中のモードは押し直しても変わらない。
            ("ボタン", app.switches["描く"]),
        ] {
            XCTAssertTrue(element.waitForExistence(timeout: 10), "\(name): \(app.debugDescription)")
            element.press(forDuration: 1.5)
            XCTAssertFalse(
                app.menuItems.firstMatch.waitForExistence(timeout: 2),
                "\(name)の長押しで文字選択のメニューが出た: \(app.debugDescription)"
            )
        }

        XCTAssertEqual(app.switches["描く"].value as? String, "1", app.debugDescription)
    }

    /// 使い方ページの外部リンクを長押ししても、リンクのプレビューを出さない（#81）。
    /// 既定ではプレビューが外部のページをアプリ内で読み込み、「Open Link」「Add to Reading
    /// List」などのメニューを出していた。外部リンクはタップしたときだけSafariで開く。
    /// 対策（`allowsLinkPreview = false`）を外したビルドでは、iOS 18.2で失敗することを確かめた。
    func testGuideExternalLinkShowsNoPreview() {
        let app = XCUIApplication()
        app.launch()

        XCTAssertTrue(app.webViews.firstMatch.waitForExistence(timeout: Self.editorAppearanceTimeout))
        let guideLink = app.links["使い方"]
        XCTAssertTrue(guideLink.waitForExistence(timeout: Self.editorAppearanceTimeout), app.debugDescription)
        guideLink.tap()

        let supportLink = app.links["サポートページ"]
        XCTAssertTrue(supportLink.waitForExistence(timeout: Self.editorAppearanceTimeout), app.debugDescription)
        scrollWebViewUntilHittable(supportLink, in: app)
        supportLink.press(forDuration: 1.5)

        // iOS 18.2・27.0では、プレビューのメニューはコレクションビューとして公開された。
        // OSの版によってはメニュー項目やシートとして出るおそれがあるため、どの形でも出ないことと、
        // リンク用の操作（文言は端末の言語で変わる）が無いことを確かめる。
        let linkActionLabels = [
            "Open Link", "Add to Reading List", "Copy Link",
            "リンクを開く", "リーディングリストに追加", "リンクをコピー",
        ]
        let previewAppeared = XCTNSPredicateExpectation(
            predicate: NSPredicate { object, _ in
                guard let app = object as? XCUIApplication else { return false }
                return app.collectionViews.firstMatch.exists
                    || app.menuItems.firstMatch.exists
                    || app.sheets.firstMatch.exists
                    || app.descendants(matching: .any)
                        .matching(NSPredicate(format: "label IN %@", linkActionLabels))
                        .firstMatch.exists
            },
            object: app
        )
        XCTAssertEqual(
            XCTWaiter.wait(for: [previewAppeared], timeout: 3),
            .timedOut,
            "外部リンクの長押しでプレビューやリンクのメニューが出た: \(app.debugDescription)"
        )
        // 使い方ページのまま残っている（長押しでページを移っていない）。
        XCTAssertTrue(supportLink.exists, app.debugDescription)
    }

    /// 自動保存を1時間遅らせ、文書切替だけで直前の編集がDBへ残ることを確かめる。
    func testDocumentSwitchSavesWithoutAutosave() {
        // 2文書の作成・切替・再起動を1本で行うため、遅いランナーでは既定の3分に近づく。
        executionTimeAllowance = 240
        let app = XCUIApplication()
        app.launchEnvironment["KNITTING_EDITOR_AUTOSAVE_DELAY_MS"] = "3600000"
        app.launch()
        let suffix = UUID().uuidString.prefix(8)
        let first = "切替A-\(suffix)"
        let second = "切替B-\(suffix)"
        createDocument(named: first, in: app)
        createDocument(named: second, in: app)
        // 名前入力のキーボードが閉じたあとのレイアウトで、別の文書を開く。
        _ = positionSaveProbeCanvas(count: 0, in: app)
        selectSaveProbeDocument(first, in: app)
        let canvas = positionSaveProbeCanvas(count: 0, in: app)
        saveProbeCell(row: 8, col: 12, on: canvas).tap()
        _ = saveProbeCanvas(count: 1, in: app)
        assertSaveProbeIsDirty(in: app)
        selectSaveProbeDocument(second, in: app)
        let secondCanvas = positionSaveProbeCanvas(count: 0, in: app)
        saveProbeCell(row: 12, col: 14, on: secondCanvas).tap()
        saveProbeCell(row: 12, col: 15, on: saveProbeCanvas(count: 1, in: app)).tap()
        _ = saveProbeCanvas(count: 2, in: app)
        assertSaveProbeIsDirty(in: app)
        selectSaveProbeDocument(first, in: app)
        _ = saveProbeCanvas(count: 1, in: app)
        // 切替後の表示だけでなく、WebViewを作り直してDBから読み直す。
        app.terminate()
        app.launch()
        waitForDocumentSave(named: first, in: app.webViews.firstMatch)
        _ = saveProbeCanvas(count: 1, in: app)
        // 起動中のサイズではなく、表示が落ち着いたサイズで初期位置を決め直す。
        _ = positionSaveProbeCanvas(count: 1, in: app)
        selectSaveProbeDocument(second, in: app)
        selectSaveProbeDocument(first, in: app)
        assertSaveProbePosition(count: 1, row: 8, col: 12, in: app)
        selectSaveProbeDocument(second, in: app)
        _ = saveProbeCanvas(count: 2, in: app)
        assertSaveProbePosition(count: 2, row: 12, col: 14, in: app)
        assertSaveProbePosition(count: 2, row: 12, col: 15, in: app)
    }

    /// 自動保存を1時間遅らせ、Home移行時の保存だけで直前の編集がDBへ残ることを確かめる。
    /// 前面へ戻さず、バックグラウンドのまま終了してから再起動する。
    func testHomeSavesWithoutAutosave() {
        let app = XCUIApplication()
        app.launchEnvironment["KNITTING_EDITOR_AUTOSAVE_DELAY_MS"] = "3600000"
        app.launch()
        let name = "Home保存-\(UUID().uuidString.prefix(8))"
        createDocument(named: name, in: app)
        saveProbeCanvas(count: 0, in: app)
            .coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
        _ = saveProbeCanvas(count: 1, in: app)
        assertSaveProbeIsDirty(in: app)
        XCUIDevice.shared.press(.home)
        XCTAssertTrue(
            app.wait(for: .runningBackgroundSuspended, timeout: 30) || app.state == .runningBackground,
            app.debugDescription
        )
        // 復帰すると`inactive`を通って保存がもう一度走るため、前面へ戻さずに終了する。
        // Home移行時に書き込めていなければ、再起動後のDBに編集は残らない。
        app.terminate()
        app.launch()
        waitForDocumentSave(named: name, in: app.webViews.firstMatch)
        _ = saveProbeCanvas(count: 1, in: app)
    }

    private func positionSaveProbeCanvas(count: Int, in app: XCUIApplication) -> XCUIElement {
        let canvas = saveProbeCanvas(count: count, in: app)
        var previous = CGRect.null
        var stableSince = Date()
        let stable = XCTNSPredicateExpectation(
            predicate: NSPredicate { _, _ in
                guard canvas.exists, !app.keyboards.firstMatch.exists,
                      !app.buttons["閉じる"].exists else {
                    previous = .null
                    stableSince = Date()
                    return false
                }
                let frame = canvas.frame
                if frame != previous || frame.isEmpty {
                    previous = frame
                    stableSince = Date()
                    return false
                }
                return Date().timeIntervalSince(stableSince) >= 1
            },
            object: canvas
        )
        let result = XCTWaiter.wait(for: [stable], timeout: 10)
        if result != .completed {
            add(screenshotAttachment(named: "保存検証の盤面が安定しない"))
        }
        XCTAssertEqual(result, .completed, app.debugDescription)
        return canvas
    }

    // BoardCanvas.initialViewport/clampViewportと同じ変換で、新規作成の150段×60目、既定30pxの
    // セルの中心を指定する。画面サイズに対する割合では同じセルを指定できない。
    // 初期表示は編み始めの右下に寄るので、`row`と`col`は右下の20×20の範囲での位置で指定する。
    private func saveProbeCell(row: Int, col: Int, on canvas: XCUIElement) -> XCUICoordinate {
        let size = canvas.frame.size
        let band: CGFloat = 28
        let cell: CGFloat = 30
        let rows = 150, cols = 60, window = 20
        func origin(_ extent: CGFloat, cells: Int) -> CGFloat {
            let center = (extent + band) / 2
            let initial = min(band + 8, extent - 8 - CGFloat(cells) * cell)
            return min(center - cell / 2, max(center - (CGFloat(cells) - 0.5) * cell, initial))
        }
        let boardRow = rows - window + row
        let boardCol = cols - window + col
        let point = CGVector(dx: origin(size.width, cells: cols) + (CGFloat(boardCol) + 0.5) * cell,
                             dy: origin(size.height, cells: rows) + (CGFloat(boardRow) + 0.5) * cell)
        XCTAssertTrue(point.dx > band && point.dx < size.width
                      && point.dy > band && point.dy < size.height,
                      "セルが表示範囲外 row=\(row) col=\(col) frame=\(canvas.frame)")
        return canvas.coordinate(withNormalizedOffset: .zero).withOffset(point)
    }

    private func assertSaveProbePosition(count: Int, row: Int, col: Int, in app: XCUIApplication) {
        let canvas = positionSaveProbeCanvas(count: count, in: app)
        app.switches["消す"].tap()
        let eraseMode = XCTNSPredicateExpectation(
            predicate: NSPredicate(format: "label CONTAINS %@", "消去モード"),
            object: canvas
        )
        XCTAssertEqual(XCTWaiter.wait(for: [eraseMode], timeout: 10), .completed, app.debugDescription)
        _ = positionSaveProbeCanvas(count: count, in: app)
        saveProbeCell(row: row, col: col, on: canvas).tap()
        let erased = app.webViews.firstMatch.otherElements
            .matching(NSPredicate(format: "label CONTAINS %@", "記号\(count - 1)個")).firstMatch
        let didErase = erased.waitForExistence(timeout: 10)
        if !didErase {
            add(screenshotAttachment(named: "保存検証のセル消去に失敗"))
        }
        XCTAssertTrue(didErase, "row=\(row) col=\(col) frame=\(canvas.frame): \(app.debugDescription)")
        // 履歴は文書を切り替えると捨てるので、ここで戻せるのは直前の消去1件だけになる。
        // 押し直しが遅れて2回効いても、2回目は何も戻さない。
        let undo = app.buttons["元に戻す"]
        tapChangingStitchCount("「元に戻す」", from: count - 1, to: count, in: app,
                               canRetry: { undo.isEnabled }) { undo.tap() }
        app.switches["描く"].tap()
    }

    private func assertSaveProbeIsDirty(in app: XCUIApplication) {
        XCTAssertTrue(app.webViews.firstMatch.staticTexts
            .matching(NSPredicate(format: "label CONTAINS %@", "保存中"))
            .firstMatch.waitForExistence(timeout: 10), app.debugDescription)
    }

    /// 表示中の盤面の左上から数えたマス（0始まり）。盤面は表示範囲より大きいので、見えているマスは
    /// どれも盤面の中にある。大きな文字で盤面の表示範囲が狭いときに使う。
    private func visibleBoardCell(row: Int, col: Int, on canvas: XCUIElement) -> XCUICoordinate {
        let band = Self.largeTextBoardBand
        let cell: CGFloat = 30
        let size = canvas.frame.size
        let point = CGVector(dx: band + (CGFloat(col) + 0.5) * cell, dy: band + (CGFloat(row) + 0.5) * cell)
        XCTAssertTrue(
            point.dx < size.width && point.dy < size.height,
            "表示中の盤面の外 row=\(row) col=\(col) frame=\(canvas.frame)"
        )
        return canvas.coordinate(withNormalizedOffset: .zero).withOffset(point)
    }

    /// 大きな文字での盤面の上と左の段・列番号の帯。帯は文字に合わせて広がり、既定の28ptの1.5倍で
    /// 止まる（`canvasLabelMetrics`）。AX3・AX5ではどちらも上限に達する。
    private static let largeTextBoardBand: CGFloat = 42

    private func drawSaveProbeCell(row: Int, col: Int, count: Int, in app: XCUIApplication) {
        let canvas = positionSaveProbeCanvas(count: count, in: app)
        saveProbeCell(row: row, col: col, on: canvas).tap()
        let drawn = app.webViews.firstMatch.otherElements
            .matching(NSPredicate(format: "label CONTAINS %@", "記号\(count + 1)個"))
            .firstMatch
        if drawn.waitForExistence(timeout: 10) { return }
        // iPadで静止後のタップでも記号数が変わらなかった。元の個数の盤面がある場合だけ押し直す。
        let unchanged = app.webViews.firstMatch.otherElements
            .matching(NSPredicate(format: "label CONTAINS %@", "記号\(count)個"))
            .firstMatch
        if unchanged.exists {
            add(screenshotAttachment(named: "保存検証のマスを押し直す"))
            let retryCanvas = positionSaveProbeCanvas(count: count, in: app)
            saveProbeCell(row: row, col: col, on: retryCanvas).tap()
        }
        _ = saveProbeCanvas(count: count + 1, in: app)
    }

    private func saveProbeCanvas(count: Int, in app: XCUIApplication) -> XCUIElement {
        let canvas = app.webViews.firstMatch.otherElements
            .matching(NSPredicate(format: "label CONTAINS %@", "記号\(count)個"))
            .firstMatch
        XCTAssertTrue(canvas.waitForExistence(timeout: Self.editorAppearanceTimeout), app.debugDescription)
        return canvas
    }

    /// 盤面や「元に戻す」をタップし、記号数が`from`から`to`へ変わるまで待つ。
    ///
    /// CIのSimulatorでは、合成したタップがWebViewで効かないことがまれにある（#44、#375）。
    /// 盤面への描画（`testSeedDocumentForAppUpdateProbe`）も、有効な「元に戻す」
    /// （`testDocumentSwitchSavesWithoutAutosave`）も、タップのあと記号数が変わらないまま
    /// 時間切れになった。10秒たっても`from`個のままで、`canRetry`が真のときだけ同じ操作を
    /// もう1回行う。押し直すのは、遅れて2回効いても結果が変わらない操作に限る。
    /// 押し直したときと効かなかったときは、各操作の時刻と画面写真を残し、ジョブログにも出す。
    private func tapChangingStitchCount(
        _ action: String,
        from current: Int,
        to expected: Int,
        in app: XCUIApplication,
        timeout: TimeInterval? = nil,
        canRetry: () -> Bool = { true },
        tap: () -> Void
    ) {
        let timeout = timeout ?? Self.editorAppearanceTimeout
        let webView = app.webViews.firstMatch
        func canvas(_ count: Int) -> XCUIElement {
            webView.otherElements.matching(NSPredicate(format: "label CONTAINS %@", "記号\(count)個")).firstMatch
        }
        let started = Date()
        var events: [String] = []
        func record(_ event: String) {
            events.append(String(format: "%.1f秒 ", Date().timeIntervalSince(started)) + event)
        }

        tap()
        record("\(action)をタップ")
        if canvas(expected).waitForExistence(timeout: 10) { return }
        let unchanged = canvas(current).exists
        let retry = unchanged && canRetry()
        record("10秒待っても記号\(expected)個にならない（記号\(current)個のまま=\(unchanged)、押し直す=\(retry)）")
        if retry {
            add(screenshotAttachment(named: "\(action)が効かず押し直す"))
            tap()
            record("\(action)を押し直した")
        }
        let reached = canvas(expected).waitForExistence(timeout: timeout)
        record(reached ? "記号\(expected)個になった" : "最後の待機でも記号\(expected)個にならない")
        let summary = "TAPRETRY \(action) " + events.joined(separator: " → ")
        print(summary)
        XCTContext.runActivity(named: summary) { _ in }
        if reached { return }
        add(screenshotAttachment(named: "\(action)で記号数が変わらない"))
        XCTFail("\(action)で記号が\(expected)個にならない 経過: \(events.joined(separator: " → ")): \(app.debugDescription)")
    }

    private func selectSaveProbeDocument(_ name: String, in app: XCUIApplication) {
        _ = openDocumentsPanel(in: app)
        let button = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", name + "、")).firstMatch
        XCTAssertTrue(button.waitForExistence(timeout: 10), app.debugDescription)
        button.tap()
        let title = app.webViews.firstMatch.staticTexts.matching(NSPredicate(format: "label BEGINSWITH %@", name)).firstMatch
        XCTAssertTrue(title.waitForExistence(timeout: 10), app.debugDescription)
    }

    func testEditAndRelaunchRestoresLocalDocument() {
        let app = XCUIApplication()
        app.launch()

        XCTAssertTrue(app.webViews.firstMatch.waitForExistence(timeout: Self.editorAppearanceTimeout))
        createDocument(named: "再起動復元テスト", in: app)

        let webView = app.webViews.firstMatch
        let canvas = webView.otherElements
            .matching(NSPredicate(format: "label CONTAINS %@", "記号0個"))
            .firstMatch
        XCTAssertTrue(canvas.waitForExistence(timeout: Self.editorAppearanceTimeout), app.debugDescription)
        canvas.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()

        let editedCanvas = webView.otherElements
            .matching(NSPredicate(format: "label CONTAINS %@", "記号1個"))
            .firstMatch
        XCTAssertTrue(editedCanvas.waitForExistence(timeout: Self.editorAppearanceTimeout), app.debugDescription)
        waitForDocumentSave(named: "再起動復元テスト", in: webView)

        app.terminate()
        app.launch()

        // `webViews.firstMatch`はWKWebViewの器が出た時点で成立する。盤面は端末内データの
        // 読み出し（最大10秒）と描画のあとに出るので、起動用の上限で待つ。
        let relaunchedWebView = app.webViews.firstMatch
        XCTAssertTrue(relaunchedWebView.waitForExistence(timeout: Self.editorAppearanceTimeout))
        let restoredCanvas = relaunchedWebView.otherElements
            .matching(NSPredicate(format: "label CONTAINS %@", "記号1個"))
            .firstMatch
        XCTAssertTrue(restoredCanvas.waitForExistence(timeout: Self.editorAppearanceTimeout), app.debugDescription)
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

        for panel in ["盤面", "ブロック", "出力"] {
            let close = app.buttons["閉じる"]
            if panel == "出力" {
                openSavePanel(with: app.buttons[panel], showing: close, in: app)
            } else {
                app.buttons[panel].tap()
            }
            XCTAssertTrue(close.waitForExistence(timeout: 10), "\(panel)パネルを開けない window=\(window): \(app.debugDescription)")
            XCTAssertTrue(close.isHittable, "\(panel)パネルを閉じられない window=\(window): \(app.debugDescription)")
            close.tap()
        }

        // 盤面の状態に依存しないよう、空の編み図を作ってから描画を確認する。
        // 小さいウィンドウでのダイアログとキーボード入力もここで通る。
        createDocument(named: "可変ウィンドウ確認", in: app)

        let canvas = app.webViews.firstMatch.otherElements
            .matching(NSPredicate(format: "label CONTAINS %@", "記号0個"))
            .firstMatch
        XCTAssertTrue(canvas.waitForExistence(timeout: Self.editorAppearanceTimeout), app.debugDescription)
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

    /// 1000×1000盤面の描画・保存・バックグラウンドからの復帰・再起動復元・PNG/PDF出力にかかる時間を実機で測る。
    ///
    /// 盤面は毎回、新しい編み図を作って「盤面」パネルの段数・列数で1000×1000にする。
    /// 測るだけで遅いため、CIでは実行しない。実機で次のように実行する。
    ///
    ///     TEST_RUNNER_KNITTING_EDITOR_LARGE_BOARD=1 xcodebuild test ... \
    ///       -only-testing:knittingEditorUITests/KnittingEditorUITests/testLargeBoardSavesAndRestores
    func testLargeBoardSavesAndRestores() throws {
        try XCTSkipUnless(
            ProcessInfo.processInfo.environment["KNITTING_EDITOR_LARGE_BOARD"] == "1",
            "時間がかかるため、TEST_RUNNER_KNITTING_EDITOR_LARGE_BOARD=1を付けたときだけ実行する"
        )
        let app = XCUIApplication()
        app.launch()
        let webView = app.webViews.firstMatch
        XCTAssertTrue(webView.waitForExistence(timeout: Self.editorAppearanceTimeout))
        createDocument(named: "1000×1000測定", in: app)

        let resizeStart = Date()
        let large = resizeBoard(rows: 1000, cols: 1000, in: app)
        let resizeSeconds = Date().timeIntervalSince(resizeStart)
        let before = try XCTUnwrap(stitchCount(of: large), app.debugDescription)

        // 記号を1つ置いてから、保存が完了するまでを測る。
        let editStart = Date()
        large.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
        let changed = XCTNSPredicateExpectation(
            predicate: NSPredicate(format: "NOT (label CONTAINS %@)", "記号\(before)個"),
            object: large
        )
        XCTAssertEqual(
            XCTWaiter.wait(for: [changed], timeout: 60),
            .completed,
            "1000×1000盤面へ描画できない: \(app.debugDescription)"
        )
        let editSeconds = Date().timeIntervalSince(editStart)
        let after = try XCTUnwrap(stitchCount(of: large), app.debugDescription)

        let saveStart = Date()
        waitForDocumentSave(named: "1000×1000測定", in: webView)
        let saveSeconds = Date().timeIntervalSince(saveStart)

        // バックグラウンドへ移してから戻っても、盤面と記号がそのまま残る。
        XCUIDevice.shared.press(.home)
        XCTAssertTrue(
            app.wait(for: .runningBackgroundSuspended, timeout: 30) || app.state == .runningBackground,
            "ホームへ戻ってもバックグラウンドへ移らない state=\(app.state.rawValue)"
        )
        let resumeStart = Date()
        app.activate()
        let resumed = app.webViews.firstMatch.otherElements
            .matching(NSPredicate(format: "label CONTAINS %@ AND label CONTAINS %@", "1000段、1000目", "記号\(after)個"))
            .firstMatch
        XCTAssertTrue(resumed.waitForExistence(timeout: 60), "復帰後に盤面と記号が残っていない: \(app.debugDescription)")
        let resumeSeconds = Date().timeIntervalSince(resumeStart)

        app.terminate()
        let restoreStart = Date()
        app.launch()
        let restored = app.webViews.firstMatch.otherElements
            .matching(NSPredicate(format: "label CONTAINS %@ AND label CONTAINS %@", "1000段、1000目", "記号\(after)個"))
            .firstMatch
        XCTAssertTrue(restored.waitForExistence(timeout: 180), "再起動後に1000×1000を復元できない: \(app.debugDescription)")
        let restoreSeconds = Date().timeIntervalSince(restoreStart)

        let pngSeconds = measureExport(button: "PNGを保存", in: app)
        let pdfSeconds = measureExport(button: "PDFを保存", in: app)

        let summary = String(
            format: "1000×1000 盤面変更 %.1f秒 / 描画反映 %.1f秒 / 保存完了まで %.1f秒 / バックグラウンドから復帰 %.1f秒 / 再起動から復元まで %.1f秒 / PNG %.1f秒 / PDF %.1f秒",
            resizeSeconds, editSeconds, saveSeconds, resumeSeconds, restoreSeconds, pngSeconds, pdfSeconds
        )
        print("LARGEBOARD \(summary)")
        XCTContext.runActivity(named: summary) { _ in }
    }

    /// 実機専用。環境変数がなければfull CIでもskipする（PR smokeには追加しない）。
    func testBridgeIOOnRealDevice() throws {
        let environment = ProcessInfo.processInfo.environment
        try XCTSkipUnless(environment["KNITTING_EDITOR_BRIDGE_IO"] == "1", "実機のブリッジ計測専用")
        let size = environment["KNITTING_EDITOR_BRIDGE_IO_SIZE"] ?? "small"
        XCTAssertTrue(["small", "medium", "large"].contains(size))
        executionTimeAllowance = 1800
        // 予期した失敗の記録（ignoringWaiterInterruption）でテストが途中で打ち切られても成功に数えられるため、
        // 復元まで測り終えたかを最後に確かめる。
        var measuredRestore = false
        addTeardownBlock { XCTAssertTrue(measuredRestore, "ブリッジ計測が復元まで進まずに終わった") }
        let app = XCUIApplication()
        app.launchEnvironment["KNITTING_EDITOR_BRIDGE_IO_SIZE"] = size
        let launchStart = Date()
        app.launch()
        let title = app.webViews.firstMatch.staticTexts.matching(NSPredicate(format: "label BEGINSWITH %@", "ブリッジ計測")).firstMatch
        XCTAssertTrue(title.waitForExistence(timeout: 180), "空のテスト用コンテナが必要です")
        print("BRIDGEIO size=\(size) seed=\(Date().timeIntervalSince(launchStart))s")
        add(screenshotAttachment(named: "ブリッジ計測-生成後"))

        let output = app.buttons["出力"]
        let allData = app.buttons["全データを書き出す"]
        openSavePanel(with: output, showing: allData, in: app)
        let exportStart = Date()
        allData.tap()
        let fileSave = app.buttons["ファイルに保存"]
        XCTAssertTrue(fileSave.waitForExistence(timeout: 300))
        guard tapExportAlertButton(fileSave, in: app, step: "ブリッジ計測-保存") else { return }
        let picker = SystemSheet.element(in: app)
        XCTAssertTrue(picker.waitForExistence(timeout: 30))
        // 保存先はシステムの前回の場所で開く。iPadではiCloud Driveで開き、端末内から探す復元で
        // 見つからなかったため、サイドバーに端末内の場所があれば選ぶ。iPhoneでは見出しにしか出ないので押さない。
        let onDevice = app.descendants(matching: .any)
            .matching(NSPredicate(format: "label IN %@", ["このiPad内", "On My iPad"])).firstMatch
        if waitForHittable(onDevice, timeout: 5) {
            onDevice.tap()
        }
        var filename = "knitting-editor-backup"
        let field = app.textFields["DOCPicker.filenameTextField"]
        if field.waitForExistence(timeout: 10) {
            filename = "bridge-io-" + String(UUID().uuidString.prefix(8))
            replaceText(filename, in: field, app: app)
        }
        add(screenshotAttachment(named: "ブリッジ計測-バックアップ保存先"))
        app.buttons.matching(NSPredicate(format: "label IN %@", ["保存", "Save"])).firstMatch.tap()
        // 保存画面が閉じるのを待つ。閉じないときは同名ファイルの置き換え確認が出ていないかを見る。
        let exportFinished = XCTNSPredicateExpectation(
            predicate: NSPredicate(format: "exists == false"),
            object: picker
        )
        let exportWaitResult = XCTWaiter.wait(
            for: [exportFinished],
            timeout: 300
        )
        // 実機では利用者が退避したバックアップを置き換えかねないため、置き換えの確認が出たら押さずに止める。
        if exportWaitResult != .completed {
            let replace = app.buttons.matching(NSPredicate(format: "label IN %@", ["置き換え", "Replace"])).firstMatch
            XCTAssertFalse(
                replace.waitForExistence(timeout: 5),
                "同名のファイルがあります。保存先から\(filename).knitを移してから実行してください"
            )
            assertDisappears(picker, from: app)
        }
        print("BRIDGEIO backupExport=\(Date().timeIntervalSince(exportStart))s")
        if app.buttons["閉じる"].exists { app.buttons["閉じる"].tap() }

        for name in ["PNGを保存", "PDFを保存"] {
            openSavePanel(with: output, showing: app.buttons[name], in: app)
            let start = Date()
            app.buttons[name].tap()
            XCTAssertTrue(fileSave.waitForExistence(timeout: 300))
            guard tapExportAlertButton(fileSave, in: app, step: name) else { return }
            XCTAssertTrue(picker.waitForExistence(timeout: 30))
            print("BRIDGEIO \(name)=\(Date().timeIntervalSince(start))s")
            add(screenshotAttachment(named: "ブリッジ計測-" + name))
            dismissSystemSheet(in: app)
            assertDisappears(picker, from: app)
            if app.buttons["閉じる"].exists { app.buttons["閉じる"].tap() }
        }

        let restore = app.buttons["バックアップから復元"]
        openSavePanel(with: output, showing: restore, in: app)
        restore.tap()
        XCTAssertTrue(picker.waitForExistence(timeout: 30))
        guard let backup = backupFileInOnDeviceLocation(named: filename, in: app) else { return }
        let restoreStart = Date()
        backup.tap()
        let restored = app.webViews.firstMatch.staticTexts.matching(NSPredicate(
            format: "label BEGINSWITH %@ AND label CONTAINS %@", "ブリッジ計測", "（復元）")).firstMatch
        XCTAssertTrue(restored.waitForExistence(timeout: 600))
        XCTAssertTrue(output.isEnabled)
        print("BRIDGEIO backupRestore=\(Date().timeIntervalSince(restoreStart))s")
        measuredRestore = true
        add(screenshotAttachment(named: "ブリッジ計測-復元完了"))
    }

    /// 「盤面」パネルの段数・列数で盤面の大きさを変え、変更後の盤面を返す。
    private func resizeBoard(rows: Int, cols: Int, in app: XCUIApplication) -> XCUIElement {
        app.buttons["盤面"].tap()
        let rowsField = app.textFields["段数"]
        XCTAssertTrue(rowsField.waitForExistence(timeout: Self.editorAppearanceTimeout), app.debugDescription)
        replaceNumber(rows, in: rowsField, app: app)
        replaceNumber(cols, in: app.textFields["列数"], app: app)
        app.buttons["変更"].tap()

        let resized = app.webViews.firstMatch.otherElements
            .matching(NSPredicate(format: "label CONTAINS %@", "\(rows)段、\(cols)目"))
            .firstMatch
        XCTAssertTrue(resized.waitForExistence(timeout: 120), "盤面を\(rows)×\(cols)にできない: \(app.debugDescription)")
        app.buttons["閉じる"].tap()
        return resized
    }

    /// 数値欄の値を置き換える。
    ///
    /// キャレットが先頭に入ると`20`が`100020`のようになるため、末尾側を叩いてから消して入力する。
    private func replaceNumber(_ number: Int, in field: XCUIElement, app: XCUIApplication) {
        XCTAssertTrue(field.waitForExistence(timeout: 10), app.debugDescription)
        let text = String(number)
        for _ in 0..<2 {
            // 隣の欄へ入力したあとは、キーボードが出たままタップしても焦点が移らないことが
            // ある（iPhone実機で、「段数」の次に「列数」へ入力できなかった）。焦点が移った
            // ことを確かめてから入力する。
            for _ in 0..<3 {
                field.coordinate(withNormalizedOffset: CGVector(dx: 0.95, dy: 0.5)).tap()
                if waitForKeyboardFocus(on: field, timeout: 5) { break }
            }
            _ = app.keyboards.firstMatch.waitForExistence(timeout: 10)
            let current = (field.value as? String) ?? ""
            let deletes = String(repeating: XCUIKeyboardKey.delete.rawValue, count: current.count + text.count + 2)
            field.typeText(deletes + text)
            let reached = XCTNSPredicateExpectation(
                predicate: NSPredicate { element, _ in
                    ((element as? XCUIElement)?.value as? String).flatMap { Int($0) } == number
                },
                object: field
            )
            if XCTWaiter.wait(for: [reached], timeout: 10) == .completed { return }
        }
        XCTFail("数値欄を\(text)にできない value=\(String(describing: field.value)): \(app.debugDescription)")
    }

    private func waitForKeyboardFocus(on element: XCUIElement, timeout: TimeInterval) -> Bool {
        let focused = XCTNSPredicateExpectation(
            predicate: NSPredicate(format: "hasKeyboardFocus == true"),
            object: element
        )
        return XCTWaiter.wait(for: [focused], timeout: timeout) == .completed
    }

    /// 出力パネルから出力を始め、ファイルの保存先を選ぶ画面が出るまでの秒数を返す。
    private func measureExport(button name: String, in app: XCUIApplication) -> TimeInterval {
        let save = app.buttons["出力"]
        XCTAssertTrue(save.waitForExistence(timeout: Self.editorAppearanceTimeout), app.debugDescription)
        let export = app.buttons[name]
        openSavePanel(with: save, showing: export, in: app)
        let start = Date()
        export.tap()
        XCTAssertTrue(
            app.buttons["ファイルに保存"].waitForExistence(timeout: 180),
            "1000×1000の\(name)が完了しない: \(app.debugDescription)"
        )
        let seconds = Date().timeIntervalSince(start)
        cancelExportAlert(in: app)
        if app.buttons["閉じる"].exists {
            app.buttons["閉じる"].tap()
        }
        return seconds
    }

    /// 1000×1000の盤面でPNGの1セルの画素数を最大（60px）にすると、上限を超える理由と
    /// PDF保存のすすめが出て、「PNGを保存」が押せなくなる。アプリは落ちない（#24）。
    /// 最小に戻すと、表示が消えて保存できるようになる。
    func testOversizedPngExplainsLimitAndDisablesSave() {
        let app = XCUIApplication()
        app.launch()
        XCTAssertTrue(app.webViews.firstMatch.waitForExistence(timeout: Self.editorAppearanceTimeout), app.debugDescription)
        createDocument(named: "PNG上限確認", in: app)
        _ = resizeBoard(rows: 1000, cols: 1000, in: app)

        openSavePanel(with: app.buttons["出力"], showing: app.buttons["PNGを保存"], in: app)
        let slider = app.sliders.matching(NSPredicate(format: "label BEGINSWITH %@", "1セルの画素数")).firstMatch
        assertHittableAfterScrolling(slider, in: app)
        let png = app.buttons["PNGを保存"]
        let limit = app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "一辺が上限16384pxを超えます")).firstMatch
        let recommend = app.staticTexts["この盤面はPDF保存をおすすめします。"]

        dragPngCellSize(slider, to: 60, in: app)
        XCTAssertTrue(limit.waitForExistence(timeout: 10), "上限を超える理由が出ない: \(app.debugDescription)")
        XCTAssertTrue(recommend.exists, "PDF保存のすすめが出ない: \(app.debugDescription)")
        XCTAssertTrue(png.exists, app.debugDescription)
        XCTAssertFalse(png.isEnabled, "上限を超えても「PNGを保存」が押せる: \(app.debugDescription)")
        add(screenshotAttachment(named: "PNGの上限超過"))

        dragPngCellSize(slider, to: 2, in: app)
        XCTAssertTrue(waitForDisappearance(of: limit, timeout: 10), "最小に戻しても上限の表示が消えない: \(app.debugDescription)")
        XCTAssertFalse(recommend.exists, "最小に戻してもPDF保存のすすめが残る: \(app.debugDescription)")
        XCTAssertTrue(png.isEnabled, "最小に戻しても「PNGを保存」が押せない: \(app.debugDescription)")
        XCTAssertEqual(app.state, .runningForeground)
        app.buttons["閉じる"].tap()
    }

    /// 出力パネルの「1セルの画素数」を端の値（2pxか60px）までドラッグする。
    ///
    /// WebViewのスライダーはつまみの位置の属性が取れず、`adjust(toNormalizedSliderPosition:)`が
    /// 失敗する（iPad実機で確認）。今の値からつまみの位置を求め、スライダーの外までドラッグする。
    private func dragPngCellSize(_ slider: XCUIElement, to end: Int, in app: XCUIApplication) {
        let range = 2...60
        for _ in 0..<3 {
            guard let current = pngCellSize(of: slider) else { break }
            if current == end { return }
            let frame = slider.frame
            // つまみは左右の端から半径ぶん内側を動く。
            let inset = min(frame.height / 2, 14)
            let ratio = CGFloat(current - range.lowerBound) / CGFloat(range.upperBound - range.lowerBound)
            let origin = slider.coordinate(withNormalizedOffset: CGVector(dx: 0, dy: 0.5))
            let thumb = origin.withOffset(CGVector(dx: inset + ratio * (frame.width - inset * 2), dy: 0))
            let target = origin.withOffset(CGVector(dx: end == range.upperBound ? frame.width + 12 : -12, dy: 0))
            thumb.press(forDuration: 0.2, thenDragTo: target)
            let deadline = Date().addingTimeInterval(5)
            while pngCellSize(of: slider) != end, Date() < deadline {
                Thread.sleep(forTimeInterval: 0.2)
            }
        }
        XCTAssertEqual(pngCellSize(of: slider), end, "1セルの画素数を\(end)pxにできない: \(app.debugDescription)")
    }

    /// 「1セルの画素数」の今の値。
    ///
    /// スライダーの名前は「1セルの画素数 7px」のように値を含む。横の値の表示は、iOS 26.5のWebKitでは
    /// 「7」と「px」の2つの要素に分かれるため使わない。名前から読めないときは、スライダーの値（`7.00`）を使う。
    private func pngCellSize(of slider: XCUIElement) -> Int? {
        let label = slider.label
        if let range = label.range(of: "[0-9]+(?=px$)", options: .regularExpression) {
            return Int(label[range])
        }
        return (slider.value as? String).flatMap(Double.init).map { Int($0.rounded()) }
    }

    /// App Storeスクリーンショット用に、画面を埋める大きさの盤面を用意する。
    ///
    /// 撮影対象のSimulatorに対して実行し、終了後に`xcrun simctl io <udid> screenshot`で撮る。
    ///
    ///     TEST_RUNNER_KNITTING_EDITOR_SCREENSHOT_ROWS=40 \
    ///     TEST_RUNNER_KNITTING_EDITOR_SCREENSHOT_COLS=32 xcodebuild test ...
    func testPrepareScreenshotBoard() throws {
        let environment = ProcessInfo.processInfo.environment
        let rows = environment["KNITTING_EDITOR_SCREENSHOT_ROWS"].flatMap(Int.init)
        let cols = environment["KNITTING_EDITOR_SCREENSHOT_COLS"].flatMap(Int.init)
        try XCTSkipUnless(
            rows != nil && cols != nil,
            "撮影用の盤面を用意するときだけ、TEST_RUNNER_KNITTING_EDITOR_SCREENSHOT_ROWS/COLSを指定して実行する"
        )
        let app = XCUIApplication()
        app.launch()
        XCTAssertTrue(app.webViews.firstMatch.waitForExistence(timeout: Self.editorAppearanceTimeout))
        createDocument(named: "サンプル編み図", in: app)

        // 新規作成の150段×60目から、指定の大きさへ広げることも縮めることもある。
        let resized = resizeBoard(rows: rows!, cols: cols!, in: app)

        // 記号を置いて編み図らしい見た目にする。
        for (dx, dy) in [(0.30, 0.35), (0.38, 0.35), (0.46, 0.35), (0.34, 0.45), (0.42, 0.45), (0.38, 0.55)] {
            resized.coordinate(withNormalizedOffset: CGVector(dx: dx, dy: dy)).tap()
        }
        XCTAssertTrue(
            app.webViews.firstMatch.otherElements
                .matching(NSPredicate(format: "label CONTAINS %@", "記号6個"))
                .firstMatch
                .waitForExistence(timeout: 20),
            app.debugDescription
        )
    }

    /// アプリ更新シミュレーションの更新前アプリでfixtureを保存する（#446）。
    ///
    /// fixtureはUIで組み立てず、起動時のDEBUG専用フックで端末内データへ書き込む。色・幅のある記号・
    /// 点線・背景色をUIで置こうとすると、遅いランナーで1操作に数十秒かかった実績（#441）から
    /// 実行時間の上限（240秒）を超える恐れがある。フックは利用者が編み図を作って保存するときと
    /// 同じ保存の公開APIでIndexedDBへ書くので、更新後のアプリが読む内容は利用者が保存した編み図と同じ形になる。
    /// このテストとフックが`app_update`ジョブの更新前アプリで動くのは、次のリリースのタグを
    /// 付けたあと。それまでは前のリリースのタグのこのテストが、記号1個の最小fixtureを保存する。
    func testSeedDocumentForAppUpdateProbe() throws {
        try requireAppUpdateProbe()
        let app = XCUIApplication()
        let appUpdateElementTimeout: TimeInterval = 60
        app.launchEnvironment["KNITTING_EDITOR_APP_UPDATE_FIXTURE"] = "1"
        app.launch()

        XCTAssertTrue(app.webViews.firstMatch.waitForExistence(timeout: appUpdateElementTimeout))
        // 起動時にfixtureが読み込まれていれば、最初の編み図は増えた内容で開いている。
        let webView = app.webViews.firstMatch
        let seededCanvas = webView.otherElements
            .matching(NSPredicate(format: "label CONTAINS %@ AND label CONTAINS %@", "記号3個", "ガイド線1本"))
            .firstMatch
        XCTAssertTrue(seededCanvas.waitForExistence(timeout: appUpdateElementTimeout), app.debugDescription)
        // 2つ目の編み図も一覧へ入っている。更新後のテストはこの名前でfixtureの版を区別する。
        _ = openDocumentsPanel(in: app, timeout: appUpdateElementTimeout)
        for prefix in ["アプリ更新復元fixture、", "アプリ更新復元fixture2、"] {
            let item = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", prefix)).firstMatch
            XCTAssertTrue(item.waitForExistence(timeout: 10), "\(prefix)が一覧に無い: \(app.debugDescription)")
        }
        app.buttons["閉じる"].tap()
    }

    /// 更新後のアプリで、更新前のアプリが保存したfixtureを読めることを確認する（#446）。
    ///
    /// 前のリリースのタグが保存するのは最小fixture（記号1個）なので、中央の記号は常に確かめる。
    /// 目印の編み図「アプリ更新復元fixture2」が一覧にあるときはfixtureを増やした版なので、
    /// さらに色・幅のある記号・点線・背景色・ブロック・2つ目の編み図が同じ内容で残っていることを確かめる。
    func testUpdatedAppRestoresSeedDocument() throws {
        try requireAppUpdateProbe()
        let app = XCUIApplication()
        let appUpdateElementTimeout: TimeInterval = 60
        app.launch()

        XCTAssertTrue(app.webViews.firstMatch.waitForExistence(timeout: appUpdateElementTimeout))
        _ = openDocumentsPanel(in: app, timeout: appUpdateElementTimeout)
        let richMarker = app.buttons
            .matching(NSPredicate(format: "label BEGINSWITH %@", "アプリ更新復元fixture2、"))
            .firstMatch
        let richFixtureSeeded = richMarker.waitForExistence(timeout: 10)
        let restoredDocument = app.buttons
            .matching(NSPredicate(format: "label BEGINSWITH %@", "アプリ更新復元fixture、"))
            .firstMatch
        XCTAssertTrue(restoredDocument.waitForExistence(timeout: appUpdateElementTimeout), app.debugDescription)
        restoredDocument.tap()

        // 中央の記号は最小fixtureでも常に確かめる。増えたfixtureでは、点線の本数が
        // 盤面の読み上げに記号数と並んで残っていることも同じ盤面で確かめる。
        let stitchCountLabel = richFixtureSeeded ? "記号3個" : "記号1個"
        let restoredCanvasQuery = richFixtureSeeded
            ? NSPredicate(format: "label CONTAINS %@ AND label CONTAINS %@", stitchCountLabel, "ガイド線1本")
            : NSPredicate(format: "label CONTAINS %@", stitchCountLabel)
        let restoredCanvas = app.webViews.firstMatch.otherElements
            .matching(restoredCanvasQuery)
            .firstMatch
        XCTAssertTrue(
            restoredCanvas.waitForExistence(timeout: appUpdateElementTimeout),
            app.debugDescription
        )
        if !richFixtureSeeded { return }

        // 背景色は、盤面パネルのプリセット「グレー」が押された状態で残っている。
        app.buttons["盤面"].tap()
        let grayBackground = app.switches["グレー"]
        XCTAssertTrue(grayBackground.waitForExistence(timeout: 10), app.debugDescription)
        XCTAssertEqual(grayBackground.value as? String, "1", app.debugDescription)
        app.buttons["閉じる"].tap()
        // 色付きのセルは、記号の色の一覧に保存した色の見本（青緑 #264653）として残っている。
        // 道具列の色と記号の道具は`aria-haspopup="dialog"`を持つため、WebKitの読み上げでは
        // 種類が`Button`にならず`Other`になる（iOS 27.2のSimulatorで確認）。記号の選択画面
        // （`編み目記号を選ぶ`）と同じく、種類を問わず名前で探す。
        let colourTool = app.descendants(matching: .any)
            .matching(NSPredicate(format: "label BEGINSWITH %@", "記号の色を選ぶ"))
            .firstMatch
        XCTAssertTrue(colourTool.waitForExistence(timeout: 10), app.debugDescription)
        colourTool.tap()
        // 色見本は`aria-pressed`を持つためスイッチとして見えるが、一覧の作りに寄らず
        // 種類を問わず保存した色の見本を探す。
        let distinctColor = app.descendants(matching: .any)
            .matching(NSPredicate(format: "label CONTAINS %@", "#264653"))
            .firstMatch
        XCTAssertTrue(distinctColor.waitForExistence(timeout: 10), app.debugDescription)
        app.buttons["閉じる"].firstMatch.tap()
        // 保存済みブロックも一覧に残っている。
        app.buttons["ブロック"].tap()
        let restoredBlock = app.buttons
            .matching(NSPredicate(format: "label BEGINSWITH %@", "アプリ更新復元ブロック"))
            .firstMatch
        XCTAssertTrue(restoredBlock.waitForExistence(timeout: 10), app.debugDescription)
        app.buttons["閉じる"].tap()
        // 2つ目の編み図には幅2目の記号を1個だけ入れてある。隣のマスを1回消して記号全体が
        // 消えれば、幅のある記号として残っていたことになる。幅が失われて1マスの記号に
        // なっていれば、隣のマスを消しても記号は1個のまま残る。
        _ = openDocumentsPanel(in: app, timeout: appUpdateElementTimeout)
        let markerDocument = app.buttons
            .matching(NSPredicate(format: "label BEGINSWITH %@", "アプリ更新復元fixture2、"))
            .firstMatch
        XCTAssertTrue(markerDocument.waitForExistence(timeout: 10), app.debugDescription)
        markerDocument.tap()
        XCTAssertTrue(
            app.webViews.firstMatch.otherElements
                .matching(NSPredicate(format: "label CONTAINS %@", "記号1個"))
                .firstMatch
                .waitForExistence(timeout: appUpdateElementTimeout),
            app.debugDescription
        )
        app.switches["消す"].tap()
        let canvas = positionSaveProbeCanvas(count: 1, in: app)
        tapChangingStitchCount("幅のある記号の隣のマス", from: 1, to: 0, in: app, timeout: appUpdateElementTimeout) {
            saveProbeCell(row: 10, col: 11, on: canvas).tap()
        }
    }

    /// 出力パネルからネイティブの復元Pickerを開き、取り消して編集へ戻る。
    func testRestorePickerDismissesBackToEditor() {
        let app = XCUIApplication()
        app.launch()
        let restore = app.buttons["バックアップから復元"]
        let save = app.buttons["出力"]
        XCTAssertTrue(save.waitForExistence(timeout: Self.editorAppearanceTimeout), app.debugDescription)
        openSavePanel(with: save, showing: restore, in: app)
        restore.tap()
        let picker = SystemSheet.element(in: app)
        XCTAssertTrue(picker.waitForExistence(timeout: Self.editorAppearanceTimeout), app.debugDescription)
        let dismissal = dismissSystemSheet(in: app)
        assertDisappears(picker, from: app, note: dismissal)
        assertBecomesHittable(app.webViews.firstMatch, in: app, note: dismissal)
        // 選択画面を閉じても出力パネルは開いたまま残る。iPhoneではパネルが下の「出力」を覆うので、
        // パネルを閉じてから編集画面の操作へ戻れることを確かめる。
        let close = app.buttons["閉じる"]
        assertBecomesHittable(close, in: app, note: dismissal)
        close.tap()
        assertBecomesHittable(save, in: app, note: dismissal)
    }

    /// 使い方（#197）の「ブロックを保存して貼る」「全データを書き出して復元する」を、画面の操作で確かめる。
    ///
    /// 範囲を選んでブロック保存し、保存したブロックを選んで貼付先をタップすると貼付される。
    /// 「全データを書き出す」を「ファイルに保存」で端末へ保存し、「バックアップから復元」で選ぶと、
    /// 既存の編み図は残ったまま「（復元）」の付いた編み図とブロックが追加され、復元した先頭の編み図へ切り替わる。
    func testBlockSaveAndFullBackupRestoreFollowGuide() {
        executionTimeAllowance = 240
        let app = XCUIApplication()
        app.launch()
        let suffix = UUID().uuidString.prefix(8)
        let target = "ガイド貼付先-\(suffix)"
        let chart = "ガイド確認-\(suffix)"
        let blockName = "ブロック確認-\(suffix)"
        createDocument(named: target, in: app)
        createDocument(named: chart, in: app)

        // 3マスを描く。
        _ = positionSaveProbeCanvas(count: 0, in: app)
        let cells = [(8, 12), (8, 13), (9, 12)]
        for (index, cell) in cells.enumerated() {
            drawSaveProbeCell(row: cell.0, col: cell.1, count: index, in: app)
        }

        // 「範囲」で囲み、「ブロック」→「選択範囲をブロック保存」で名前を付けて保存する。
        let range = app.switches["範囲"]
        XCTAssertTrue(range.waitForExistence(timeout: 10), app.debugDescription)
        range.tap()
        let canvas = positionSaveProbeCanvas(count: 3, in: app)
        let start = saveProbeCell(row: 7, col: 11, on: canvas)
        let end = saveProbeCell(row: 10, col: 14, on: canvas)
        start.press(forDuration: 0.05, thenDragTo: end)
        let blocks = app.buttons["ブロック"]
        XCTAssertTrue(blocks.waitForExistence(timeout: 10), app.debugDescription)
        blocks.tap()
        let saveBlock = app.buttons["選択範囲をブロック保存"]
        XCTAssertTrue(saveBlock.waitForExistence(timeout: 10), app.debugDescription)
        add(screenshotAttachment(named: "範囲を選んだブロックパネル"))
        saveBlock.tap()
        let nameField = app.textFields["入力"]
        XCTAssertTrue(nameField.waitForExistence(timeout: Self.editorAppearanceTimeout), app.debugDescription)
        replaceText(blockName, in: nameField, app: app)
        confirmDialog(closing: nameField, in: app)
        let blockButton = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", blockName)).firstMatch
        XCTAssertTrue(blockButton.waitForExistence(timeout: 10), app.debugDescription)

        // 別の編み図へ切り替え、保存したブロックを選んで貼付先をタップする。
        // タップしたマスがブロックの左上になり、貼付のあとも「やめる」を押すまで貼付を続ける。
        selectSaveProbeDocument(target, in: app)
        _ = positionSaveProbeCanvas(count: 0, in: app)
        blocks.tap()
        let pasteBlock = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", blockName)).firstMatch
        XCTAssertTrue(pasteBlock.waitForExistence(timeout: 10), app.debugDescription)
        pasteBlock.tap()
        let pasteBand = app.staticTexts["貼付中：左上にするマスをタップ"]
        XCTAssertTrue(pasteBand.waitForExistence(timeout: 10), app.debugDescription)
        // 「ブロック」の開閉で盤面の表示位置が変わるため、横位置は盤面幅の42%、縦位置は上端から190ptを狙う。
        // 貼付されなければ盤面中央を2回目の候補にする。収まらないと「盤面からはみ出す」と通知される。
        let pasteCanvas = positionSaveProbeCanvas(count: 0, in: app)
        let pasteOffsetsFromCanvasTopLeft = [CGVector(dx: pasteCanvas.frame.width * 0.42, dy: 190),
                            CGVector(dx: pasteCanvas.frame.width * 0.5, dy: pasteCanvas.frame.height * 0.5)]
        // 貼付のあとも貼付中のままなので、帯ではなく記号の数で貼付できたかを見る。
        let pastedCanvas = app.webViews.firstMatch.otherElements
            .matching(NSPredicate(format: "label CONTAINS %@", "記号3個")).firstMatch
        for point in pasteOffsetsFromCanvasTopLeft where !pastedCanvas.exists {
            pasteCanvas.coordinate(withNormalizedOffset: .zero).withOffset(point).tap()
            _ = pastedCanvas.waitForExistence(timeout: 5)
        }
        waitForStitchCount(3, on: saveProbeCanvas(count: 3, in: app), in: app)
        XCTAssertTrue(pasteBand.exists, app.debugDescription)
        let stopPaste = app.buttons["やめる"]
        XCTAssertTrue(stopPaste.isHittable, app.debugDescription)
        stopPaste.tap()
        XCTAssertTrue(waitForDisappearance(of: pasteBand, timeout: 10), app.debugDescription)
        XCTAssertEqual(app.switches["描く"].value as? String, "1")
        add(screenshotAttachment(named: "ブロックを貼付した盤面"))

        // 「全データを書き出す」を「ファイルに保存」で、システムの保存先の選択が開いた場所へ保存する。
        let save = app.buttons["出力"]
        XCTAssertTrue(save.waitForExistence(timeout: 10), app.debugDescription)
        let allData = app.buttons["全データを書き出す"]
        openSavePanel(with: save, showing: allData, in: app)
        allData.tap()
        let fileSave = app.buttons["ファイルに保存"]
        XCTAssertTrue(fileSave.waitForExistence(timeout: Self.editorAppearanceTimeout), app.debugDescription)
        guard tapExportAlertButton(fileSave, in: app, step: "全データ-ファイルに保存") else { return }
        let exportPicker = SystemSheet.element(in: app)
        XCTAssertTrue(exportPicker.waitForExistence(timeout: 20), app.debugDescription)
        // CIの再試行で同名ファイルを置き換えるとファイルプロバイダーが停止したため、
        // 実行ごとに名前を変えてシステムの置き換え確認を避ける。
        // CIのiPhoneではファイル名の入力欄が公開されないことがあるため、その場合は既定名を使う。
        var backupFileName = "knitting-editor-backup"
        var mayAskToReplace = true
        let filename = app.textFields["DOCPicker.filenameTextField"]
        if filename.waitForExistence(timeout: 10) {
            backupFileName = "knitting-editor-backup-\(suffix)"
            replaceText(backupFileName, in: filename, app: app)
            mayAskToReplace = false
        }
        // 保存先はシステムの前回の場所に依存する。iPhoneでの確認時は「このiPhone内」が開いた。
        let saveInPicker = app.buttons.matching(NSPredicate(format: "label IN %@", ["保存", "Save"])).firstMatch
        XCTAssertTrue(saveInPicker.waitForExistence(timeout: 20), app.debugDescription)
        add(screenshotAttachment(named: "全データの保存先の選択"))
        saveInPicker.tap()
        // 別プロセスの保存画面が閉じる途中は、ボタンの問い合わせに17〜44秒かかることがある（#317）。
        // 名前を変えられなかった回に、閉じる途中で置き換えの確認を問い合わせて待ち時間を使い切ったため（#370）、
        // まず保存画面が閉じるのだけを待つ。普段は数秒で閉じるので、名前を変えられなかった回は15秒で打ち切る。
        let exportFinished = XCTNSPredicateExpectation(
            predicate: NSPredicate(format: "exists == false"),
            object: exportPicker
        )
        let exportWaitResult = XCTWaiter.wait(
            for: [exportFinished],
            timeout: mayAskToReplace ? 15 : Self.editorAppearanceTimeout
        )
        if exportWaitResult != .completed {
            // 保存画面が残るのは、前回の同名ファイルの置き換え確認が出ているときだけ。
            XCTAssertTrue(mayAskToReplace, app.debugDescription)
            let replace = app.buttons.matching(NSPredicate(format: "label IN %@", ["置き換え", "Replace"])).firstMatch
            if mayAskToReplace && replace.waitForExistence(timeout: 10) {
                waitUntilStill(replace)
                replace.tap()
            }
            assertDisappears(exportPicker, from: app)
        }

        // 「バックアップから復元」で、いま保存したファイルを選ぶ。
        let restore = app.buttons["バックアップから復元"]
        if !restore.exists { openSavePanel(with: save, showing: restore, in: app) }
        restore.tap()
        let restorePicker = SystemSheet.element(in: app)
        XCTAssertTrue(restorePicker.waitForExistence(timeout: 20), app.debugDescription)
        add(screenshotAttachment(named: "復元の選択画面を開いた直後"))
        guard let backupFile = backupFileInOnDeviceLocation(named: backupFileName, in: app) else { return }
        add(screenshotAttachment(named: "復元するファイルの選択"))
        backupFile.tap()
        assertDisappears(restorePicker, from: app)

        // この手順では最後に更新した貼付先が先頭となり、その復元した編み図へ切り替わって貼付した3マスが入っている。
        let webView = app.webViews.firstMatch
        let restoredTitle = webView.staticTexts
            .matching(NSPredicate(format: "label BEGINSWITH %@", target + "（復元）")).firstMatch
        XCTAssertTrue(restoredTitle.waitForExistence(timeout: Self.editorAppearanceTimeout), app.debugDescription)
        _ = saveProbeCanvas(count: 3, in: app)
        add(screenshotAttachment(named: "復元後に開いた編み図"))

        // 既存の編み図は上書きされず、「（復元）」の付いた編み図が別に追加されている。
        _ = openDocumentsPanel(in: app)
        for name in [target, chart, target + "（復元）", chart + "（復元）"] {
            let item = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", name + "、")).firstMatch
            XCTAssertTrue(item.waitForExistence(timeout: 10), "\(name)が一覧に無い: \(app.debugDescription)")
        }
        add(screenshotAttachment(named: "復元後の編み図の一覧"))
        app.buttons["閉じる"].tap()

        // 保存済みブロックも、元のブロックを残したまま「（復元）」を付けて追加されている。
        blocks.tap()
        let restoredBlock = app.buttons
            .matching(NSPredicate(format: "label BEGINSWITH %@", blockName + "（復元）")).firstMatch
        XCTAssertTrue(restoredBlock.waitForExistence(timeout: 10), app.debugDescription)
        let originalBlock = app.buttons.matching(NSPredicate(
            format: "label BEGINSWITH %@ AND NOT (label BEGINSWITH %@)", blockName, blockName + "（復元）")).firstMatch
        XCTAssertTrue(originalBlock.exists, app.debugDescription)
        add(screenshotAttachment(named: "復元後のブロックの一覧"))
    }

    /// `.knit`の書き出しがシステムの保存UIまで到達し、閉じたあと編集画面へ戻れることを確認する。
    ///
    /// iOS 27のDocument Pickerは別プロセスのUIで「キャンセル」ボタンを持たず、
    /// 閉じる操作は「<」→「×」か下スワイプである。要素は`isHittable`がfalseで直接タップできないため、
    /// 画面座標の下スワイプで閉じる。シートの有無は`SystemSheet`の要素で判定する
    /// （実機で表示中のみ存在し、閉じると消えることを確認済み）。
    func testBackupExportSheetDismissesBackToEditor() throws {
        let app = XCUIApplication()
        app.launch()

        XCTAssertTrue(app.webViews.firstMatch.waitForExistence(timeout: Self.editorAppearanceTimeout))
        let save = app.buttons["出力"]
        XCTAssertTrue(save.waitForExistence(timeout: Self.editorAppearanceTimeout))
        let currentDocument = app.buttons["この編み図を書き出す"]
        openSavePanel(with: save, showing: currentDocument, in: app)
        currentDocument.tap()

        let fileSave = app.buttons["ファイルに保存"]
        XCTAssertTrue(fileSave.waitForExistence(timeout: Self.editorAppearanceTimeout))
        XCTAssertTrue(app.buttons["共有"].exists)
        // 確認ダイアログの「キャンセル」を保存シートと取り違えないよう、ダイアログが消えてから探す。
        guard tapExportAlertButton(fileSave, in: app, step: "この編み図-ファイルに保存") else { return }

        let systemSheet = SystemSheet.element(in: app)
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

    /// 共有先が見えることと、閉じた直後の最初のタップが編集画面へ届くことを確かめる（#158、#191）。
    ///
    /// 縦向きは全出力経路、横向きは共通のアンカーとdismissalをPNGで確認する。
    func testShareSheetsDismissBackToEditor() {
        // 4種類の書き出しで共有シートを開いて閉じるため、CIでは普段から約120〜180秒かかり、既定の3分に近い（#358）。
        executionTimeAllowance = 240
        assertShareSheetsDismissBackToEditor(landscape: false)
    }

    func testShareSheetsDismissBackToEditorInLandscape() {
        assertShareSheetsDismissBackToEditor(landscape: true)
    }

    func testShareSheetStaysUsableAfterRotatingWhileOpen() {
        XCUIDevice.shared.orientation = .portrait
        defer { XCUIDevice.shared.orientation = .portrait }

        let app = XCUIApplication()
        app.launch()
        XCTAssertTrue(app.webViews.firstMatch.waitForExistence(timeout: Self.editorAppearanceTimeout))
        let save = app.buttons["出力"]
        XCTAssertTrue(save.waitForExistence(timeout: Self.editorAppearanceTimeout), app.debugDescription)
        let png = app.buttons["PNGを保存"]
        openSavePanel(with: save, showing: png, in: app)
        assertHittableAfterScrolling(png, in: app)
        waitUntilStill(png)
        png.tap()
        let share = app.buttons["共有"]
        XCTAssertTrue(share.waitForExistence(timeout: Self.editorAppearanceTimeout), app.debugDescription)
        // 共有シートが開かなければ、回転以降の確認は意味が無いので、ここで打ち切る。
        guard tapExportAlertButton(share, in: app, step: "PNG-共有-回転前") else { return }

        let sheet = shareSheet(in: app)
        guard sheet.waitForExistence(timeout: 20) else {
            XCTFail("共有シートが開かない: \(app.debugDescription)")
            return
        }
        let copy = sheet.cells.matching(NSPredicate(format: "label IN %@", ["Copy", "コピー"])).firstMatch
        XCTAssertTrue(copy.waitForExistence(timeout: 20), app.debugDescription)
        XCTAssertTrue(waitForHittable(copy, timeout: 20), app.debugDescription)

        // 共有シートを開き直さず、表示中の回転と再配置を検証する。
        rotateToLandscape(app)
        waitUntilStill(sheet, timeout: 20)
        XCTAssertTrue(sheet.exists, app.debugDescription)
        XCTAssertTrue(copy.waitForExistence(timeout: 20), app.debugDescription)
        XCTAssertTrue(waitForHittable(copy, timeout: 20), app.debugDescription)
        waitUntilStill(copy, timeout: 20)
        XCTAssertTrue(copy.exists, app.debugDescription)
        XCTAssertTrue(copy.isHittable, app.debugDescription)
        let windowFrame = app.windows.firstMatch.frame
        XCTAssertTrue(windowFrame.contains(copy.frame), "コピー項目がウィンドウ外にある copy=\(copy.frame) window=\(windowFrame): \(app.debugDescription)")
        add(screenshotAttachment(named: "共有-PNG-表示中に横向きへ回転"))

        let dismissal = dismissShareSheet(sheet, in: app)
        assertDisappears(sheet, from: app, note: dismissal)
        // 既存の共有終了テストと同じく、編集画面への最初のタップは押し直さない。
        app.buttons["閉じる"].tap()
        assertDisappears(app.buttons["この編み図を書き出す"], from: app, note: dismissal)
        app.buttons["盤面"].tap()
        let rowsUp = app.buttons["上に段"]
        XCTAssertTrue(rowsUp.waitForExistence(timeout: 10), app.debugDescription)
        waitUntilStill(rowsUp)
        app.buttons["閉じる"].tap()
        assertDisappears(rowsUp, from: app, note: dismissal)
    }

    private func assertShareSheetsDismissBackToEditor(landscape: Bool) {
        let app = XCUIApplication()
        app.launch()
        XCTAssertTrue(app.webViews.firstMatch.waitForExistence(timeout: Self.editorAppearanceTimeout))
        let save = app.buttons["出力"]
        XCTAssertTrue(save.waitForExistence(timeout: Self.editorAppearanceTimeout), app.debugDescription)
        if landscape { rotateToLandscape(app) }
        let exports = landscape ? ["PNGを保存"] : ["PNGを保存", "PDFを保存", "この編み図を書き出す", "全データを書き出す"]
        for export in exports {
            let step = "\(export)-\(landscape ? "横" : "縦")"
            let button = app.buttons[export]
            openSavePanel(with: save, showing: button, in: app)
            assertHittableAfterScrolling(button, in: app)
            waitUntilStill(button)
            button.tap()
            let share = app.buttons["共有"]
            XCTAssertTrue(share.waitForExistence(timeout: Self.editorAppearanceTimeout), app.debugDescription)
            guard tapExportAlertButton(share, in: app, step: "\(step)-共有") else { return }

            let sheet = shareSheet(in: app)
            XCTAssertTrue(sheet.waitForExistence(timeout: 20), "\(step): \(app.debugDescription)")
            let copy = sheet.cells.matching(NSPredicate(format: "label IN %@", ["Copy", "コピー"])).firstMatch
            XCTAssertTrue(copy.waitForExistence(timeout: 20), "\(step): \(app.debugDescription)")
            add(screenshotAttachment(named: "共有-\(step)"))
            // 共有先が画面内に見えて選べる（#158では透明な領域だけが残った）。
            XCTAssertTrue(copy.isHittable, "\(step): \(app.debugDescription)")

            // 枠外のタップで閉じる。編集画面への最初のタップとは別に行う。
            let dismissal = dismissShareSheet(sheet, in: app)
            assertDisappears(sheet, from: app, note: "\(step) \(dismissal)")

            app.buttons["閉じる"].tap()
            assertDisappears(app.buttons["この編み図を書き出す"], from: app, note: step)
            app.buttons["盤面"].tap()
            let rowsUp = app.buttons["上に段"]
            XCTAssertTrue(rowsUp.waitForExistence(timeout: 10), "\(step): \(app.debugDescription)")
            // パネルが開く動きの途中だと「閉じる」のタップが外れる。止まってから押す。
            waitUntilStill(rowsUp)
            app.buttons["閉じる"].tap()
            assertDisappears(app.buttons["上に段"], from: app, note: step)
        }
    }

    /// 共有シートの表示中にWebContentプロセスが終了しても、アプリが落ちず、シートを閉じたあと
    /// 保存済みの編み図で編集を再開できることを確かめる（#336）。
    ///
    /// ホスト側で`com.apple.WebKit.WebContent`をSIGKILLする必要があるため、
    /// `TEST_RUNNER_KNITTING_EDITOR_WEBCONTENT_KILL=1`と
    /// `ios/scripts/run-webcontent-termination-ui-test.sh`があるときだけ実行する。
    func testShareSheetSurvivesWebContentTermination() throws {
        try requireWebContentTermination()
        // 遅いSimulatorでも、WebContentの再読み込みとシートの後片付けを待てるようにする。
        executionTimeAllowance = 300
        let app = XCUIApplication()
        app.launch()
        XCTAssertTrue(app.webViews.firstMatch.waitForExistence(timeout: Self.editorAppearanceTimeout))
        let name = "共有中終了-\(UUID().uuidString.prefix(8))"
        let webView = prepareSavedChart(named: name, in: app)

        let save = app.buttons["出力"]
        let png = app.buttons["PNGを保存"]
        openSavePanel(with: save, showing: png, in: app)
        png.tap()
        let share = app.buttons["共有"]
        XCTAssertTrue(share.waitForExistence(timeout: Self.editorAppearanceTimeout), app.debugDescription)
        guard tapExportAlertButton(share, in: app, step: "共有中終了") else { return }
        let sheet = shareSheet(in: app)
        XCTAssertTrue(sheet.waitForExistence(timeout: 20), app.debugDescription)

        try signalWebContentKill("共有シート")
        // 共有シートはモーダルなので、背後の準備中の表示は読み上げの対象から外れることがある。
        // 終了の合図はホスト側の完了ファイルで確かめ、ここでは表示の有無を必須にしない。
        _ = editorLoadingOverlay(in: app).waitForExistence(timeout: 5)
        if sheet.exists {
            // 再読み込みで出力パネルが消え、シートの外は盤面になる。枠外のタップは盤面にも届いて
            // 記号を置くため（iOS 27.2 Simulator）、ヘッダーの題名を叩いて閉じる。
            let dismissal = dismissShareSheetWithoutTouchingBoard(sheet, in: app)
            assertDisappears(sheet, from: app, note: dismissal)
        }
        assertEditorRecoversAfterTermination(in: app, note: "共有シート表示中")

        add(screenshotAttachment(named: "共有シート表示中のWebContent終了から復帰"))
        assertExportPanelClosedAfterReload(showing: "PNGを保存", in: app)
        assertBecomesHittable(webView, in: app, note: "共有シート表示中の終了")
        assertSavedChart(name: name, stitchCount: 1, in: app)
        assertChartCanBeEdited(in: app)
        assertNoStaleExportResult(in: app)
    }

    /// 保存画面（Document Picker）の表示中にWebContentプロセスが終了しても、シートを閉じたあと
    /// 保存済みの編み図で編集を再開できることを確かめる（#336）。
    func testDocumentPickerSurvivesWebContentTermination() throws {
        try requireWebContentTermination()
        executionTimeAllowance = 300
        let app = XCUIApplication()
        app.launch()
        XCTAssertTrue(app.webViews.firstMatch.waitForExistence(timeout: Self.editorAppearanceTimeout))
        // 名前に「保存中」を含めると、保存状態の表示（「保存中」）の判定に当たってしまう。
        let name = "書出中終了-\(UUID().uuidString.prefix(8))"
        let webView = prepareSavedChart(named: name, in: app)

        let save = app.buttons["出力"]
        let export = app.buttons["この編み図を書き出す"]
        openSavePanel(with: save, showing: export, in: app)
        export.tap()
        let fileSave = app.buttons["ファイルに保存"]
        XCTAssertTrue(fileSave.waitForExistence(timeout: Self.editorAppearanceTimeout), app.debugDescription)
        guard tapExportAlertButton(fileSave, in: app, step: "書出中終了") else { return }
        let picker = SystemSheet.element(in: app)
        XCTAssertTrue(picker.waitForExistence(timeout: 20), app.debugDescription)

        try signalWebContentKill("保存画面")
        _ = editorLoadingOverlay(in: app).waitForExistence(timeout: 5)
        if picker.exists {
            let dismissal = dismissSystemSheet(in: app)
            assertDisappears(picker, from: app, note: dismissal)
        }
        assertEditorRecoversAfterTermination(in: app, note: "保存画面表示中")

        add(screenshotAttachment(named: "保存画面表示中のWebContent終了から復帰"))
        assertExportPanelClosedAfterReload(showing: "この編み図を書き出す", in: app)
        assertBecomesHittable(webView, in: app, note: "保存画面表示中の終了")
        assertSavedChart(name: name, stitchCount: 1, in: app)
        assertChartCanBeEdited(in: app)
        assertNoStaleExportResult(in: app)
    }

    /// 準備中の表示・失敗の案内・「再試行」が読み上げ用の要素として出て、再試行で編集へ戻れることを
    /// 確かめる（#336）。2回続けて終了させ、10秒以内の再終了として失敗の案内を出す。
    func testRecoveryAccessibilityExposesPreparingNoticeAndRetry() throws {
        try requireWebContentTermination()
        executionTimeAllowance = 300
        let app = XCUIApplication()
        app.launch()
        XCTAssertTrue(app.webViews.firstMatch.waitForExistence(timeout: Self.editorAppearanceTimeout))
        let name = "VoiceOver終了-\(UUID().uuidString.prefix(8))"
        _ = prepareSavedChart(named: name, in: app)

        // 1回目は準備中の表示を出す。読み上げ用のラベルは末尾の「…」を含まない。
        // 再読み込みが速いと準備中の表示は1秒ほどで消えるため、表示の中のラベルを短い間隔で探す。
        // 2回目の終了は、1回目から10秒以内に起こす必要がある。
        try signalWebContentKill("VoiceOver-1回目")
        let overlay = editorLoadingOverlay(in: app)
        XCTAssertTrue(
            pollUntilExists(overlay.staticTexts["編み図を準備しています"], timeout: 30),
            "WebContent終了後に、読み上げ用のラベルの付いた準備中の表示が出ない: \(app.debugDescription)"
        )
        XCTAssertFalse(app.buttons["再試行"].exists, "復旧できる終了で「再試行」を出さない")

        // 2回目を準備完了前に続け、失敗の案内と「再試行」を出す。
        try signalWebContentKill("VoiceOver-2回目")
        let failure = app.staticTexts
            .matching(NSPredicate(
                format: "label BEGINSWITH %@ AND label CONTAINS %@",
                "編み図を読み込めませんでした", "再試行してください"
            ))
            .firstMatch
        XCTAssertTrue(failure.waitForExistence(timeout: 60), app.debugDescription)
        let retry = app.buttons["再試行"]
        XCTAssertTrue(retry.exists, app.debugDescription)
        XCTAssertEqual(retry.elementType, .button, "「再試行」がボタンとして公開されていない")
        XCTAssertTrue(retry.isHittable, "\(app.debugDescription)")
        XCTAssertTrue(overlay.exists, "失敗の案内を準備中の表示の一部として出していない: \(app.debugDescription)")

        // この画面は静的な案内とボタンだけなので、ラベルと種類に絞って監査する。
        // コントラスト・文字サイズ・切り詰め・要素検出・当たり判定は、別の外観・レイアウトの
        // テストで扱っており、準備中から失敗へ変わる一時的な状態には当てはめない。
        // 監査はアプリ全体を走査するため、背後に残る編集画面の要素は対象外にする。
        // 編集画面のラベルと種類は`testCoreEditorControlsExposeAccessibleNamesAndState`で見ている。
        try app.performAccessibilityAudit(for: [.sufficientElementDescription, .trait]) { issue in
            guard let element = issue.element else { return false }
            let isRecoveryNotice = element.identifier == "editorLoadRetryButton"
                || element.label == "再試行"
                || element.label.hasPrefix("編み図を読み込めませんでした")
            return !isRecoveryNotice
        }

        add(screenshotAttachment(named: "VoiceOver用の再試行画面"))
        retry.tap()
        XCTAssertTrue(
            waitForDisappearance(of: overlay, timeout: 120),
            "「再試行」で編集画面へ戻らない: \(app.debugDescription)"
        )
        XCTAssertFalse(failure.exists, app.debugDescription)
        assertSavedChart(name: name, stitchCount: 1, in: app)
    }

    /// 大きな編み図をバックグラウンドへ移したあとWebContentプロセスが終了しても、
    /// 戻ったときに保存済みの編み図で編集を再開できることを確かめる（#336）。
    func testLargeChartRecoversFromWebContentTerminationInBackground() throws {
        try requireWebContentTermination()
        // 盤面の変更、保存、再読み込みを1本で行う。
        executionTimeAllowance = 420
        let app = XCUIApplication()
        app.launch()
        XCTAssertTrue(app.webViews.firstMatch.waitForExistence(timeout: Self.editorAppearanceTimeout))
        let name = "大きな編み図終了-\(UUID().uuidString.prefix(8))"
        createDocument(named: name, in: app)
        let large = resizeBoard(rows: 300, cols: 300, in: app)
        large.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
        let webView = app.webViews.firstMatch
        let edited = webView.otherElements
            .matching(NSPredicate(format: "label CONTAINS %@ AND label CONTAINS %@", "300段、300目", "記号1個"))
            .firstMatch
        XCTAssertTrue(edited.waitForExistence(timeout: 60), app.debugDescription)
        waitForDocumentSave(named: name, in: webView)

        // 再読み込みで閉じる「盤面」パネルを開いたままバックグラウンドへ移す。復帰後に
        // パネルが閉じていれば、ページが実際に読み直された証拠になる。開いたパネルは
        // このあとタップしないので、閉じずにそのままにする（再読み込みが閉じる）。
        app.buttons["盤面"].tap()
        let rowsUp = app.buttons["上に段"]
        if !app.buttons["閉じる"].waitForExistence(timeout: 10) {
            app.buttons["盤面"].tap()
        }
        XCTAssertTrue(
            rowsUp.waitForExistence(timeout: Self.editorAppearanceTimeout),
            "盤面パネルを開けない: \(app.debugDescription)"
        )

        XCUIDevice.shared.press(.home)
        XCTAssertTrue(
            app.wait(for: .runningBackgroundSuspended, timeout: 30) || app.state == .runningBackground,
            "ホームへ戻ってもバックグラウンドへ移らない state=\(app.state.rawValue)"
        )
        try signalWebContentKill("バックグラウンド")
        app.activate()
        XCTAssertTrue(app.wait(for: .runningForeground, timeout: 60), app.debugDescription)
        let overlay = editorLoadingOverlay(in: app)
        if overlay.exists {
            XCTAssertTrue(
                waitForDisappearance(of: overlay, timeout: 180),
                "バックグラウンドからの復帰後に準備中の表示が消えない: \(app.debugDescription)"
            )
        }
        XCTAssertFalse(
            app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH %@", "編み図を読み込めませんでした"))
                .firstMatch.exists,
            app.debugDescription
        )
        // 終了前に開いた「盤面」パネルが残っていれば、ページは読み直されていない。
        // 復帰直後は再読み込みが終わっていないことがあるため、準備中の表示の待機に合わせて待つ。
        XCTAssertTrue(
            waitForDisappearance(of: rowsUp, timeout: 60),
            "バックグラウンドからの復帰後も盤面パネルが開いたまま（ページが再読み込みされていない）: \(app.debugDescription)"
        )
        let restored = webView.otherElements
            .matching(NSPredicate(format: "label CONTAINS %@ AND label CONTAINS %@", "300段、300目", "記号1個"))
            .firstMatch
        XCTAssertTrue(restored.waitForExistence(timeout: 180), "復帰後に保存済みの編み図が残っていない: \(app.debugDescription)")

        // 復帰後に編集できることも確かめる。中央のマスへ1個足す。
        restored.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
        let changed = webView.otherElements
            .matching(NSPredicate(format: "label CONTAINS %@ AND label CONTAINS %@", "300段、300目", "記号2個"))
            .firstMatch
        XCTAssertTrue(changed.waitForExistence(timeout: 60), "復帰後に編集できない: \(app.debugDescription)")
        add(screenshotAttachment(named: "大きな編み図のバックグラウンド復帰"))
    }

    /// 共有シートの「ファイルに保存」と「コピー」が、PNGだけを渡して文面を渡さないことを
    /// Simulatorで確かめる（#474）。メール・メッセージはSimulatorに無いので実機で確かめる。
    ///
    ///     TEST_RUNNER_KNITTING_EDITOR_SHARE_SHEET_PROBE=1 xcodebuild test \
    ///       -project ios/knittingEditor.xcodeproj -scheme knittingEditor \
    ///       -destination 'platform=iOS Simulator,name=KE verify iPhone' \
    ///       -only-testing:knittingEditorUITests/KnittingEditorUITests/testShareSheetProbeSavesOnlyTheFileAndCopiesNoText
    ///
    /// 保存したファイルはFilesの「このiPhone内」の一覧で確かめる。
    func testShareSheetProbeSavesOnlyTheFileAndCopiesNoText() throws {
        try XCTSkipUnless(
            ProcessInfo.processInfo.environment["KNITTING_EDITOR_SHARE_SHEET_PROBE"] == "1",
            "Simulatorで共有シートのファイル操作を確かめるときだけ、TEST_RUNNER_KNITTING_EDITOR_SHARE_SHEET_PROBE=1を付けて実行する"
        )
        executionTimeAllowance = 600

        let app = XCUIApplication()
        app.launch()
        XCTAssertTrue(app.webViews.firstMatch.waitForExistence(timeout: Self.editorAppearanceTimeout))

        // 保存したファイルをホスト側で探せるよう、編み図名とファイル名を実行ごとに変える。
        let suffix = String(UUID().uuidString.prefix(8))
        let documentName = "共有確認-\(suffix)"
        let filenamePrefix = "share-probe-\(suffix)"
        let probeNote = "SHARE_SHEET_PROBE document=\(documentName) filenamePrefix=\(filenamePrefix)"
        print(probeNote)
        XCTContext.runActivity(named: probeNote) { _ in }
        createDocument(named: documentName, in: app)

        // 「コピー」はPNGだけをペーストボードへ渡す。前回の内容と混ざらないよう空にしてから共有する。
        UIPasteboard.general.items = []
        guard openPNGShareSheet(in: app, step: "コピー") else { return }
        let copySheet = shareSheet(in: app)
        let copy = shareSheetAction(labels: ["コピー", "Copy"], in: app, sheet: copySheet)
        XCTAssertTrue(waitForHittable(copy, timeout: 20), "共有シートに「コピー」が無い: \(app.debugDescription)")
        waitUntilStill(copy)
        add(screenshotAttachment(named: "共有シート-PNG-コピー"))
        copy.tap()
        assertDisappears(copySheet, from: app, note: "コピー後")

        // コピーが終わってPNGが入るまで待つ。空のままでは、文面が無いことを確かめたことにならない。
        let pasteboard = UIPasteboard.general
        let copied = XCTNSPredicateExpectation(
            predicate: NSPredicate { _, _ in pasteboard.contains(pasteboardTypes: ["public.png"]) },
            object: nil
        )
        _ = XCTWaiter.wait(for: [copied], timeout: 10)
        // 文面が入っていれば、文字列の種類としてペーストボードに残る。
        let copiedText = pasteboard.hasStrings ? pasteboard.string : nil
        let copiedTypes = pasteboard.types
        let copyNote = "SHARE_SHEET_PROBE copy items=\(pasteboard.numberOfItems) hasStrings=\(pasteboard.hasStrings) types=[\(copiedTypes.joined(separator: ", "))] string=\(copiedText ?? "nil")"
        print(copyNote)
        XCTContext.runActivity(named: copyNote) { _ in }
        let copyAttachment = XCTAttachment(string: copyNote)
        copyAttachment.name = "コピー後のペーストボード"
        copyAttachment.lifetime = .keepAlways
        add(copyAttachment)
        XCTAssertTrue(
            pasteboard.contains(pasteboardTypes: ["public.png"]),
            "コピーにPNGが入っていない: \(copyNote)"
        )
        XCTAssertFalse(pasteboard.hasStrings, "コピーに文字列が入っている: \(copyNote)")
        XCTAssertFalse(
            copiedTypes.contains { $0.contains("text") },
            "コピーに文字の種類が入っている: \(copyNote)"
        )

        // 「ファイルに保存」はPNGだけを端末内へ保存する。一意な名前で保存し、Filesでも確かめる。
        guard openPNGShareSheet(in: app, step: "ファイルに保存") else { return }
        let saveSheet = shareSheet(in: app)
        let saveToFiles = shareSheetAction(labels: ["ファイルに保存", "“ファイル”に保存", "Save to Files"], in: app, sheet: saveSheet)
        XCTAssertTrue(
            waitForHittable(saveToFiles, timeout: 20),
            "共有シートに「ファイルに保存」が無い: \(app.debugDescription)"
        )
        waitUntilStill(saveToFiles)
        add(screenshotAttachment(named: "共有シート-PNG-ファイルに保存"))
        saveToFiles.tap()

        let picker = SystemSheet.element(in: app)
        XCTAssertTrue(picker.waitForExistence(timeout: 20), app.debugDescription)
        add(screenshotAttachment(named: "ファイルに保存-保存先の選択"))
        XCTAssertTrue(
            selectOnDeviceLocationForSaving(in: app),
            "「このiPhone内」/「このiPad内」を選べない: \(app.debugDescription)"
        )

        // 名前を変えられる環境では一意な接頭辞を付け、変えられない環境では一意な編み図名の提案名を使う。
        var savedPrefix = documentName
        let filenameField = app.textFields["DOCPicker.filenameTextField"]
        if filenameField.waitForExistence(timeout: 10) {
            replaceText(filenamePrefix, in: filenameField, app: app)
            savedPrefix = filenamePrefix
        } else {
            print("SHARE_SHEET_PROBE filenameField=none default=\(documentName)")
        }
        let saveButton = app.buttons.matching(NSPredicate(format: "label IN %@", ["保存", "Save"])).firstMatch
        XCTAssertTrue(waitForHittable(saveButton, timeout: 20), "保存先を決められない: \(app.debugDescription)")
        add(screenshotAttachment(named: "ファイルに保存-保存先と名前"))
        saveButton.tap()

        let exportFinished = XCTNSPredicateExpectation(
            predicate: NSPredicate(format: "exists == false"),
            object: picker
        )
        if XCTWaiter.wait(for: [exportFinished], timeout: Self.editorAppearanceTimeout) != .completed {
            let replace = app.buttons.matching(NSPredicate(format: "label IN %@", ["置き換え", "Replace"])).firstMatch
            if replace.waitForExistence(timeout: 5) {
                waitUntilStill(replace)
                replace.tap()
            }
        }
        XCTAssertTrue(
            waitForDisappearance(of: picker, timeout: Self.editorAppearanceTimeout),
            "保存画面が閉じない: \(app.debugDescription)"
        )
        add(screenshotAttachment(named: "ファイルに保存-保存後"))

        // Filesの「このiPhone内」に、保存したPNGがあることを画面で確かめる。
        let files = XCUIApplication(bundleIdentifier: "com.apple.DocumentsApp")
        files.launch()
        if let browse = waitForFirstHittable(in: files, labels: ["ブラウズ", "Browse"], timeout: 20) {
            browse.tap()
        }
        let locations = ["このiPhone内", "このiPad内", "On My iPhone", "On My iPad"]
        if let location = waitForFirstHittable(in: files, labels: locations, timeout: 20) {
            waitUntilStill(location)
            location.tap()
        }
        let saved = files.cells
            .matching(NSPredicate(format: "label BEGINSWITH %@ OR identifier BEGINSWITH %@", savedPrefix, savedPrefix))
        let found = saved.firstMatch.waitForExistence(timeout: 20)
        add(screenshotAttachment(named: "ファイル-保存したPNG-\(savedPrefix)"))
        XCTAssertTrue(found, "Filesの「このiPhone内」に\(savedPrefix).pngが見つからない: \(files.debugDescription)")
        XCTAssertEqual(saved.count, 1, "同じ名前で2つ以上保存されている: \(files.debugDescription)")
        // 文面も渡っていれば、テキストのファイルが同じ場所に増える。名前は文面やシステムの既定名になる。
        let textFiles = files.cells.matching(NSPredicate(
            format: "label CONTAINS %@ OR label CONTAINS[c] %@ OR label BEGINSWITH %@ OR label BEGINSWITH %@",
            "棒針編み図エディタ", ".txt", "テキスト", "Text"
        ))
        XCTAssertEqual(textFiles.count, 0, "共有の文面がファイルとして保存されている: \(files.debugDescription)")
    }

    func testBackslashDocumentNameReachesAllNativeExportActions() {
        // 普段は約40〜70秒。CIでは前のテストのアプリの終了で約30秒、起動時の自動化セッションの準備で
        // 約1分止まることがあり、約160秒まで延びた（#358）。
        executionTimeAllowance = 240
        assertAllNativeExportActions(documentName: "試作\\修正版")
    }

    private func assertAllNativeExportActions(documentName name: String) {
        XCUIDevice.shared.orientation = .portrait
        let app = XCUIApplication()
        app.launch()
        XCTAssertTrue(app.webViews.firstMatch.waitForExistence(timeout: Self.editorAppearanceTimeout))
        createDocument(named: name, in: app)
        // 名前のダイアログが閉じる途中だと「出力」のタップが効かないことがある（#44）。
        openSavePanel(with: app.buttons["出力"], showing: app.buttons["PNGを保存"], in: app)
        for format in ["PNGを保存", "PDFを保存", "この編み図を書き出す"] {
            let export = app.buttons[format]
            XCTAssertTrue(export.waitForExistence(timeout: Self.editorAppearanceTimeout), app.debugDescription)
            export.tap()
            XCTAssertTrue(app.buttons["ファイルに保存"].waitForExistence(timeout: Self.editorAppearanceTimeout), "\(name): \(format): \(app.debugDescription)")
            XCTAssertTrue(app.buttons["共有"].exists)
            cancelExportAlert(in: app)
        }
        app.buttons["閉じる"].tap()
        waitForDocumentSave(named: name, in: app.webViews.firstMatch)
    }

    func testPrimaryControlsRemainUsableInPortraitAndLandscape() {
        let app = XCUIApplication()
        app.launch()

        XCTAssertTrue(app.webViews.firstMatch.waitForExistence(timeout: Self.editorAppearanceTimeout))
        assertPrimaryControlsAreUsable(in: app)

        rotateToLandscape(app)
        assertPrimaryControlsAreUsable(in: app)
        // 横向きでも、WebViewが画面の幅いっぱいに広がり、左右に黒い帯が出ない（#146）。
        let window = app.windows.firstMatch.frame
        let webView = app.webViews.firstMatch.frame
        XCTAssertEqual(webView.minX, window.minX, accuracy: 1, "WebViewの左に帯がある: \(webView) / \(window)")
        XCTAssertEqual(webView.maxX, window.maxX, accuracy: 1, "WebViewの右に帯がある: \(webView) / \(window)")

        openDocumentsPanel(in: app)
        XCTAssertTrue(app.buttons["閉じる"].isHittable, app.debugDescription)
    }

    /// 横向きでキーボードを出しても、名前の入力ダイアログの「キャンセル」「決定」が押せる（#151）。
    func testNameDialogButtonsStayAboveKeyboardInLandscape() {
        let app = XCUIApplication()
        app.launch()

        XCTAssertTrue(app.webViews.firstMatch.waitForExistence(timeout: Self.editorAppearanceTimeout))
        rotateToLandscape(app)
        openDocumentsPanel(in: app).tap()

        let nameField = app.textFields["入力"]
        XCTAssertTrue(nameField.waitForExistence(timeout: 10))
        nameField.tap()
        // CIのiPad Simulatorはハードウェアキーボード接続状態になり、画面のキーボードを出さないことがある。
        // iPhoneでは必ず出して確かめる。
        let keyboardShown = app.keyboards.firstMatch.waitForExistence(timeout: 5)
        if UIDevice.current.userInterfaceIdiom == .phone {
            XCTAssertTrue(keyboardShown, "キーボードが出ない: \(app.debugDescription)")
        }
        XCTAssertTrue(app.buttons["キャンセル"].isHittable, "キーボード表示=\(keyboardShown): \(app.debugDescription)")
        XCTAssertTrue(app.buttons["決定"].isHittable, "キーボード表示=\(keyboardShown): \(app.debugDescription)")
        app.buttons["キャンセル"].tap()
    }

    /// 「新しい編み図」を押すと、名前の入力欄をタップし直さなくても入力できる（#148）。
    /// WKWebViewはタップの処理の中でフォーカスした入力欄にしかキーボードを出さないので、
    /// 次のフレームでフォーカスしていた以前の作りでは、入力欄にフォーカスが入らなかった。
    func testNewDocumentDialogFocusesNameInputWithoutTapping() {
        let app = XCUIApplication()
        app.launch()
        // 実機は端末の向きのまま始まるので、縦向きにしてから確かめる。横向きは`testNameDialogButtonsStayAboveKeyboardInLandscape`で確かめる。
        XCUIDevice.shared.orientation = .portrait

        XCTAssertTrue(app.webViews.firstMatch.waitForExistence(timeout: Self.editorAppearanceTimeout))
        openDocumentsPanel(in: app).tap()

        let nameField = app.textFields["入力"]
        XCTAssertTrue(nameField.waitForExistence(timeout: 10))
        let focused = XCTNSPredicateExpectation(predicate: NSPredicate(format: "hasKeyboardFocus == true"), object: nameField)
        XCTAssertEqual(XCTWaiter.wait(for: [focused], timeout: 10), .completed, "入力欄にフォーカスが入らない: \(app.debugDescription)")
        // CIのiPad Simulatorはハードウェアキーボード接続状態になり、画面のキーボードを出さないことがある。
        // iPhoneでは画面のキーボードが出ることまで確かめる。
        if UIDevice.current.userInterfaceIdiom == .phone {
            XCTAssertTrue(app.keyboards.firstMatch.waitForExistence(timeout: 5), "キーボードが出ない: \(app.debugDescription)")
        }
        nameField.tap()
        // CIのiPad Simulatorはハードウェアキーボード接続状態になり、入力欄へ
        // フォーカスしてもソフトウェアキーボードを公開しない場合がある。出ないことを
        // 失敗にはしないが、出たときは本来の要件どおりキーボードで操作ボタンが
        // 隠れないことまで確かめる。`isHittable`は上に乗った要素を考慮する。
        let keyboardShown = app.keyboards.firstMatch.waitForExistence(timeout: 5)
        XCTAssertTrue(app.buttons["キャンセル"].isHittable, "キーボード表示=\(keyboardShown): \(app.debugDescription)")
        XCTAssertTrue(app.buttons["決定"].isHittable, "キーボード表示=\(keyboardShown): \(app.debugDescription)")

        // 画面の文字選択を抑えても（#81）、入力欄では文字を選択してコピーできる。
        nameField.doubleTap()
        let selectionActions = app.menuItems.matching(NSPredicate(
            format: "label IN %@",
            ["Copy", "コピー", "Cut", "カット", "Select", "選択", "Select All", "すべてを選択"]
        )).firstMatch
        // CIで直前のタップに続くダブルタップが効かず、問い合わせは速くてもメニューが出ないことがあった。
        var selectionActionsAppeared = selectionActions.waitForExistence(timeout: 5)
        if !selectionActionsAppeared {
            nameField.doubleTap()
            selectionActionsAppeared = selectionActions.waitForExistence(timeout: 10)
        }
        XCTAssertTrue(
            selectionActionsAppeared,
            "入力欄で文字を選択・コピーできない: \(app.debugDescription)"
        )
        app.buttons["キャンセル"].tap()
    }

    func testNarrowToolbarKeepsLongStitchAndPasteBandUsable() {
        XCUIDevice.shared.orientation = .portrait
        let app = XCUIApplication()
        app.launch()
        let picker = app.descendants(matching: .any)
            .matching(NSPredicate(format: "label == %@", "編み目記号を選ぶ")).firstMatch
        XCTAssertTrue(picker.waitForExistence(timeout: Self.editorAppearanceTimeout), app.debugDescription)
        picker.tap()
        // 記号の選択肢は`aria-pressed`を持つため、XCUITestではスイッチとして見える。
        let stitch = app.switches.matching(NSPredicate(format: "label BEGINSWITH %@", "右上2目交差")).firstMatch
        XCTAssertTrue(stitch.waitForExistence(timeout: 10), app.debugDescription)
        assertHittableAfterScrolling(stitch, in: app)
        stitch.tap()
        let range = app.switches["範囲"]
        XCTAssertTrue(range.isHittable, app.debugDescription)
        assertWithinWindow(range, in: app)
        range.tap()
        let canvas = app.webViews.firstMatch.otherElements
            .matching(NSPredicate(format: "label CONTAINS %@", "編み図編集盤面")).firstMatch
        let start = canvas.coordinate(withNormalizedOffset: CGVector(dx: 0.35, dy: 0.35))
        let end = canvas.coordinate(withNormalizedOffset: CGVector(dx: 0.55, dy: 0.55))
        start.press(forDuration: 0.05, thenDragTo: end)
        let copy = app.buttons["コピー"]
        XCTAssertTrue(copy.waitForExistence(timeout: 10), app.debugDescription)
        copy.tap()
        let stop = app.buttons["やめる"]
        XCTAssertTrue(stop.waitForExistence(timeout: 10), app.debugDescription)
        let paste = app.switches["貼付"]
        assertWithinWindow(paste, in: app)
        XCTAssertTrue(paste.isHittable, app.debugDescription)
        // 案内と操作ヒントの期限を過ぎても、盤面の上の帯は残る。
        Thread.sleep(forTimeInterval: 12)
        let band = app.staticTexts["貼付中：左上にするマスをタップ"]
        XCTAssertTrue(band.exists, app.debugDescription)
        XCTAssertLessThanOrEqual(stop.frame.maxY, canvas.frame.minY)
        add(screenshotAttachment(named: "狭幅・長い記号名と貼付中の帯"))
        stop.tap()
        XCTAssertTrue(waitForDisappearance(of: stop, timeout: 10), app.debugDescription)
        XCTAssertEqual(app.switches["描く"].value as? String, "1")
    }

    func testLandscapeExportPanelUsesRightColumn() {
        let app = XCUIApplication()
        app.launch()
        let output = app.buttons["出力"]
        XCTAssertTrue(output.waitForExistence(timeout: Self.editorAppearanceTimeout), app.debugDescription)
        rotateToLandscape(app)
        defer { XCUIDevice.shared.orientation = .portrait }
        let png = app.buttons["PNGを保存"]
        openSavePanel(with: output, showing: png, in: app)
        let close = app.buttons["閉じる"]
        XCTAssertTrue(close.waitForExistence(timeout: 10), app.debugDescription)
        let window = app.windows.firstMatch.frame
        // 下からのシートでも「閉じる」は右上に出るため、全幅になる本文のボタンの左端で右列かを確かめる。
        XCTAssertTrue(png.waitForExistence(timeout: 10), app.debugDescription)
        XCTAssertGreaterThan(png.frame.minX, window.midX, app.debugDescription)
        XCTAssertLessThan(close.frame.minY, window.midY, app.debugDescription)
        for label in ["PNGを保存", "PDFを保存", "この編み図を書き出す", "全データを書き出す", "バックアップから復元"] {
            assertHittableAfterScrolling(app.buttons[label], in: app)
        }
        add(screenshotAttachment(named: "横向き・出力パネルの右列"))
        close.tap()
        app.buttons["編み図"].tap()
        XCTAssertTrue(close.waitForExistence(timeout: 10), app.debugDescription)
        let newDocument = app.buttons["新しい編み図"]
        XCTAssertTrue(newDocument.waitForExistence(timeout: 10), app.debugDescription)
        XCTAssertGreaterThan(newDocument.frame.minX, window.midX, app.debugDescription)
        XCTAssertLessThan(close.frame.minY, window.midY, app.debugDescription)
    }

    func testCoreEditorControlsExposeAccessibleNamesAndState() {
        let app = XCUIApplication()
        app.launch()

        let webView = app.webViews.firstMatch
        XCTAssertTrue(webView.waitForExistence(timeout: Self.editorAppearanceTimeout))
        let stitchPicker = app.descendants(matching: .any)
            .matching(NSPredicate(format: "label == %@", "編み目記号を選ぶ"))
            .firstMatch
        // `webViews.firstMatch`はWKWebViewの器が出た時点で成立し、Reactの描画完了を
        // 意味しない。起動直後に最初のページ内要素を待つ箇所は、他のテストと同じく
        // 起動用の待機上限を使う。ストレージ初期化だけでも最大10秒かかり得る。
        XCTAssertTrue(stitchPicker.waitForExistence(timeout: Self.editorAppearanceTimeout), app.debugDescription)
        XCTAssertEqual(app.switches["描く"].value as? String, "1")
        XCTAssertEqual(app.switches["消す"].value as? String, "0")
        XCTAssertEqual(app.switches["範囲"].value as? String, "0")
        XCTAssertTrue(app.buttons["出力"].exists)

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

        openSavePanel(with: app.buttons["出力"], showing: app.buttons["閉じる"], in: app)
        XCTAssertTrue(app.staticTexts["出力"].waitForExistence(timeout: 10), app.debugDescription)
        XCTAssertTrue(app.buttons["閉じる"].isHittable, app.debugDescription)
        app.buttons["閉じる"].tap()
        XCTAssertTrue(app.buttons["出力"].isHittable, app.debugDescription)

        stitchPicker.tap()
        XCTAssertTrue(app.staticTexts["編み目記号"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.buttons["閉じる"].isHittable, app.debugDescription)
    }

    // 最大文字の縦向き操作は1起動にまとめる。回転の高コストを避けるため横向きは別起動を維持する。

    func testAccessibilityExtraExtraExtraLargeKeepsPrimaryControlsUsable() {
        // 普段でも約65秒かかる。CIでは起動時の自動化セッションの準備がときどき約1分止まり、既定の3分を超えた（#355）。
        executionTimeAllowance = 240
        let app = launchWithAccessibilityExtraExtraExtraLarge()

        assertPrimaryControlsAreUsable(in: app)
        openDocumentsPanel(in: app)
        XCTAssertTrue(app.buttons["閉じる"].isHittable, app.debugDescription)
        app.buttons["閉じる"].tap()
        let save = app.buttons["出力"]
        XCTAssertTrue(save.waitForExistence(timeout: Self.editorAppearanceTimeout), app.debugDescription)
        openSavePanel(with: save, showing: app.buttons["PNGを保存"], in: app)
        assertHittableAfterScrolling(app.buttons["PNGを保存"], in: app)
        assertHittableAfterScrolling(app.buttons["PDFを保存"], in: app)
        assertHittableAfterScrolling(app.buttons["この編み図を書き出す"], in: app)
    }

    /// iPhone・iPad、可変幅で選択操作帯が操作メニューを覆わないことを確認する。
    func testAccessibilityExtraExtraExtraLargeKeepsSelectionActionsSeparate() {
        let app = launchWithAccessibilityExtraExtraExtraLarge()
        assertPrimaryControlsAreUsable(in: app)
        add(screenshotAttachment(named: "最大文字・通常の操作列"))
        // 上の確認は道具列を「線」まで送った状態で終わるため、「範囲」を押せる位置へ戻す。
        let rangeSwitch = app.switches["範囲"]
        scrollHorizontallyUntilHittable(rangeSwitch, in: app, row: primaryToolsRow(in: app))
        rangeSwitch.tap()
        let canvas = app.webViews.firstMatch.otherElements
            .matching(NSPredicate(format: "label CONTAINS %@", "編み図編集盤面"))
            .firstMatch
        XCTAssertTrue(canvas.waitForExistence(timeout: 10), app.debugDescription)
        // 最大文字では段数・目数の目盛りの帯が広がるので、帯の外側にある盤面の内側をなぞる。
        let start = canvas.coordinate(withNormalizedOffset: CGVector(dx: 0.55, dy: 0.55))
        let end = canvas.coordinate(withNormalizedOffset: CGVector(dx: 0.8, dy: 0.8))
        start.press(forDuration: 0.05, thenDragTo: end)
        let copy = app.buttons["コピー"]
        let save = app.buttons["選択範囲をブロックに保存"]
        let erase = app.buttons["選択範囲を消去"]
        let clear = app.buttons["キャンセル"]
        XCTAssertTrue(copy.waitForExistence(timeout: 10), app.debugDescription)
        // 選択操作帯は1行のまま横スクロールし、最大文字では「キャンセル」が最初は画面の外にある。
        // 各操作を帯の内側で押せる位置へ出し、見えている間だけ下の操作メニューと重ならないことを確かめる。
        let selectionBar = selectionActionsRow(in: app)
        XCTAssertTrue(selectionBar.waitForExistence(timeout: 10), app.debugDescription)
        for action in [copy, save, erase, clear] {
            scrollHorizontallyUntilHittable(action, in: app, row: selectionBar)
            for name in ["盤面", "ブロック", "出力"] {
                let button = app.buttons[name]
                XCTAssertTrue(button.isHittable, app.debugDescription)
                XCTAssertFalse(action.frame.intersects(button.frame), "選択操作帯の\(action.label)が\(name)を覆う")
            }
        }
        // 選択操作帯が縦の空きを使い切らず、選んだ範囲が見える高さの盤面が残る。
        XCTAssertGreaterThanOrEqual(canvas.frame.height, 120, "選択中に盤面が見えない: \(canvas.frame)")
        add(screenshotAttachment(named: "最大文字・選択操作帯と操作列"))
        clear.tap()
        XCTAssertTrue(waitForDisappearance(of: copy, timeout: 10), app.debugDescription)
        for name in ["盤面", "ブロック", "出力"] {
            XCTAssertTrue(app.buttons[name].isHittable, app.debugDescription)
        }
        add(screenshotAttachment(named: "最大文字・選択解除後"))
    }

    /// 横向きの回帰防止。ヘッダーを固定高にしていたため、最大アクセシビリティサイズでは
    /// 「編み図」「使い方」が画面上端の外（y=-58）へ押し出されて操作できなかった。
    /// 起動の前に横向きにして、要素の多い画面での回転を避ける。
    func testAccessibilityExtraExtraExtraLargeKeepsLandscapeHeaderInWindow() {
        XCUIDevice.shared.orientation = .landscapeLeft
        let app = launchWithAccessibilityExtraExtraExtraLarge()
        waitForLandscapeLayout(of: app)

        XCTAssertTrue(app.buttons["編み図"].waitForExistence(timeout: 10), app.debugDescription)
        assertWithinWindow(app.buttons["編み図"], in: app)
        assertWithinWindow(app.links["使い方"], in: app)
        assertPrimaryControlsAreUsable(in: app)
    }

    /// AX3（アクセシビリティL）でも、文字が200%まで大きくなって主要な操作が押せることを確認する。
    /// ヘッダーは折り返して「使い方」「編み図」を画面内に残し、操作メニューは折り返して
    /// 全ボタンを見せる。道具列は1行のまま横スクロールするため「範囲」「線」は帯を送って出す。
    func testAccessibilityExtraLargeKeepsPrimaryControlsUsable() {
        // AX5のテストと同じく、CIの遅い起動が既定の3分を超えないようにする（#355）。
        executionTimeAllowance = 240
        let app = launchWithAccessibilityExtraLarge()

        assertPrimaryControlsAreUsable(in: app)

        let guide = app.links["使い方"]
        let documents = app.buttons["編み図"]
        for element in [guide, documents] {
            XCTAssertTrue(element.isHittable, "\(element.label) を操作できない: \(app.debugDescription)")
            assertWithinWindow(element, in: app)
        }

        // 盤面設定パネルを開いても、ヘッダーの「使い方」「編み図」は隠れない。
        // iPhoneは全画面のシートなので、パネルの下にヘッダーが残るiPadだけで確かめる。
        app.buttons["盤面"].tap()
        XCTAssertTrue(app.staticTexts["盤面設定"].waitForExistence(timeout: 10), app.debugDescription)
        let close = app.buttons["閉じる"]
        XCTAssertTrue(close.waitForExistence(timeout: 10), app.debugDescription)
        if UIDevice.current.userInterfaceIdiom == .pad {
            for element in [guide, documents] {
                XCTAssertTrue(element.isHittable, "パネルを開くと\(element.label)を操作できない: \(app.debugDescription)")
                XCTAssertFalse(
                    element.frame.intersects(close.frame),
                    "パネルを開くと\(element.label)が閉じるボタンと重なる " +
                        "\(element.label)=\(element.frame) 閉じる=\(close.frame): \(app.debugDescription)"
                )
            }
        }
        add(screenshotAttachment(named: "AX3・盤面設定パネル"))
        XCTAssertTrue(close.isHittable, "盤面設定パネルを閉じられない: \(app.debugDescription)")
        close.tap()
        XCTAssertTrue(waitForDisappearance(of: close, timeout: 10), app.debugDescription)

        // 記号の選択画面は道具列の先頭にある。横スクロールで「線」まで送ったあとも開けることを確かめる。
        let stitchPicker = app.descendants(matching: .any)
            .matching(NSPredicate(format: "label == %@", "編み目記号を選ぶ"))
            .firstMatch
        scrollHorizontallyUntilHittable(stitchPicker, in: app, row: primaryToolsRow(in: app))
        stitchPicker.tap()
        XCTAssertTrue(app.staticTexts["編み目記号"].waitForExistence(timeout: 10), app.debugDescription)
        XCTAssertTrue(close.isHittable, "記号の選択画面を閉じられない: \(app.debugDescription)")
        close.tap()
        XCTAssertTrue(waitForDisappearance(of: app.staticTexts["編み目記号"], timeout: 10), app.debugDescription)
        XCTAssertTrue(stitchPicker.isHittable, "記号の選択画面を閉じたあと道具列へ戻れない: \(app.debugDescription)")
    }

    /// AX3・AX5で、Issue #389の主な操作を一通り行い、各段階の画面写真を残す。
    ///
    /// WKWebViewの文字描画とDynamic TypeはSimulatorと実機で同じため、Simulatorの画面写真で
    /// 文字の重なりや意味の分からない切れがないかを確かめられる。通常のCIでは環境変数が
    /// 無いため実行しない（PRスモーク・実機の一覧にも入れない）。
    func testAccessibilityLargeTextMainOperationsWalkthrough() throws {
        try XCTSkipUnless(
            ProcessInfo.processInfo.environment["KNITTING_EDITOR_LARGE_TEXT_WALKTHROUGH"] == "1",
            "SimulatorでAX3・AX5の主な操作を画面写真付きで確かめるときだけ実行する"
        )
        // 2つの文字サイズで作成・編集・範囲選択・出力・切替・使い方まで行うため、既定の3分では足りない。
        executionTimeAllowance = 1200
        for (prefix, category) in [
            ("AX3", "UICTContentSizeCategoryAccessibilityL"),
            ("AX5", "UICTContentSizeCategoryAccessibilityXXXL"),
        ] {
            let app = launchWithContentSizeCategory(category)
            walkThroughLargeTextMainOperations(prefix: prefix, in: app)
            app.terminate()
        }
    }

    /// 1つの文字サイズ分の主な操作。画面写真は「AX3-01-create-chart」のように手順の番号を付ける。
    private func walkThroughLargeTextMainOperations(prefix: String, in app: XCUIApplication) {
        let suffix = UUID().uuidString.prefix(8)
        let firstChart = "\(prefix)主操作A-\(suffix)"
        let secondChart = "\(prefix)主操作B-\(suffix)"

        // 01 新しい編み図を作る。
        createDocument(named: firstChart, in: app)
        _ = positionSaveProbeCanvas(count: 0, in: app)
        assertWalkthroughChrome(in: app)
        add(screenshotAttachment(named: "\(prefix)-01-create-chart"))

        // 02 記号を選ぶ。色の一覧に出すため、先に1つ置いてから色を選ぶ。
        let stitchPicker = app.descendants(matching: .any)
            .matching(NSPredicate(format: "label == %@", "編み目記号を選ぶ"))
            .firstMatch
        scrollHorizontallyUntilHittable(stitchPicker, in: app, row: primaryToolsRow(in: app))
        stitchPicker.tap()
        let stitchHeading = app.staticTexts["編み目記号"]
        XCTAssertTrue(stitchHeading.waitForExistence(timeout: 10), app.debugDescription)
        let stitch = app.switches
            .matching(NSPredicate(format: "label BEGINSWITH %@", "右上2目交差"))
            .firstMatch
        assertHittableAfterScrolling(stitch, in: app)
        add(screenshotAttachment(named: "\(prefix)-02-choose-stitch"))
        stitch.tap()
        XCTAssertTrue(waitForDisappearance(of: stitchHeading, timeout: 10), app.debugDescription)
        // 選んだ記号の名前が道具列に残っているかを、道具列が左端にあるうちに残す。
        add(screenshotAttachment(named: "\(prefix)-02-choose-stitch-selected"))
        // 大きな文字では盤面の表示範囲が狭く（AX5のiPhoneで約4段）、`saveProbeCell`が前提とする
        // 20段×20目が見えない。この走査では、表示中の盤面の左上から数えたマスを使う。
        let emptyCanvas = positionSaveProbeCanvas(count: 0, in: app)
        tapChangingStitchCount("1つ目の記号", from: 0, to: 1, in: app) {
            visibleBoardCell(row: 1, col: 4, on: emptyCanvas).tap()
        }

        // 03 色を選ぶ。入力欄の色はOSの色選択を開くため、いま置いた記号の色見本を使う。
        let colorTool = app.descendants(matching: .any)
            .matching(NSPredicate(format: "label BEGINSWITH %@", "記号の色を選ぶ"))
            .firstMatch
        scrollHorizontallyUntilHittable(colorTool, in: app, row: primaryToolsRow(in: app))
        colorTool.tap()
        let colorHeading = app.staticTexts["記号の色"]
        XCTAssertTrue(colorHeading.waitForExistence(timeout: 10), app.debugDescription)
        let usedColor = app.descendants(matching: .any)
            .matching(NSPredicate(format: "label CONTAINS %@ AND label CONTAINS %@", "#d33c32", "、記号"))
            .firstMatch
        XCTAssertTrue(usedColor.waitForExistence(timeout: 10), app.debugDescription)
        assertWithinWindow(usedColor, in: app)
        XCTAssertTrue(usedColor.isHittable, app.debugDescription)
        add(screenshotAttachment(named: "\(prefix)-03-choose-colour"))
        // OSの色選択は開かず、使っている色の一覧から選ぶ（この時点では1色だけ）。
        usedColor.tap()
        XCTAssertTrue(waitForDisappearance(of: colorHeading, timeout: 10), app.debugDescription)
        assertWithinWindow(colorTool, in: app)
        XCTAssertTrue(colorTool.isHittable, app.debugDescription)
        XCTAssertTrue(colorTool.label.contains("#d33c32"), colorTool.label)

        // 04 選んだ色で記号をもう1つ置く。
        let oneCanvas = positionSaveProbeCanvas(count: 1, in: app)
        tapChangingStitchCount("2つ目の記号", from: 1, to: 2, in: app) {
            visibleBoardCell(row: 3, col: 4, on: oneCanvas).tap()
        }
        let twoCanvas = saveProbeCanvas(count: 2, in: app)
        waitForStitchCount(2, on: twoCanvas, in: app)
        assertWalkthroughChrome(in: app)
        add(screenshotAttachment(named: "\(prefix)-04-place-symbols"))

        // 05 消すモードで、後から置いた記号を消す。
        let eraseSwitch = app.switches["消す"]
        XCTAssertTrue(eraseSwitch.waitForExistence(timeout: 10), app.debugDescription)
        scrollHorizontallyUntilHittable(eraseSwitch, in: app, row: primaryToolsRow(in: app))
        eraseSwitch.tap()
        let twoForErase = positionSaveProbeCanvas(count: 2, in: app)
        tapChangingStitchCount("後から置いた記号の消去", from: 2, to: 1, in: app) {
            visibleBoardCell(row: 3, col: 4, on: twoForErase).tap()
        }
        let oneAfterErase = saveProbeCanvas(count: 1, in: app)
        waitForStitchCount(1, on: oneAfterErase, in: app)
        let drawSwitch = app.switches["描く"]
        scrollHorizontallyUntilHittable(drawSwitch, in: app, row: primaryToolsRow(in: app))
        drawSwitch.tap()
        XCTAssertEqual(app.switches["描く"].value as? String, "1", app.debugDescription)
        add(screenshotAttachment(named: "\(prefix)-05-erase"))

        // 06 範囲を選んでコピーする。
        let rangeSwitch = app.switches["範囲"]
        scrollHorizontallyUntilHittable(rangeSwitch, in: app, row: primaryToolsRow(in: app))
        rangeSwitch.tap()
        let canvasForSelection = positionSaveProbeCanvas(count: 1, in: app)
        let boardHeightBeforePaste = canvasForSelection.frame.height
        // 記号のある1段だけを選ぶ。貼り付けは空のマスも上書きするので、選ぶ段が多いと
        // 貼り付け先が元の記号に重なりやすい。
        visibleBoardCell(row: 1, col: 1, on: canvasForSelection)
            .press(forDuration: 0.05, thenDragTo: visibleBoardCell(row: 1, col: 10, on: canvasForSelection))
        let selectionBar = selectionActionsRow(in: app)
        XCTAssertTrue(selectionBar.waitForExistence(timeout: 10), app.debugDescription)
        // 帯全体と帯の中のボタンが、下の操作列のボタンに重ならないことを確かめる。
        func assertClearOfBottomActions(_ bar: XCUIElement, _ name: String) {
            let elements = [bar] + bar.buttons.allElementsBoundByIndex
            for bottom in ["盤面", "ブロック", "出力"] {
                let bottomFrame = app.buttons[bottom].frame
                for element in elements {
                    let overlap = element.frame.intersection(bottomFrame)
                    XCTAssertTrue(
                        overlap.isNull || overlap.width * overlap.height < 1,
                        "\(name)が\(bottom)を覆う \(element.label)=\(element.frame) \(bottom)=\(bottomFrame)"
                    )
                }
            }
        }
        let copy = app.buttons["コピー"]
        scrollHorizontallyUntilHittable(copy, in: app, row: selectionBar)
        assertWithinWindow(copy, in: app)
        XCTAssertTrue(copy.isHittable, app.debugDescription)
        assertClearOfBottomActions(selectionBar, "選択操作帯")
        add(screenshotAttachment(named: "\(prefix)-06-select-copy"))
        copy.tap()
        let pasteBand = app.staticTexts["貼付中：左上にするマスをタップ"]
        XCTAssertTrue(pasteBand.waitForExistence(timeout: 10), app.debugDescription)

        // 07 貼り付け先をタップし、貼付をやめる。
        let canvasForPaste = positionSaveProbeCanvas(count: 1, in: app)
        var stitchCount = 2
        let stopPaste = app.buttons["やめる"]
        let pasteBar = pasteActionsRow(in: app)
        let pasteHasNoRoom = canvasForPaste.frame.height < Self.largeTextBoardBand + 30
        if pasteHasNoRoom {
            // AX5のiPhoneでは、貼付中の帯で盤面が1段分も残らず、貼り付け先を選べない（#389の残り）。
            // 走査の残りの手順を確かめるため、既知の失敗として記録し、貼付をやめて進む。
            // ほかの端末・文字サイズで同じことが起きたり、貼付の前から盤面が狭かったりしたときは、
            // 既知の問題ではないので失敗にする。
            add(screenshotAttachment(named: "\(prefix)-07-paste-no-room"))
            XCTAssertTrue(
                prefix == "AX5" && UIDevice.current.userInterfaceIdiom == .phone,
                "AX5のiPhone以外で貼付中の盤面が\(canvasForPaste.frame.height)ptしかない"
            )
            XCTAssertGreaterThanOrEqual(
                boardHeightBeforePaste,
                Self.largeTextBoardBand + 30,
                "貼付の前から盤面が狭い: \(app.debugDescription)"
            )
            XCTExpectFailure("#389: 貼付中の盤面に貼り付け先のマスが見えない") {
                XCTFail("貼付中の盤面の高さが\(canvasForPaste.frame.height)ptしかない")
            }
            stitchCount = 1
        } else {
            // 貼付中の帯が盤面の上に入ると、盤面の表示位置がずれる。貼り付けは空のマスも上書きするので、
            // 元の記号と同じ段に貼ると元の記号が消えて記号数が変わらない。1回目で変わらなければ、
            // 1段下（元の記号とは違う段）を叩く。
            var pasteRow = 0
            tapChangingStitchCount("貼り付け先のタップ", from: 1, to: 2, in: app) {
                visibleBoardCell(row: pasteRow, col: 1, on: canvasForPaste).tap()
                pasteRow += 1
            }
            let pastedCanvas = saveProbeCanvas(count: 2, in: app)
            waitForStitchCount(2, on: pastedCanvas, in: app)
        }
        XCTAssertTrue(pasteBand.exists, app.debugDescription)
        scrollHorizontallyUntilHittable(stopPaste, in: app, row: pasteBar)
        assertWithinWindow(stopPaste, in: app)
        if pasteHasNoRoom {
            // 同じ#389の残り。AX5のiPhoneでは「やめる」が下の操作列（盤面・ブロック）の後ろに入る。
            // 想定するのは重なりの失敗だけで、ほかの失敗は通常どおり失敗にする。
            let options = XCTExpectedFailure.Options()
            options.isStrict = false
            options.issueMatcher = { $0.compactDescription.contains("を覆う") }
            XCTExpectFailure("#389: 貼付中の「やめる」が下の操作列に重なる", options: options) {
                assertClearOfBottomActions(pasteBar, "貼付の操作帯")
            }
        } else {
            XCTAssertTrue(stopPaste.isHittable, app.debugDescription)
            assertClearOfBottomActions(pasteBar, "貼付の操作帯")
        }
        add(screenshotAttachment(named: "\(prefix)-07-paste"))
        stopPaste.tap()
        XCTAssertTrue(waitForDisappearance(of: pasteBand, timeout: 10), app.debugDescription)
        XCTAssertEqual(app.switches["描く"].value as? String, "1", app.debugDescription)

        // 08 盤面の段数・列数を変える。
        let resized = resizeBoardForLargeText(
            rows: 160,
            cols: 70,
            in: app,
            screenshotName: "\(prefix)-08-resize-fields"
        )
        XCTAssertTrue(resized.label.contains("記号\(stitchCount)個"), resized.debugDescription)
        assertWalkthroughChrome(in: app)
        add(screenshotAttachment(named: "\(prefix)-08-resize-board"))

        // 09〜11 PNG・PDF・.knitをシステムの保存画面まで開き、既存のテストと同じく閉じる。
        let save = app.buttons["出力"]
        XCTAssertTrue(save.waitForExistence(timeout: 10), app.debugDescription)
        openSavePanel(with: save, showing: app.buttons["PNGを保存"], in: app)
        for (buttonName, step) in [
            ("PNGを保存", "09-save-png"),
            ("PDFを保存", "10-save-pdf"),
            ("この編み図を書き出す", "11-save-knit"),
        ] {
            let export = app.buttons[buttonName]
            // 出力パネルは保存画面を閉じたあとも開いたまま残る。閉じていた場合だけ開き直す。
            if !app.buttons["閉じる"].exists {
                openSavePanel(with: save, showing: export, in: app)
            }
            assertHittableAfterScrolling(export, in: app)
            assertWithinWindow(export, in: app)
            export.tap()
            let fileSave = app.buttons["ファイルに保存"]
            XCTAssertTrue(fileSave.waitForExistence(timeout: Self.editorAppearanceTimeout), app.debugDescription)
            XCTAssertTrue(app.buttons["共有"].exists, app.debugDescription)
            guard tapExportAlertButton(fileSave, in: app, step: "\(prefix)-\(step)") else { return }
            let systemSheet = SystemSheet.element(in: app)
            XCTAssertTrue(systemSheet.waitForExistence(timeout: 20), app.debugDescription)
            add(screenshotAttachment(named: "\(prefix)-\(step)-system-sheet"))
            let dismissal = dismissSystemSheet(in: app)
            assertDisappears(systemSheet, from: app, note: "\(prefix) \(step) \(dismissal)")
            add(screenshotAttachment(named: "\(prefix)-\(step)"))
        }
        if app.buttons["閉じる"].exists {
            let close = app.buttons["閉じる"]
            assertWithinWindow(close, in: app)
            XCTAssertTrue(close.isHittable, app.debugDescription)
            close.tap()
            XCTAssertTrue(
                waitForDisappearance(of: app.buttons["この編み図を書き出す"], timeout: 10),
                app.debugDescription
            )
        }
        assertWalkthroughChrome(in: app)

        // 12 2つ目の編み図を作り、一覧で1つ目へ切り替える。
        createDocument(named: secondChart, in: app)
        _ = positionSaveProbeCanvas(count: 0, in: app)
        _ = openDocumentsPanel(in: app)
        let firstItem = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", firstChart + "、")).firstMatch
        let secondItem = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", secondChart + "、")).firstMatch
        // 大きな文字では一覧の各項目も高く、下の項目はパネルを送らないと押せない。
        // 上の項目から順に押せる位置まで送り、最後に切り替え先の1つ目を画面内へ残す。
        // AX5のiPhoneでは編み図名を折り返して、項目がパネルの見える範囲より高くなる
        // （約490pt）。全体は画面に収まらないので、見える部分を押して切り替わることを確かめる。
        let isTall = { (item: XCUIElement) in item.frame.height >= app.windows.firstMatch.frame.height / 3 }
        for item in [secondItem, firstItem] {
            XCTAssertTrue(item.waitForExistence(timeout: 10), app.debugDescription)
            if !isTall(item) {
                assertHittableAfterScrolling(item, in: app)
                assertWithinWindow(item, in: app)
                XCTAssertTrue(item.isHittable, app.debugDescription)
            }
        }
        add(screenshotAttachment(named: "\(prefix)-12-switch-chart"))
        if isTall(firstItem) {
            tapVisiblePart(of: firstItem, in: app)
        } else {
            firstItem.tap()
        }
        let firstTitle = app.webViews.firstMatch.staticTexts
            .matching(NSPredicate(format: "label BEGINSWITH %@", firstChart))
            .firstMatch
        XCTAssertTrue(firstTitle.waitForExistence(timeout: 10), app.debugDescription)
        _ = saveProbeCanvas(count: stitchCount, in: app)
        waitForDocumentSave(named: firstChart, in: app.webViews.firstMatch)
        assertWalkthroughChrome(in: app)
        add(screenshotAttachment(named: "\(prefix)-12-switched-chart"))

        // 13 使い方を開く。
        let guide = app.links["使い方"]
        XCTAssertTrue(guide.waitForExistence(timeout: 10), app.debugDescription)
        assertWithinWindow(guide, in: app)
        XCTAssertTrue(guide.isHittable, app.debugDescription)
        openGuide(with: guide, in: app)
        add(screenshotAttachment(named: "\(prefix)-13-open-guide"))

        // 14 使い方から編集画面へ戻る。
        let back = app.links.matching(identifier: "編集画面へ戻る").firstMatch
        XCTAssertTrue(back.waitForExistence(timeout: 10), app.debugDescription)
        scrollWebViewUntilHittable(back, in: app)
        back.tap()
        let output = app.buttons["出力"]
        if !output.waitForExistence(timeout: 10), back.exists {
            scrollWebViewUntilHittable(back, in: app)
            back.tap()
        }
        XCTAssertTrue(output.waitForExistence(timeout: 20), "使い方から編集画面へ戻れない: \(app.debugDescription)")
        XCTAssertFalse(app.otherElements["editorLoadingOverlay"].exists, app.debugDescription)
        let restoredCanvas = saveProbeCanvas(count: stitchCount, in: app)
        XCTAssertTrue(restoredCanvas.exists, app.debugDescription)
        assertWalkthroughChrome(in: app)
        add(screenshotAttachment(named: "\(prefix)-14-close-guide"))
    }

    /// 各段階で、ヘッダーと操作メニューの主要なボタンが画面内で押せることを確かめる。
    private func assertWalkthroughChrome(in app: XCUIApplication) {
        let window = app.windows.firstMatch.frame.insetBy(dx: -1, dy: -1)
        for name in ["編み図", "盤面", "ブロック", "出力"] {
            let button = app.buttons[name]
            XCTAssertTrue(button.waitForExistence(timeout: 10), "\(name) が見つからない: \(app.debugDescription)")
            XCTAssertTrue(waitForHittable(button, timeout: 10), "\(name) を操作できない: \(app.debugDescription)")
            XCTAssertTrue(
                window.contains(button.frame),
                "\(name) が画面外 \(button.frame) / \(window): \(app.debugDescription)"
            )
        }
        let guide = app.links["使い方"]
        XCTAssertTrue(guide.waitForExistence(timeout: 10), app.debugDescription)
        XCTAssertTrue(waitForHittable(guide, timeout: 10), "使い方を操作できない: \(app.debugDescription)")
        XCTAssertTrue(
            window.contains(guide.frame),
            "使い方が画面外 \(guide.frame) / \(window): \(app.debugDescription)"
        )
    }

    /// 大きな文字では段数・列数の欄が縦に並び、「変更」がキーボードやパネルの外へ出る。
    /// キーボードを閉じ、「変更」が押せる位置までパネルを送ってから盤面の大きさを変える。
    /// `screenshotName`は、値を入れた段数・列数の欄を残すための名前。
    private func resizeBoardForLargeText(
        rows: Int,
        cols: Int,
        in app: XCUIApplication,
        screenshotName: String
    ) -> XCUIElement {
        app.buttons["盤面"].tap()
        let rowsField = app.textFields["段数"]
        XCTAssertTrue(rowsField.waitForExistence(timeout: Self.editorAppearanceTimeout), app.debugDescription)
        func closeKeyboard() {
            guard app.keyboards.firstMatch.exists else { return }
            app.staticTexts["盤面設定"].tap()
            if !waitForDisappearance(of: app.keyboards.firstMatch, timeout: 5) {
                // 見出しで閉じないときは、パネルの外のヘッダーを押して入力を外す。
                // iPhoneとiPadでヘッダーの高さが違うため、ヘッダーの中に収まる位置を使う。
                let headerY: CGFloat = UIDevice.current.userInterfaceIdiom == .pad ? 0.06 : 0.1
                app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: headerY)).tap()
                _ = waitForDisappearance(of: app.keyboards.firstMatch, timeout: 5)
            }
        }
        replaceNumber(rows, in: rowsField, app: app)
        // AX5のiPhoneでは列数の欄が画面の下にあり、段数の入力で出たキーボードに隠れる。
        // キーボードを閉じ、欄が押せる位置まで動かしてから入力する。
        closeKeyboard()
        let colsField = app.textFields["列数"]
        assertHittableAfterScrolling(colsField, in: app)
        replaceNumber(cols, in: colsField, app: app)
        closeKeyboard()
        add(screenshotAttachment(named: screenshotName))
        let change = app.buttons["変更"]
        XCTAssertTrue(change.waitForExistence(timeout: 10), app.debugDescription)
        assertHittableAfterScrolling(change, in: app)
        change.tap()

        let resized = app.webViews.firstMatch.otherElements
            .matching(NSPredicate(format: "label CONTAINS %@", "\(rows)段、\(cols)目"))
            .firstMatch
        XCTAssertTrue(resized.waitForExistence(timeout: 120), "盤面を\(rows)×\(cols)にできない: \(app.debugDescription)")
        let close = app.buttons["閉じる"]
        XCTAssertTrue(close.waitForExistence(timeout: 10), app.debugDescription)
        assertWithinWindow(close, in: app)
        XCTAssertTrue(close.isHittable, app.debugDescription)
        close.tap()
        return resized
    }

    /// 指定した文字サイズ（Dynamic Type）にして起動し、編集画面が`webReady`を送り、
    /// 準備中の表示が消えるまで待ってからWebの内容を探す（#64）。
    private func launchWithContentSizeCategory(_ category: String) -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments += [
            "-UIPreferredContentSizeCategoryName",
            category,
        ]
        app.launch()
        XCTAssertTrue(app.webViews.firstMatch.waitForExistence(timeout: Self.editorAppearanceTimeout))
        XCTAssertTrue(
            waitForDisappearance(of: app.descendants(matching: .any)["editorLoadingOverlay"], timeout: Self.editorAppearanceTimeout),
            app.debugDescription
        )
        return app
    }

    /// 文字サイズを最大（アクセシビリティXXXL・AX5）にして起動する。
    private func launchWithAccessibilityExtraExtraExtraLarge() -> XCUIApplication {
        launchWithContentSizeCategory("UICTContentSizeCategoryAccessibilityXXXL")
    }

    /// 文字サイズをAX3（アクセシビリティL）にして起動する。
    private func launchWithAccessibilityExtraLarge() -> XCUIApplication {
        launchWithContentSizeCategory("UICTContentSizeCategoryAccessibilityL")
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
        // WebViewのisHittableは、スクロール領域のクリップや固定ヘッダーを考慮しない。
        // 開いているパネルの閉じるボタンは1つだけ。パネル名やロール表記には依存しない。
        let close = app.buttons["閉じる"]
        guard close.waitForExistence(timeout: 10) else {
            XCTFail("パネルの閉じるボタンが見つからない: \(app.debugDescription)")
            return
        }
        // 対象ボタンの横位置でドラッグすると、押した位置の別のボタンがタップとして成立することがある。
        // 横向きiPhoneでは「PNGを保存」が押されて保存のアラートが開き、以後のドラッグが効かなかった（#317）。
        // パネルの左の余白なら操作対象が無い。右の余白はiPadでスクロールバーをつかんでしまい、
        // 中央に出る記号の選択画面では外側の背景に当たって閉じるので使わない。
        // 余白はパネルの左右で同じ幅のため、「閉じる」の右に残る幅の半分だけ左端から入った位置を押す。
        let dragX: CGFloat
        if let panel = panelFrame(in: app) {
            dragX = panel.minX + (panel.maxX - close.frame.maxX) / 2
        } else {
            dragX = element.frame.midX
        }
        for scrolls in 0...maximumScrolls {
            let bounds = app.windows.firstMatch.frame
            // ヘッダーの下余白も避け、ボタン全体が見えるまでスクロールする。
            let top = max(bounds.minY, close.frame.maxY + 8)
            let visible = CGRect(x: bounds.minX, y: top, width: bounds.width, height: max(0, bounds.maxY - top))
                .insetBy(dx: 2, dy: 2)
            let frame = element.frame
            if visible.contains(frame) && element.isHittable { return }
            guard visible.height > frame.height, visible.width > frame.width else {
                XCTFail("操作対象がパネルに収まらない frame=\(frame) visible=\(visible): \(app.debugDescription)")
                return
            }
            guard scrolls < maximumScrolls else { break }
            // 残りの距離に合わせてゆっくり動かす。行き過ぎた場合は逆方向へ戻す。
            let direction: CGFloat = frame.minY < visible.minY ? 1 : -1
            let remaining = direction > 0 ? visible.minY - frame.minY : frame.maxY - visible.maxY
            let distance = max(40, min(remaining + 8, visible.height * 0.6))
            let start = app.coordinate(withNormalizedOffset: .zero)
                .withOffset(CGVector(dx: dragX, dy: visible.midY - direction * distance / 2))
            let end = start.withOffset(CGVector(dx: 0, dy: direction * distance))
            start.press(forDuration: 0.05, thenDragTo: end, withVelocity: .slow, thenHoldForDuration: 0.1)
            // アラートが開くとパネルを覆い、残りのドラッグがすべて効かなくなるので打ち切る。
            if app.alerts.firstMatch.exists {
                XCTFail("ドラッグがパネル内のタップになり、アラートが開いた: \(app.debugDescription)")
                return
            }
            // predicateの約1秒刻みの待機を避け、ドラッグ後だけ短く位置を確認する。
            let deadline = Date().addingTimeInterval(1)
            var previous = element.frame
            for _ in 0..<6 {
                guard Date() < deadline else { break }
                Thread.sleep(forTimeInterval: 0.15)
                let current = element.frame
                if current == previous { break }
                previous = current
            }
        }
        XCTFail("スクロールしても操作対象がパネル内に見えない: \(app.debugDescription)")
    }

    /// 編集ツール列を返す。大きな文字では1行のまま横スクロールする。
    private func primaryToolsRow(in app: XCUIApplication) -> XCUIElement {
        app.descendants(matching: .any)
            .matching(NSPredicate(format: "label BEGINSWITH %@", "編集ツール"))
            .firstMatch
    }

    /// 選択範囲の操作帯を返す。大きな文字では1行のまま横スクロールする。
    private func selectionActionsRow(in app: XCUIApplication) -> XCUIElement {
        app.descendants(matching: .any)
            .matching(NSPredicate(format: "label BEGINSWITH %@", "選択範囲の操作"))
            .firstMatch
    }

    /// 貼付中の操作帯を返す。大きな文字では1行のまま横スクロールする。
    private func pasteActionsRow(in app: XCUIApplication) -> XCUIElement {
        app.descendants(matching: .any)
            .matching(NSPredicate(format: "label BEGINSWITH %@", "貼付の操作"))
            .firstMatch
    }

    /// 横スクロールする帯の中の要素が、画面内に収まって押せるところまで来たかを返す。
    ///
    /// WebViewの`isHittable`はスクロール領域のクリップを考慮しないことがあるため、
    /// 枠が画面内に収まっていることも確かめる。
    private func isFullyHittableInWindow(_ element: XCUIElement, in app: XCUIApplication) -> Bool {
        guard element.exists else { return false }
        let frame = element.frame
        guard !frame.isEmpty else { return false }
        let window = app.windows.firstMatch.frame.insetBy(dx: -1, dy: -1)
        return window.contains(frame) && isHittableWithoutFailing(element)
    }

    /// 横スクロールする帯（編集ツール列・選択範囲の操作帯）の中の要素を、押せる位置まで送る。
    ///
    /// 大きな文字では帯が1行のまま横スクロールし、「範囲」「線」「キャンセル」は最初は
    /// 画面の右外にある。`swipeLeft()`は勢いで行き過ぎ、戻す操作も要るため、帯の内側を
    /// 小さくドラッグして少しずつ送る。要素の上からドラッグを始めると、押した位置の
    /// ボタンがタップとして成立することがあるので（#317）、帯の上端の余白を掴む。
    /// 画面端4pt以内から始めると端のスワイプとして扱われるため、端から離した位置から動かす。
    /// 左へ送っても押せないときは、行き過ぎた場合に備えて右へ戻す。
    private func scrollHorizontallyUntilHittable(
        _ element: XCUIElement,
        in app: XCUIApplication,
        row: XCUIElement,
        maximumScrolls: Int = 8
    ) {
        XCTAssertTrue(element.waitForExistence(timeout: 10), "横スクロールで出す要素が見つからない: \(app.debugDescription)")
        XCTAssertTrue(row.waitForExistence(timeout: 10), "横スクロールする帯が見つからない: \(app.debugDescription)")
        var direction: CGFloat = -1
        var scrolls = 0
        while scrolls < maximumScrolls * 2 {
            if isFullyHittableInWindow(element, in: app) { return }
            let window = app.windows.firstMatch.frame
            // 中身がはみ出す帯の枠は内容の幅になることがあるため、画面内に切ってから使う。
            let rowFrame = row.frame.intersection(window)
            guard rowFrame.width > 48, rowFrame.height > 16 else {
                XCTFail("横スクロールする帯の位置を取れない row=\(row.frame) window=\(window): \(app.debugDescription)")
                return
            }
            if scrolls == 0 {
                // 右外にある要素は左へ、行き過ぎて左外にある要素は右へ送る。
                let frame = element.frame
                direction = frame.isEmpty || frame.midX >= rowFrame.midX ? -1 : 1
            } else if scrolls == maximumScrolls {
                // 押せないまま送り切ったら、行き過ぎた場合に備えて逆へ戻す。
                direction = -direction
            }
            // 角の丸みとボタンを避け、帯の上端の余白を掴む。画面端から24pt内側から始める。
            let startX = direction < 0 ? rowFrame.maxX - 24 : rowFrame.minX + 24
            let y = rowFrame.minY + 4
            guard startX > window.minX + 4, startX < window.maxX - 4 else {
                XCTFail("横スクロールを始める位置が画面端に近い startX=\(startX) window=\(window): \(app.debugDescription)")
                return
            }
            let distance = min(160, max(60, rowFrame.width * 0.35))
            let start = app.coordinate(withNormalizedOffset: .zero)
                .withOffset(CGVector(dx: startX, dy: y))
            let end = start.withOffset(CGVector(dx: direction * distance, dy: 0))
            start.press(forDuration: 0.05, thenDragTo: end, withVelocity: .slow, thenHoldForDuration: 0.1)
            scrolls += 1
            // スクロールの反映が遅れることがあるため、位置が止まり、押せるようになるまで待つ。
            let deadline = Date().addingTimeInterval(2)
            var settled = element.frame
            while Date() < deadline {
                Thread.sleep(forTimeInterval: 0.2)
                let current = element.frame
                if current == settled, isFullyHittableInWindow(element, in: app) { return }
                settled = current
            }
        }
        XCTFail(
            "横スクロール\(scrolls)回でも操作対象が画面内で押せない " +
                "要素=\(element.frame) 帯=\(row.frame): \(app.debugDescription)"
        )
    }

    /// 開いているパネル（「閉じる」を直接の子に持つ要素）の枠を、画面の木を1回だけ取得して求める。
    private func panelFrame(in app: XCUIApplication) -> CGRect? {
        guard let root = try? app.snapshot() else { return nil }
        var pending: [XCUIElementSnapshot] = [root]
        while let node = pending.popLast() {
            if node.children.contains(where: { $0.elementType == .button && $0.label == "閉じる" }) {
                return node.frame
            }
            pending.append(contentsOf: node.children)
        }
        return nil
    }

    /// 保存シートを閉じる。
    ///
    /// iPadは「×」ボタン（label「Cancel」「キャンセル」）を押せるが、iPhoneでは同じボタンへ到達できず
    /// `isHittable`もfalseになる。ウィンドウ状態によっても押せるかどうかが変わるため、
    /// 押してから閉じたことを確かめ、閉じていなければ画面座標の下スワイプへ落とす。
    /// iPhoneでも「×」が一瞬だけ現れ、押せると判定した直後に消えることがある（#44）。
    /// `tap()`は対象が消えているとその場でテストを失敗にするので、枠を`snapshot()`で取り、
    /// その中心を座標で押す。枠が取れなければ押さずに下スワイプへ進む。
    /// 戻り値は失敗時の診断用に、どの手段まで試したかを表す。
    @discardableResult
    private func dismissSystemSheet(in app: XCUIApplication) -> String {
        let sheet = SystemSheet.element(in: app)
        let closeButton = SystemSheet.closeButton(in: app)
        let buttonExists = closeButton.waitForExistence(timeout: 5)
        let buttonHittable = buttonExists && closeButton.isHittable
        let buttonFrame = buttonHittable ? (try? closeButton.snapshot())?.frame : nil
        if let buttonFrame, !buttonFrame.isEmpty {
            app.coordinate(withNormalizedOffset: .zero)
                .withOffset(CGVector(dx: buttonFrame.midX, dy: buttonFrame.midY))
                .tap()
            if waitForDisappearance(of: sheet, timeout: 5) {
                return "閉じ方=×ボタン"
            }
        }
        let swipeDown = {
            app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.15)).press(
                forDuration: 0.05,
                thenDragTo: app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.98)),
                withVelocity: .default,
                thenHoldForDuration: 0.0
            )
        }
        swipeDown()
        // createDocument・confirmDialogと同じく、操作が効いていないと分かった場合だけやり直す。
        let needsSecondSwipe = !waitForDisappearance(of: sheet, timeout: 10)
        if needsSecondSwipe { swipeDown() }
        let retryNote = needsSecondSwipe ? "、再スワイプ" : ""
        let frameNote = buttonFrame.map { "\($0)" } ?? "なし"
        return "閉じ方=下スワイプ\(retryNote)(×ボタン exists=\(buttonExists) hittable=\(buttonHittable) frame=\(frameNote)) window=\(app.windows.firstMatch.frame)"
    }

    /// 要素の位置と大きさが変わらないことを確かめる。画面全体が拡大されると、拡大の
    /// アニメーションのあとで値が変わるため、少し待ってから判断する。
    private func assertFrameUnchanged(
        of element: XCUIElement,
        from frame: CGRect,
        in app: XCUIApplication,
        note: String
    ) {
        let changed = XCTNSPredicateExpectation(
            predicate: NSPredicate { object, _ in
                guard let current = (object as? XCUIElement)?.frame else { return false }
                return abs(current.minX - frame.minX) > 1 || abs(current.minY - frame.minY) > 1
                    || abs(current.width - frame.width) > 1 || abs(current.height - frame.height) > 1
            },
            object: element
        )
        XCTAssertEqual(
            XCTWaiter.wait(for: [changed], timeout: 2),
            .timedOut,
            "\(note)の位置が変わった（画面全体が拡大された） before=\(frame) after=\(element.frame): \(app.debugDescription)"
        )
    }

    private func screenshotAttachment(named name: String) -> XCTAttachment {
        let attachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        return attachment
    }

    private func waitForValue(_ value: String, of element: XCUIElement, timeout: TimeInterval) -> Bool {
        let reached = XCTNSPredicateExpectation(
            predicate: NSPredicate(format: "value == %@", value),
            object: element
        )
        return XCTWaiter.wait(for: [reached], timeout: timeout) == .completed
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
        openDocumentsPanel(in: app).tap()
        let nameField = app.textFields["入力"]
        XCTAssertTrue(nameField.waitForExistence(timeout: Self.editorAppearanceTimeout), app.debugDescription)
        replaceText(name, in: nameField, app: app)
        confirmDialog(closing: nameField, in: app)
    }

    /// 「編み図」を押してパネルを開き、「新しい編み図」を返す。
    ///
    /// 起動直後や画面の向きを変えた直後は「編み図」のタップが効かず、パネルが開かないことが
    /// ある（iPadのCIで、起動直後は「新しい編み図」が45秒現れず、横向きにした約10秒後の
    /// タップでもパネルの「閉じる」が無いままだった）。しばらく待っても出ないときは、
    /// パネルが開いていない（「閉じる」もない）場合に限って押し直す。開いているのに
    /// 出なければ押し直すとパネルを閉じてしまうので、そのまま待って失敗にする。
    /// アプリ更新テストのように遅い実行では、`timeout`で最後の待機を延ばす。
    ///
    /// 押し直しても開かないことがあり（#44）、1回目のタップが遅れて効いて開いたパネルを
    /// 押し直しで閉じたのか、どちらのタップも効かなかったのかを見分けられなかった。
    /// 開かなかったときは、各タップの時刻とその前後のパネルの有無、画面写真を残す。
    /// 「編み図」の`aria-expanded`はXCUITestの`value`に出ないため、パネルの有無は
    /// 「閉じる」で判断する。
    ///
    /// アプリ更新テストでは、起動直後の1回目のタップが約半数で効かなかった（#441）。
    /// 準備中の表示（`editorLoadingOverlay`）が覆っている間も、下の「編み図」は見えるので、
    /// 文字サイズのテストと同じく表示が消えるのを待ってから押す。原因を確かめるため、各タップの前の
    /// 準備中の表示の有無と押せるかを残す。1回目で開かなかったときと準備中の表示が消えなかったときは、
    /// 経過をジョブログにも出す。
    @discardableResult
    private func openDocumentsPanel(
        in app: XCUIApplication,
        timeout: TimeInterval = KnittingEditorUITests.editorAppearanceTimeout
    ) -> XCUIElement {
        let documents = app.buttons["編み図"]
        let newDocument = app.buttons["新しい編み図"]
        let close = app.buttons["閉じる"]
        let loadingOverlay = app.descendants(matching: .any)["editorLoadingOverlay"]
        XCTAssertTrue(documents.waitForExistence(timeout: timeout), app.debugDescription)
        let started = Date()
        var events: [String] = []
        func record(_ event: String) {
            events.append(String(format: "%.1f秒 ", Date().timeIntervalSince(started)) + event)
        }
        func tapDocuments(_ action: String) {
            let state = "準備中=\(loadingOverlay.exists)、押せる=\(documents.exists && isHittableWithoutFailing(documents))"
            documents.tap()
            record("「編み図」を\(action)（押す前: \(state)）")
        }

        if !waitForDisappearance(of: loadingOverlay, timeout: timeout) {
            record("\(Int(timeout))秒待っても準備中の表示が消えない")
        }
        tapDocuments("タップ")
        if !newDocument.waitForExistence(timeout: 10) {
            let panelShown = close.exists
            record("10秒待っても「新しい編み図」が無い（閉じる=\(panelShown)）")
            if !panelShown {
                add(screenshotAttachment(named: "「編み図」が効かず押し直す"))
                tapDocuments("押し直した")
                record("押し直した直後の閉じる=\(close.exists)")
            }
        }
        let opened = newDocument.waitForExistence(timeout: timeout)
        if events.count > 1 {
            let summary = "TAPRETRY 編み図 " + events.joined(separator: " → ")
                + (opened ? " → パネルが開いた" : "")
            print(summary)
            XCTContext.runActivity(named: summary) { _ in }
        }
        if opened {
            return newDocument
        }
        record("最後の待機でも「新しい編み図」が無い（閉じる=\(close.exists)）")
        add(screenshotAttachment(named: "「編み図」でパネルが開かない"))
        XCTFail("「編み図」でパネルが開かない 経過: \(events.joined(separator: " → ")): \(app.debugDescription)")
        return newDocument
    }

    /// 端末を横向きにし、WebViewが横長に配置し直されるまで待つ。
    ///
    /// 向きの設定は端末へ伝えた時点で戻り、レイアウトの完了を待たない。以前の
    /// `app.windows.firstMatch`の存在確認は向きと関係なく成立し、待機になっていなかった。
    private func rotateToLandscape(_ app: XCUIApplication) {
        XCUIDevice.shared.orientation = .landscapeLeft
        waitForLandscapeLayout(of: app)
    }

    /// WebViewが横長に配置されるまで待つ。
    private func waitForLandscapeLayout(of app: XCUIApplication) {
        let webView = app.webViews.firstMatch
        let landscape = XCTNSPredicateExpectation(
            predicate: NSPredicate { element, _ in
                guard let frame = (element as? XCUIElement)?.frame else { return false }
                return frame.width > frame.height
            },
            object: webView
        )
        XCTAssertEqual(
            XCTWaiter.wait(for: [landscape], timeout: 10),
            .completed,
            "横向きの配置にならない webView=\(webView.frame): \(app.debugDescription)"
        )
    }

    private func replaceText(_ text: String, in field: XCUIElement, app: XCUIApplication) {
        // タップは1回だけにする。連続タップだと、1回目でキーボードが出て入力欄が上へ
        // スクロールしたあと、2回目以降が元の座標に残った別の要素へ当たる
        // （ダイアログが背景へずれ、入力した名前ごと取り消された）。
        // ダイアログは開いた時点で初期値を全選択するが、入力欄をタップすると選択が外れて
        // タップ位置にキャレットが入るため、上書きは当てにできない（CIでは毎回一致せず、
        // 消して入れ直す手順まで進んでいた）。末尾側を叩いてキャレットを値の後ろへ置く。
        field.coordinate(withNormalizedOffset: CGVector(dx: 0.95, dy: 0.5)).tap()
        // キーボードが出る前に入力すると先頭文字を取りこぼす。出ない環境でも
        // 入力自体は可能なので、待つだけで失敗にはしない。
        _ = app.keyboards.firstMatch.waitForExistence(timeout: 10)
        // 遅いランナーでは操作1つが数秒から数十秒かかるため、削除と入力を1回の操作にまとめる。
        // 取りこぼしたときだけ、末尾のキャレットから同じ手順でもう一度入れ直す。
        for _ in 0..<2 {
            // 読んだ値が古いと削除が足りず、正しく入った名前の末尾だけを消して二重に入力する
            // （iPadで`M2切M2切替A`になった）。余分な削除は先頭で止まるだけなので多めに送る。
            let current = (field.value as? String) ?? ""
            let deletes = String(repeating: XCUIKeyboardKey.delete.rawValue, count: current.count + text.count + 2)
            field.typeText(deletes + text)
            // 入力欄の値は入力より遅れて反映されることがある。すぐ読んで不一致と判断すると、
            // 正しく入っていても入れ直してしまうため、反映を待ってから判断する。
            if waitForValue(text, of: field, timeout: 10) { break }
        }
        XCTAssertEqual(field.value as? String, text, app.debugDescription)
    }

    /// 入力ダイアログの「決定」を押し、ダイアログが閉じたことを確かめる。
    ///
    /// キーボード（iPadのハードウェアキーボード接続時は入力補助バー）が遅れて出ると
    /// WebViewが縮み、中央に置いたダイアログが上へ動く。XCUITestは要素を探してから
    /// 合成タップを送るまでに時間がかかるため、その間に動くと元の座標を叩いて外れる
    /// （入力欄に正しい名前が入ったまま、ダイアログが開きっぱなしになった）。
    /// 閉じなかったときは、ボタンの位置が変わっていた場合に限って押し直す。位置が
    /// 変わっていないのに閉じなければ「決定」が効いていないので、そのまま失敗にする。
    private func confirmDialog(closing field: XCUIElement, in app: XCUIApplication) {
        let confirm = app.buttons["決定"]
        let frameBeforeTap = confirm.frame
        confirm.tap()
        if waitForDisappearance(of: field, timeout: 10) { return }
        if confirm.exists, confirm.frame != frameBeforeTap {
            confirm.tap()
        }
        XCTAssertTrue(
            waitForDisappearance(of: field, timeout: Self.editorAppearanceTimeout),
            "「決定」でダイアログが閉じない: \(app.debugDescription)"
        )
    }

    /// 盤面の編集が記号数へ反映されるまで待つ。CIの遅い区間ではXCUITestの操作1回に
    /// 数十秒かかったため、起動用の上限で待つ（反映されれば直ちに終わる）。
    private func waitForStitchCount(_ count: Int, on canvas: XCUIElement, in app: XCUIApplication) {
        let reached = XCTNSPredicateExpectation(
            predicate: NSPredicate(format: "label CONTAINS %@", "記号\(count)個"),
            object: canvas
        )
        XCTAssertEqual(
            XCTWaiter.wait(for: [reached], timeout: Self.editorAppearanceTimeout),
            .completed,
            "記号が\(count)個にならない: \(canvas.label) \(app.debugDescription)"
        )
    }

    /// 「使い方」を押し、使い方ページの見出しが出るまで待つ。
    ///
    /// アプリはリンクを押す前に保存の完了を最大2秒待ち、確かめられなければ編集画面に
    /// 残って理由を通知する（`guideNavigation.ts`）。このヘルパー自身は保存を待たず、
    /// 受け取ったリンクを押して、保存待ちで仕様どおり残った場合と、タップがWebKitで
    /// クリックにならなかった場合を見分けられるよう、通知の文言とヘッダーの保存状態の
    /// 変化を時刻付きで残す。通知が1つも出ず、タップから10秒たっても見出しが出ないまま
    /// 編集画面のときだけ、クリックが届かなかったとみなして1回押し直す（#401）。
    /// 通知が出ていればアプリはタップを受けているので、押し直して隠さない。
    /// 再発の観察は#44で続ける。
    private func openGuide(with link: XCUIElement, in app: XCUIApplication) {
        let webView = app.webViews.firstMatch
        let heading = webView.staticTexts["棒針編み図の作り方"].firstMatch
        let export = app.buttons["出力"]
        let started = Date()
        var events: [String] = []
        func record(_ event: String) {
            events.append(String(format: "%.1f秒 ", Date().timeIntervalSince(started)) + event)
        }
        func emit(_ prefix: String) {
            let summary = prefix + " " + events.joined(separator: " → ")
            print(summary)
            XCTContext.runActivity(named: summary) { _ in }
        }
        // 通知は4.5秒で消える（`NOTIFICATION_DURATION_MS`）。使い方への移動を説明する
        // 文言だけを拾い、保存待ちのタイムアウト・保留・保存失敗のどれだったか分ける。
        func isGuideToast(_ label: String) -> Bool {
            label.contains("使い方を開") || label.contains("もう一度「使い方」")
        }
        // ページが切り替わる途中に要素を個別に読むと、`exists`と`label`の間で消えて
        // 「Failed to get matching snapshot」のテスト失敗になる。1回のスナップショット
        // から静的なテキストのラベルだけを取り出し、失敗した回は数えて次の周回に任せる
        // （`snapshot()`は例外を投げるだけでテストを失敗させない）。
        func staticTextLabels() -> [String]? {
            guard let snapshot = try? webView.snapshot() else { return nil }
            var labels: [String] = []
            func collect(_ node: XCUIElementSnapshot) {
                if node.elementType == .staticText { labels.append(node.label) }
                node.children.forEach(collect)
            }
            collect(snapshot)
            return labels
        }
        func saveStatus(in labels: [String]) -> String {
            // 通知の「保存中に新しい編集が入りました」と混同しないよう、状態の文言で
            // 終わる静的テキストだけを見る（読み上げ用は「、保存済み」のように読点が付く）。
            for status in ["保存済み", "保存中", "保存失敗"]
            where labels.contains(where: { $0.hasSuffix(status) }) {
                return status
            }
            return ""
        }

        var lastSaveStatus = ""
        if let labels = staticTextLabels() {
            lastSaveStatus = saveStatus(in: labels)
            record("ヘッダーの保存状態「\(lastSaveStatus.isEmpty ? "なし" : lastSaveStatus)」")
        }
        var toasts: Set<String> = []
        var retried = false
        var readSnapshots = 0
        var unreadSnapshots = 0

        // 再タップは要素を解決し直さず、タップ前に読んだリンクの中心を座標で押す。
        // 遷移が始まった直後に消えた要素を押して「Failed to get matching snapshot」に
        // なるのを避ける（#401）。
        let linkFrame = link.frame
        link.tap()
        // 10秒の再タップ判定と45秒の見出し待ちは、タップ自体に時間が掛かっても
        // 足りなくならないよう、タップが戻った時点から数える。
        let tappedAt = Date()
        record(String(format: "「使い方」をタップ（タップに%.1f秒）", tappedAt.timeIntervalSince(started)))
        var shown = false
        while Date().timeIntervalSince(tappedAt) < Self.editorAppearanceTimeout {
            // 見出しが現れれば直ちに戻る。現れないときだけ0.5秒待つ。
            if heading.waitForExistence(timeout: 0.5) {
                shown = true
                break
            }
            if let labels = staticTextLabels() {
                readSnapshots += 1
                for label in labels where isGuideToast(label) {
                    if toasts.insert(label).inserted {
                        record("通知「\(label)」")
                    }
                }
                let status = saveStatus(in: labels)
                if status != lastSaveStatus {
                    record("ヘッダーの保存状態「\(status.isEmpty ? "なし" : status)」")
                    lastSaveStatus = status
                }
            } else {
                unreadSnapshots += 1
            }
            // 通知が無いまま10秒たっても見出しが出ず、編集画面のままなら、タップが
            // WebKitでクリックになっていない可能性がある。結果が同じ操作なので1回だけ
            // 押し直し、次回に分かるよう画面写真とその時点の経過を残す。通知を1件でも
            // 見た場合と、タップ後にスナップショットを1回も読めなかった場合は、通知の
            // 有無を判断できないため押し直さない。
            if !retried, toasts.isEmpty, readSnapshots > 0,
                Date().timeIntervalSince(tappedAt) >= 10,
                !heading.exists, link.exists, export.exists {
                retried = true
                record("通知が無いまま10秒たっても見出しが出ない（編集画面のまま）。クリックが届いていないとみなして押し直す")
                add(screenshotAttachment(named: "「使い方」のタップが届かない"))
                emit("GUIDE_RETRY")
                app.coordinate(withNormalizedOffset: .zero)
                    .withOffset(CGVector(dx: linkFrame.midX, dy: linkFrame.midY)).tap()
                record("「使い方」を押し直した")
            }
        }
        let appeared = shown || heading.exists
        if appeared {
            record("「棒針編み図の作り方」が出た")
        } else {
            record("最後まで「棒針編み図の作り方」が出ない（通知\(toasts.count)件、保存状態「\(lastSaveStatus.isEmpty ? "なし" : lastSaveStatus)」、スナップショット成功\(readSnapshots)回・読めなかった回 \(unreadSnapshots)）")
            add(screenshotAttachment(named: "「使い方」で見出しが出ない"))
        }
        // 押し直した場合は、通っても通らなくても経過をジョブログとxcresultへ残す。
        if retried {
            emit("GUIDE_RETRY_RESULT")
        } else if !appeared {
            emit("GUIDE_FAIL")
        }
        if appeared { return }
        XCTFail("「使い方」を押しても使い方ページへ移らない（通知\(toasts.count)件、保存状態「\(lastSaveStatus.isEmpty ? "なし" : lastSaveStatus)」、読めなかった回 \(unreadSnapshots)） 経過: \(events.joined(separator: " → ")): \(app.debugDescription)")
    }

    /// 盤面のアクセシブルな名前から現在の記号数を読む。
    private func stitchCount(of canvas: XCUIElement) -> Int? {
        let label = canvas.label
        guard let range = label.range(of: "記号[0-9]+個", options: .regularExpression) else { return nil }
        return Int(label[range].filter(\.isNumber))
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

    /// 主要な操作が押せることを確認する。
    ///
    /// ヘッダーの「編み図」と操作メニュー（盤面・ブロック・出力）は折り返して
    /// 全体を見せるため、スクロールせずに押せる。編集ツール列は1行のまま横スクロールし、
    /// 大きな文字では「範囲」「線」が最初は画面の外にあるので、帯を送って押せる位置へ出す。
    private func assertPrimaryControlsAreUsable(in app: XCUIApplication) {
        for name in ["編み図", "盤面", "ブロック", "出力"] {
            let button = app.buttons[name]
            // WebViewの器は中身より先に現れるため、起動用の上限で待つ（出れば直ちに終わる）。
            XCTAssertTrue(
                button.waitForExistence(timeout: Self.editorAppearanceTimeout),
                "\(name) が見つかりません: \(app.debugDescription)"
            )
            XCTAssertTrue(button.isHittable, "\(name) を操作できません: \(app.debugDescription)")
        }

        let stitchPicker = app.descendants(matching: .any)
            .matching(NSPredicate(format: "label == %@", "編み目記号を選ぶ"))
            .firstMatch
        XCTAssertTrue(stitchPicker.waitForExistence(timeout: 10), app.debugDescription)
        XCTAssertTrue(stitchPicker.isHittable, app.debugDescription)

        // 4つのモードは帯の左から順に並ぶ。左端の2つはスクロールせずに押せ、
        // 右の2つは大きな文字で画面の外に出るため、帯を送って確かめる。
        let toolbar = primaryToolsRow(in: app)
        for name in ["描く", "消す", "範囲", "線"] {
            let mode = app.switches[name]
            XCTAssertTrue(mode.waitForExistence(timeout: 10), "\(name) が見つかりません: \(app.debugDescription)")
            scrollHorizontallyUntilHittable(mode, in: app, row: toolbar)
        }
    }

    /// 画面より高い項目は全体を画面に収められない。見える部分が44pt以上になるまで
    /// 項目のあるパネル（iPhoneは下から出る一覧、iPadは右の列）の上で短く送り、
    /// 動きが止まってから、パネルの中で見えている部分の中央を押す。
    private func tapVisiblePart(of element: XCUIElement, in app: XCUIApplication, maximumDrags: Int = 20) {
        let webView = app.webViews.firstMatch
        // 盤面の上で動かしたり押したりすると、盤面が動いたり記号を置いたりする。パネルの枠で判断する。
        let container = (panelFrame(in: app) ?? webView.frame).intersection(webView.frame)
        let minimumVisible: CGFloat = 44
        var drags = 0
        while element.frame.intersection(container).height < minimumVisible, drags < maximumDrags {
            let isBelow = element.frame.minY >= container.maxY - minimumVisible
            let start = app.coordinate(withNormalizedOffset: .zero)
                .withOffset(CGVector(dx: container.midX, dy: container.midY))
            let distance = min(250, container.height / 3)
            let end = start.withOffset(CGVector(dx: 0, dy: isBelow ? -distance : distance))
            start.press(forDuration: 0.1, thenDragTo: end)
            waitUntilStill(element)
            drags += 1
        }
        let visible = element.frame.intersection(container)
        XCTAssertGreaterThanOrEqual(
            visible.height,
            minimumVisible,
            "\(drags)回送っても見える部分が足りない 要素=\(element.frame) パネル=\(container)"
        )
        guard !visible.isNull, visible.height >= minimumVisible else { return }
        app.coordinate(withNormalizedOffset: .zero)
            .withOffset(CGVector(dx: visible.midX, dy: visible.midY))
            .tap()
    }

    /// WebViewのページを上へ送り、要素が押せる位置に来るまで待つ。
    /// 実機のiPhoneは1回のスワイプで600pt前後しか送らず、高さ約9,800ptの使い方ページの
    /// 末尾まで14回では届かなかった。押せる位置に来たら止まるので、上限は多めにする。
    private func scrollWebViewUntilHittable(
        _ element: XCUIElement,
        in app: XCUIApplication,
        maximumSwipes: Int = 30
    ) {
        let webView = app.webViews.firstMatch
        var swipes = 0
        while !isHittableInWebView(element, webView: webView), swipes < maximumSwipes {
            webView.swipeUp()
            swipes += 1
            let hittable = XCTNSPredicateExpectation(
                predicate: NSPredicate { _, _ in
                    self.isHittableInWebView(element, webView: webView)
                },
                object: element
            )
            _ = XCTWaiter.wait(for: [hittable], timeout: 2)
        }
        XCTAssertTrue(
            isHittableInWebView(element, webView: webView),
            "スワイプ\(swipes)回で押せる位置に来ない 要素=\(element.frame) WebView=\(webView.frame): \(app.debugDescription)"
        )
    }

    /// 画面外での判定失敗と下端の帯への誤タップを避けるため、先に枠を確かめる。
    private func isHittableInWebView(_ element: XCUIElement, webView: XCUIElement) -> Bool {
        guard element.exists, webView.exists else { return false }
        let frame = element.frame
        let webViewFrame = webView.frame
        guard !frame.isEmpty, webViewFrame.contains(frame),
              frame.maxY <= webViewFrame.maxY - 34 else { return false }
        return isHittableWithoutFailing(element)
    }

    /// 「最近使った項目」に依存せず、端末内に保存したバックアップを選べる状態まで待つ。
    private func backupFileInOnDeviceLocation(named fileName: String, in app: XCUIApplication) -> XCUIElement? {
        // 選択画面は別プロセスで表示されるため、シートの子孫ではなくアプリ全体から探す。
        let locations = app.descendants(matching: .any)
            .matching(NSPredicate(format: "label IN %@", ["このiPhone内", "このiPad内", "On My iPhone", "On My iPad"]))
        // 同じ名前の見出しや非表示のサイドバーも一致するため、画面内で押せる候補を探す。
        // 空や画面外のframeでisHittableを読むと、falseではなくXCTestの失敗になる。
        // 画面内の枠でも失敗になったため（#317）、isHittableは失敗を記録しない形で読む。
        // 候補の一覧の解決が待機の時間切れで打ち切られたときも、見つからなかったとして扱う（#44）。
        func waitForLocation(timeout: TimeInterval) -> XCUIElement? {
            var location: XCUIElement?
            let hittable = XCTNSPredicateExpectation(
                predicate: NSPredicate { _, _ in
                    location = self.ignoringWaiterInterruption {
                        let window = app.windows.firstMatch.frame
                        return locations.allElementsBoundByIndex.first { element in
                            guard element.exists else { return false }
                            let frame = element.frame
                            return !frame.isEmpty && window.intersects(frame) && self.isHittableWithoutFailing(element)
                        }
                    }
                    return location != nil
                },
                object: app
            )
            guard XCTWaiter.wait(for: [hittable], timeout: timeout) == .completed else { return nil }
            return location
        }
        // iPadではサイドバーに保存場所が出る場合があるので、先に直接探す。
        if waitForLocation(timeout: 2) == nil {
            let browse = app.buttons
                .matching(NSPredicate(format: "label IN %@", ["ブラウズ", "Browse"])).firstMatch
            if waitForHittable(browse, timeout: 5) {
                browse.tap()
                // もう一度押すと「ブラウズ」の先頭へ戻り、保存場所の一覧が出る。
                if waitForLocation(timeout: 3) == nil, isHittableWithoutFailing(browse) {
                    browse.tap()
                }
            }
        }
        guard let location = waitForLocation(timeout: 10) else {
            add(screenshotAttachment(named: "復元の端末内保存場所が見つからない"))
            XCTFail("復元の端末内保存場所を選べない: \(app.debugDescription)")
            return nil
        }
        waitUntilStill(location)
        location.tap()

        let backupFile = app.cells
            .matching(NSPredicate(format: "identifier == %@ OR identifier BEGINSWITH %@", fileName, fileName + "."))
            .firstMatch
        // iPhoneで「Browse」から戻る途中のタップが効かず、保存場所の一覧に残った。
        // ファイルが押せず、保存場所がまだ画面内で押せる場合だけ押し直す。
        if !waitForHittable(backupFile, timeout: 10), let retryLocation = waitForLocation(timeout: 2) {
            add(screenshotAttachment(named: "復元の保存場所を押し直す"))
            waitUntilStill(retryLocation)
            retryLocation.tap()
        }
        guard waitForHittable(backupFile, timeout: 20) else {
            add(screenshotAttachment(named: "復元のバックアップが見つからない"))
            XCTFail("端末内のバックアップを選べない: \(app.debugDescription)")
            return nil
        }
        return backupFile
    }

    /// 空や画面外の要素でisHittableを読むとXCTestが失敗するため、先に位置を確かめる。
    private func waitForHittable(_ element: XCUIElement, timeout: TimeInterval) -> Bool {
        let app = XCUIApplication()
        let hittable = XCTNSPredicateExpectation(
            predicate: NSPredicate { _, _ in
                self.ignoringWaiterInterruption {
                    guard element.exists else { return false }
                    let frame = element.frame
                    return !frame.isEmpty
                        && app.windows.firstMatch.frame.intersects(frame)
                        && self.isHittableWithoutFailing(element)
                } ?? false
            },
            object: element
        )
        return XCTWaiter.wait(for: [hittable], timeout: timeout) == .completed
    }

    /// isHittableを読み、XCTestが押す位置を決められなかった場合は押せないとして扱う。
    ///
    /// 復元の「On My iPad」（#317）や、スクロール中の「サポートページ」（#44）で、
    /// 枠が画面内でも「Failed to determine hittability … Activation point invalid」が記録された。
    /// この失敗だけを想定内とし、ほかの失敗はそのまま記録する。
    private func isHittableWithoutFailing(_ element: XCUIElement) -> Bool {
        ignoringQueryIssue("押す位置を決められない要素は押せないとして扱う", matching: {
            $0.compactDescription.contains("Failed to determine hittability")
                && $0.compactDescription.contains("Activation point invalid and no suggested hit points based on element frame")
        }) {
            element.isHittable
        } ?? false
    }

    /// 待機の述語の中で、別プロセスで表示される選択画面の要素を問い合わせる。
    ///
    /// 待機が時間切れになると問い合わせが途中で打ち切られ、XCTestが
    /// 「Failed to resolve remote element … Interrupted by waiter」をテストの失敗として記録する（#44）。
    /// この失敗だけを想定内とし、見つからなかったものとして扱う。ほかの失敗はそのまま記録する。
    private func ignoringWaiterInterruption<T>(_ query: () -> T?) -> T? {
        ignoringQueryIssue("待機の時間切れで打ち切られた問い合わせは見つからなかったとして扱う", matching: {
            $0.compactDescription.contains("Interrupted by waiter")
        }, query)
    }

    /// 指定した問い合わせの失敗だけを想定内とし、発生した場合は戻り値を使わない。
    private func ignoringQueryIssue<T>(
        _ reason: String,
        matching matcher: @escaping (XCTIssue) -> Bool,
        _ query: () -> T?
    ) -> T? {
        let options = XCTExpectedFailure.Options()
        options.isStrict = false
        var matchedIssue = false
        options.issueMatcher = { issue in
            guard matcher(issue) else { return false }
            matchedIssue = true
            return true
        }
        var result: T?
        XCTExpectFailure(reason, options: options) {
            result = query()
        }
        return matchedIssue ? nil : result
    }

    /// 書き出しの確認アラートのボタン（「共有」「ファイルに保存」）を押し、アラートが閉じたかを返す。
    ///
    /// CIの遅いSimulatorで、ボタンの中心に届いたタップがアラートの操作として成立せず、アラートが
    /// 残ったままになったことがある（iPadの「共有」、run 39528108107）。アラートが残って押せるときに限り、
    /// 画面写真を残して1回だけ押し直す。押し直しても閉じなければ失敗にして、後の確認を打ち切れるようにする。
    @discardableResult
    private func tapExportAlertButton(_ button: XCUIElement, in app: XCUIApplication, step: String) -> Bool {
        waitUntilStill(button)
        button.tap()
        if waitForDisappearance(of: button, timeout: 8) { return true }
        if waitForHittable(button, timeout: 2) {
            add(screenshotAttachment(named: "確認アラートを押し直す-\(step)"))
            waitUntilStill(button)
            button.tap()
        }
        if waitForDisappearance(of: button, timeout: 15) { return true }
        add(screenshotAttachment(named: "確認アラートが閉じない-\(step)"))
        XCTFail("確認アラートのボタンを押しても閉じない（\(step)）: \(app.debugDescription)")
        return false
    }

    private func cancelExportAlert(in app: XCUIApplication) {
        let cancel = app.buttons["キャンセル"]
        let fileSave = app.buttons["ファイルに保存"]
        XCTAssertTrue(cancel.waitForExistence(timeout: Self.editorAppearanceTimeout))
        cancel.tap()
        assertDisappears(cancel, from: app)
        assertDisappears(fileSave, from: app)
    }

    /// 見出しの下に出る、開いている編み図の名前の文字。
    ///
    /// 起動時に開く編み図は先に実行したテストで変わるため、名前では探せない。読み上げの順では
    /// 見出しの次に名前が来て、その後に「、」と画面に出ない「保存済み」が続くので、見出しの次の
    /// 静的テキストを名前で取り直す。
    private func documentNameText(below heading: XCUIElement, in webView: XCUIElement) -> XCUIElement {
        let texts = webView.staticTexts.allElementsBoundByIndex
        guard
            let headingIndex = texts.firstIndex(where: { $0.label == heading.label }),
            headingIndex + 1 < texts.count
        else {
            XCTFail("見出しの下に編み図名が無い: \(webView.debugDescription)")
            return heading
        }
        return webView.staticTexts[texts[headingIndex + 1].label].firstMatch
    }

    /// 編集後の自動保存が端末へ書き終わるまで待つ。盤面の記号数が変わったのを確かめてから呼ぶ。
    ///
    /// 見出しの「（保存中…）」は`aria-hidden`で、XCUITestからは常に見えない。以前はこれが
    /// 消えるのを待っていたため待機が即座に成立し、自動保存（編集の400ms後）より先に
    /// `terminate()`して、再起動後に編集前の盤面が出ることがあった。読み上げ用の
    /// 「保存中」「保存済み」は独立した静的テキストとして公開されるので、そちらを見る。
    /// 記号数の表示と「保存中」は同じ描画で出るため、その後に「保存済み」が見えれば
    /// 書き込みは完了している。
    private func waitForDocumentSave(named name: String, in webView: XCUIElement) {
        let title = webView.descendants(matching: .staticText)
            .matching(NSPredicate(format: "label BEGINSWITH %@", name))
            .firstMatch
        XCTAssertTrue(title.waitForExistence(timeout: Self.editorAppearanceTimeout), webView.debugDescription)

        let savedStatus = webView.descendants(matching: .staticText)
            .matching(NSPredicate(format: "label CONTAINS %@", "保存済み"))
            .firstMatch
        let savingStatus = webView.descendants(matching: .staticText)
            .matching(NSPredicate(format: "label CONTAINS %@", "保存中"))
            .firstMatch
        let saved = XCTNSPredicateExpectation(predicate: NSPredicate(format: "exists == true"), object: savedStatus)
        let notSaving = XCTNSPredicateExpectation(predicate: NSPredicate(format: "exists == false"), object: savingStatus)
        XCTAssertEqual(
            XCTWaiter.wait(for: [saved, notSaving], timeout: Self.editorAppearanceTimeout),
            .completed,
            "自動保存が完了しない: \(webView.debugDescription)"
        )
    }

    /// 表示中の共有シート（`UIActivityViewController`）。閉じると消える。
    ///
    /// iOS 26では本体が`ActivityListView`として公開され、「コピー」などの共有先はボタンではなく
    /// セル（identifier`actionGroupCell`）になる。
    private func shareSheet(in app: XCUIApplication) -> XCUIElement {
        app.otherElements["ActivityListView"]
    }

    /// 「出力」で出力パネルを開く。
    ///
    /// 起動直後は「編み図」と同じく最初のタップが効かないことがある（#44）。パネルが
    /// 開いていない（「閉じる」が無い）ときだけ押し直す。
    private func openSavePanel(with save: XCUIElement, showing button: XCUIElement, in app: XCUIApplication) {
        save.tap()
        if !button.waitForExistence(timeout: 10), !app.buttons["閉じる"].exists {
            save.tap()
        }
        XCTAssertTrue(button.waitForExistence(timeout: Self.editorAppearanceTimeout), app.debugDescription)
    }

    /// 共有シートを枠外のタップで閉じる。戻り値は失敗時の診断用に、タップした回数を表す。
    ///
    /// iPadのSimulatorの横向きで、表示し終えたシートでも枠外のタップが効かないことがまれにあった。
    /// シートが残っているあいだだけタップし直すため、シートが消えたあとの編集画面への
    /// タップには影響しない。
    private func dismissShareSheet(_ sheet: XCUIElement, in app: XCUIApplication) -> String {
        waitUntilStill(sheet)
        for attempt in 1...3 {
            tapOutside(sheet, in: app)
            if waitForDisappearance(of: sheet, timeout: 5) {
                return "枠外のタップ\(attempt)回"
            }
        }
        return "枠外のタップ3回でも閉じない"
    }

    /// 共有シートを、編集画面のヘッダーの題名のあたりをタップして閉じる。
    ///
    /// 枠外のタップは、シートを閉じると同時に背後の要素にも届く（iOS 27.2 Simulator）。シートの外が
    /// 盤面になる場面（WebContent終了後の再読み込みなど）では、押しても何も起きない題名を叩く。
    /// 下へのドラッグでは共有シートは閉じなかった。
    private func dismissShareSheetWithoutTouchingBoard(_ sheet: XCUIElement, in app: XCUIApplication) -> String {
        waitUntilStill(sheet)
        let webView = app.webViews.firstMatch
        let title = webView.staticTexts["棒針編み図エディタ"].firstMatch
        let window = app.windows.firstMatch.frame
        let target: XCUICoordinate
        if title.exists, !title.frame.isEmpty, window.contains(title.frame) {
            target = title.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5))
        } else {
            target = webView.coordinate(withNormalizedOffset: .zero)
                .withOffset(CGVector(dx: 40, dy: 20))
        }
        for attempt in 1...3 {
            target.tap()
            if waitForDisappearance(of: sheet, timeout: 5) {
                return "題名のタップ\(attempt)回"
            }
        }
        return "題名のタップ3回でも閉じない"
    }

    /// 共有シートの枠の外で、いちばん広い余白の中央をタップする。
    ///
    /// iOS 26の共有シートには閉じるボタンが無く、iPhoneでも枠外（`PopoverDismissRegion`）の
    /// タップで閉じる。ラベルで「閉じる」を探すと背後の出力パネルのボタンに当たり、
    /// 横向きではその位置がシートの内側に入って閉じられない。
    private func tapOutside(_ sheet: XCUIElement, in app: XCUIApplication) {
        let window = app.windows.firstMatch
        let bounds = window.frame
        let frame = sheet.frame
        let gaps: [(size: CGFloat, point: CGPoint)] = [
            (frame.minY - bounds.minY, CGPoint(x: frame.midX, y: (bounds.minY + frame.minY) / 2)),
            (bounds.maxY - frame.maxY, CGPoint(x: frame.midX, y: (frame.maxY + bounds.maxY) / 2)),
            (frame.minX - bounds.minX, CGPoint(x: (bounds.minX + frame.minX) / 2, y: frame.midY)),
            (bounds.maxX - frame.maxX, CGPoint(x: (frame.maxX + bounds.maxX) / 2, y: frame.midY)),
        ]
        let widest = gaps.max { $0.size < $1.size }!
        XCTAssertGreaterThan(widest.size, 20, "共有シートの枠外が無い sheet=\(frame) window=\(bounds)")
        window.coordinate(withNormalizedOffset: .zero)
            .withOffset(CGVector(dx: widest.point.x - bounds.minX, dy: widest.point.y - bounds.minY))
            .tap()
    }

    /// 「出力」からPNGを書き出し、確認アラートの「共有」で共有シートを開く。
    /// 前の操作で出力パネルが開いたままなら、そのパネルを使う。
    private func openPNGShareSheet(in app: XCUIApplication, step: String) -> Bool {
        let png = app.buttons["PNGを保存"]
        if !png.waitForExistence(timeout: 2) {
            let save = app.buttons["出力"]
            XCTAssertTrue(save.waitForExistence(timeout: Self.editorAppearanceTimeout), app.debugDescription)
            openSavePanel(with: save, showing: png, in: app)
        }
        assertHittableAfterScrolling(png, in: app)
        waitUntilStill(png)
        png.tap()
        let share = app.buttons["共有"]
        XCTAssertTrue(share.waitForExistence(timeout: Self.editorAppearanceTimeout), "\(step): \(app.debugDescription)")
        guard tapExportAlertButton(share, in: app, step: step) else { return false }
        let sheet = shareSheet(in: app)
        guard sheet.waitForExistence(timeout: 20) else {
            XCTFail("共有シートが開かない（\(step)）: \(app.debugDescription)")
            return false
        }
        return true
    }

    /// 共有シートの中から、指定した名前の操作を探す。見えなければシートを送って探す。
    private func shareSheetAction(
        labels: [String],
        in app: XCUIApplication,
        sheet: XCUIElement
    ) -> XCUIElement {
        let predicate = NSPredicate(format: "label IN %@", labels)
        func candidate() -> XCUIElement {
            let cell = sheet.cells.matching(predicate).firstMatch
            if cell.exists { return cell }
            let inSheet = sheet.descendants(matching: .any).matching(predicate).firstMatch
            // 「表示を増やす」で開く一覧は、共有シートの外の要素として出ることがある。
            return inSheet.exists ? inSheet : app.cells.matching(predicate).firstMatch
        }
        // iOS 27の共有シートは、操作の行に数個だけ出し、残り（「ファイルに保存」など）を
        // 「表示を増やす」の先に置く。
        let showMore = app.descendants(matching: .any)
            .matching(NSPredicate(format: "label IN %@", ["表示を増やす", "Show More"])).firstMatch
        var action = candidate()
        var expanded = false
        for _ in 0..<5 {
            if action.exists, waitForHittable(action, timeout: 2) { return action }
            // 「表示を増やす」は開閉を切り替えるので、1回だけ押す。
            if !expanded, showMore.exists, isHittableWithoutFailing(showMore) {
                showMore.tap()
                expanded = true
            } else if isHittableWithoutFailing(sheet) {
                sheet.swipeUp()
            }
            action = candidate()
        }
        return action
    }

    /// 保存画面で「このiPhone内」/「このiPad内」を開く。iPadのサイドバーとiPhoneの
    /// 「ブラウズ」タブのどちらでも選べるようにする。
    private func selectOnDeviceLocationForSaving(in app: XCUIApplication) -> Bool {
        let labels = ["このiPhone内", "このiPad内", "On My iPhone", "On My iPad"]
        if let location = waitForFirstHittable(in: app, labels: labels, timeout: 10) {
            waitUntilStill(location)
            location.tap()
            return true
        }
        let browseLabels = ["ブラウズ", "Browse"]
        if let browse = waitForFirstHittable(in: app, labels: browseLabels, timeout: 5) {
            browse.tap()
            if let location = waitForFirstHittable(in: app, labels: labels, timeout: 10) {
                waitUntilStill(location)
                location.tap()
                return true
            }
            // もう一度押すと「ブラウズ」の先頭へ戻り、保存場所の一覧が出る。
            if let browseAgain = waitForFirstHittable(in: app, labels: browseLabels, timeout: 3) {
                browseAgain.tap()
                if let location = waitForFirstHittable(in: app, labels: labels, timeout: 10) {
                    waitUntilStill(location)
                    location.tap()
                    return true
                }
            }
        }
        return false
    }

    /// 指定したラベルの押せる要素が現れるまで待つ。
    private func waitForFirstHittable(
        in app: XCUIApplication,
        labels: [String],
        timeout: TimeInterval
    ) -> XCUIElement? {
        var found: XCUIElement?
        let appears = XCTNSPredicateExpectation(
            predicate: NSPredicate { _, _ in
                // 別プロセスの要素の問い合わせが待機の時間切れで打ち切られても、失敗にしない（#44）。
                found = self.ignoringWaiterInterruption { self.firstHittable(in: app, labels: labels) }
                return found != nil
            },
            object: app
        )
        guard XCTWaiter.wait(for: [appears], timeout: timeout) == .completed else { return nil }
        return found
    }

    /// システムシートやFilesの中で、指定したラベルの押せる要素を探す。
    /// 別プロセスの要素でも`isHittable`が失敗しないよう、枠を確かめてから読む。
    private func firstHittable(in app: XCUIApplication, labels: [String]) -> XCUIElement? {
        let candidates = app.descendants(matching: .any)
            .matching(NSPredicate(format: "label IN %@", labels))
        let window = app.windows.firstMatch.frame
        return candidates.allElementsBoundByIndex.first { element in
            guard element.exists else { return false }
            let frame = element.frame
            return !frame.isEmpty && window.intersects(frame) && isHittableWithoutFailing(element)
        }
    }

    /// 要素の位置が続けて同じになるまで待つ。表示の動きが終わる前のタップは外れることがある。
    private func waitUntilStill(_ element: XCUIElement, timeout: TimeInterval = 5) {
        var previous = CGRect.null
        let still = XCTNSPredicateExpectation(
            predicate: NSPredicate { object, _ in
                guard let frame = (object as? XCUIElement)?.frame else { return false }
                defer { previous = frame }
                return frame == previous
            },
            object: element
        )
        _ = XCTWaiter.wait(for: [still], timeout: timeout)
    }

    private func assertDisappears(_ element: XCUIElement, from app: XCUIApplication, note: String = "") {
        let disappearance = XCTNSPredicateExpectation(
            predicate: NSPredicate(format: "exists == false"),
            object: element
        )
        let result = XCTWaiter.wait(for: [disappearance], timeout: 15)
        XCTAssertTrue(result == .completed, "\(note): \(app.debugDescription)")
    }

    // MARK: - WebContent終了のUIテスト

    private static let webContentKillSignal = "KNITTING_EDITOR_WEBCONTENT_KILL_READY"
    private static var webContentKillAckPaths: [String] {
        if let udid = ProcessInfo.processInfo.environment["SIMULATOR_UDID"] {
            return ["/tmp/knitting-editor-webcontent-kill-done-\(udid)"]
        }
        return ["/tmp/knitting-editor-webcontent-kill-done"]
    }

    /// ホスト側のスクリプトが終了の完了ファイルを作らないときに投げる。`XCTFail`のあとに
    /// 投げて、以降の確認を続けずにテストを止める。
    private struct WebContentKillAcknowledgementTimeout: Error, CustomStringConvertible {
        let step: String
        var description: String {
            "ホスト側でWebContentプロセスを終了できない（\(step)）。ios/scripts/run-webcontent-termination-ui-test.shで実行する"
        }
    }

    /// ホスト側で`com.apple.WebKit.WebContent`を終了するUIテストは、CIでは実行しない。
    private func requireWebContentTermination() throws {
        try XCTSkipUnless(
            ProcessInfo.processInfo.environment["KNITTING_EDITOR_WEBCONTENT_KILL"] == "1",
            "WebContentプロセスをホスト側で終了するため、TEST_RUNNER_KNITTING_EDITOR_WEBCONTENT_KILL=1とios/scripts/run-webcontent-termination-ui-test.shで実行する"
        )
    }

    /// ホスト側のスクリプトへ終了の合図を送り、SIGKILLが届くまで待つ。
    ///
    /// UIテストのプロセスからWebContentプロセスは終了できないため、`NSLog`を
    /// `ios/scripts/run-webcontent-termination-ui-test.sh`がSimulatorのログから拾う。
    /// スクリプトは終了後に`/tmp/knitting-editor-webcontent-kill-done`を作る。
    private func signalWebContentKill(_ step: String) throws {
        let ackPaths = Self.webContentKillAckPaths
        for path in ackPaths { try? FileManager.default.removeItem(atPath: path) }
        defer { for path in ackPaths { try? FileManager.default.removeItem(atPath: path) } }
        // ログが重複して届いてもホスト側が同じ合図を2回処理しないよう、合図ごとに印を付ける。
        NSLog("%@ %@ %@", Self.webContentKillSignal, UUID().uuidString, step)
        let done = XCTNSPredicateExpectation(
            predicate: NSPredicate { object, _ in
                guard let paths = object as? [String] else { return false }
                return paths.contains { FileManager.default.fileExists(atPath: $0) }
            },
            object: ackPaths
        )
        guard XCTWaiter.wait(for: [done], timeout: 60) == .completed else {
            XCTFail(
                "ホスト側でWebContentプロセスを終了できない（\(step)）。ios/scripts/run-webcontent-termination-ui-test.shで実行する"
            )
            throw WebContentKillAcknowledgementTimeout(step: step)
        }
    }

    private func editorLoadingOverlay(in app: XCUIApplication) -> XCUIElement {
        app.descendants(matching: .any)["editorLoadingOverlay"]
    }

    /// 要素が現れるまで、50ms間隔で確かめ続ける。`waitForExistence`は約1秒ごとにしか確かめず、
    /// 1秒ほどで消える表示を見落とす。待機は上限で打ち切る。
    private func pollUntilExists(_ element: XCUIElement, timeout: TimeInterval) -> Bool {
        let deadline = Date().addingTimeInterval(timeout)
        repeat {
            if element.exists { return true }
            Thread.sleep(forTimeInterval: 0.05)
        } while Date() < deadline
        return false
    }

    /// 空の編み図を作って1個描き、保存が終わるまで待つ。復帰後に同じ編み図を探すために使う。
    @discardableResult
    private func prepareSavedChart(named name: String, in app: XCUIApplication) -> XCUIElement {
        createDocument(named: name, in: app)
        let canvas = positionSaveProbeCanvas(count: 0, in: app)
        saveProbeCell(row: 8, col: 12, on: canvas).tap()
        _ = saveProbeCanvas(count: 1, in: app)
        let webView = app.webViews.firstMatch
        waitForDocumentSave(named: name, in: webView)
        return webView
    }

    /// WebContent終了後の再読み込みが終わり、失敗の案内が出ていないことを確かめる。
    private func assertEditorRecoversAfterTermination(in app: XCUIApplication, note: String) {
        let overlay = editorLoadingOverlay(in: app)
        XCTAssertTrue(
            waitForDisappearance(of: overlay, timeout: 180),
            "\(note): WebContent終了後の準備中の表示が消えない: \(app.debugDescription)"
        )
        XCTAssertFalse(
            app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH %@", "編み図を読み込めませんでした"))
                .firstMatch.exists,
            "\(note): WebContent終了後の復旧に失敗した: \(app.debugDescription)"
        )
        XCTAssertEqual(app.state, .runningForeground, note)
    }

    /// 保存済みの編み図が開いていて、記号数が変わっていないことを確かめる。
    private func assertSavedChart(name: String, stitchCount: Int, in app: XCUIApplication) {
        let webView = app.webViews.firstMatch
        let title = webView.staticTexts
            .matching(NSPredicate(format: "label BEGINSWITH %@", name))
            .firstMatch
        XCTAssertTrue(title.waitForExistence(timeout: Self.editorAppearanceTimeout), "\(name)が開いていない: \(app.debugDescription)")
        let canvas = webView.otherElements
            .matching(NSPredicate(format: "label CONTAINS %@", "記号\(stitchCount)個"))
            .firstMatch
        XCTAssertTrue(canvas.waitForExistence(timeout: Self.editorAppearanceTimeout), "\(name)の記号数が違う: \(app.debugDescription)")
    }

    /// 復帰した編集画面で、保存済みの編み図へもう1個描けることを確かめる。
    private func assertChartCanBeEdited(in app: XCUIApplication) {
        let canvas = positionSaveProbeCanvas(count: 1, in: app)
        tapChangingStitchCount("復帰後の描画", from: 1, to: 2, in: app) {
            saveProbeCell(row: 8, col: 13, on: canvas).tap()
        }
    }

    /// 再読み込みしたページに古い書き出しの結果が届いていないことを、利用者に見える範囲で確かめる。
    /// 結果のIDは`webViewWebContentProcessDidTerminate`と`didCommit`が破棄し、Web側の
    /// `pendingExports`もページの読み直しで消える。ここで見るのは失敗の案内だけであり、
    /// 古い成功結果や未完了の配信は単体テストの`WebContentRecoveryTests`と
    /// `NativeExportResultTests`が検証する。
    private func assertNoStaleExportResult(in app: XCUIApplication) {
        for message in ["共有に失敗しました", "出力ファイルを準備できませんでした", "保存画面を表示できませんでした"] {
            XCTAssertFalse(
                app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", message)).firstMatch.exists,
                "古い書き出しの結果が届いた: \(message): \(app.debugDescription)"
            )
        }
        XCTAssertFalse(app.buttons["再試行"].exists, app.debugDescription)
    }

    /// WebContent終了後に、終了前から開いていた出力パネルが閉じていることを確かめる。
    ///
    /// 出力パネルはWeb側の状態なので、ページが読み直されれば必ず閉じる。パネルの
    /// 「閉じる」だけを消す実装でも通らないよう、出力のボタンと「閉じる」の両方を見る。
    private func assertExportPanelClosedAfterReload(showing button: String, in app: XCUIApplication) {
        XCTAssertTrue(
            waitForDisappearance(of: app.buttons[button], timeout: 10),
            "WebContent終了後に出力パネルの「\(button)」が残っている（ページが再読み込みされていない）: \(app.debugDescription)"
        )
        XCTAssertTrue(
            waitForDisappearance(of: app.buttons["閉じる"], timeout: 10),
            "WebContent終了後に出力パネルの「閉じる」が残っている（ページが再読み込みされていない）: \(app.debugDescription)"
        )
    }

    private func requireAppUpdateProbe() throws {
        if !FileManager.default.fileExists(atPath: "/tmp/knitting-editor-app-update-probe") {
            throw XCTSkip("専用のアプリ更新シミュレーションスクリプトからのみ実行する")
        }
    }
}
