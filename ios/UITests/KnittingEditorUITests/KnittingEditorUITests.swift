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
    func testGuideNavigationReturnsToUsableEditor() {
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
        let guideLink = app.links["使い方"]
        XCTAssertTrue(guideLink.waitForExistence(timeout: Self.editorAppearanceTimeout), app.debugDescription)
        guideLink.tap()

        XCTAssertTrue(
            app.webViews.firstMatch.staticTexts["棒針編み図の作り方"].waitForExistence(timeout: Self.editorAppearanceTimeout),
            app.debugDescription
        )
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

    // BoardCanvas.initialViewport/clampViewportと同じ変換で、20×20、既定30pxの
    // セルの中心を指定する。画面サイズに対する割合では同じセルを指定できない。
    private func saveProbeCell(row: Int, col: Int, on canvas: XCUIElement) -> XCUICoordinate {
        let size = canvas.frame.size
        let band: CGFloat = 28
        let cell: CGFloat = 30
        let cells: CGFloat = 20
        func origin(_ extent: CGFloat) -> CGFloat {
            let center = (extent + band) / 2
            let initial = min(band + 8, extent - 8 - cells * cell)
            return min(center - cell / 2, max(center - (cells - 0.5) * cell, initial))
        }
        let point = CGVector(dx: origin(size.width) + (CGFloat(col) + 0.5) * cell,
                             dy: origin(size.height) + (CGFloat(row) + 0.5) * cell)
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
        app.buttons["元に戻す"].tap()
        _ = saveProbeCanvas(count: count, in: app)
        app.switches["描く"].tap()
    }

    private func assertSaveProbeIsDirty(in app: XCUIApplication) {
        XCTAssertTrue(app.webViews.firstMatch.staticTexts
            .matching(NSPredicate(format: "label CONTAINS %@", "保存中"))
            .firstMatch.waitForExistence(timeout: 10), app.debugDescription)
    }

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
            app.buttons[panel].tap()
            let close = app.buttons["閉じる"]
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
        save.tap()
        let export = app.buttons[name]
        XCTAssertTrue(export.waitForExistence(timeout: Self.editorAppearanceTimeout), app.debugDescription)
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

        app.buttons["出力"].tap()
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

        // 数値欄への入力はキャレット位置が安定しないため、追加ボタンを繰り返し押す。
        app.buttons["盤面"].tap()
        let addRow = app.buttons["上に段"]
        XCTAssertTrue(addRow.waitForExistence(timeout: 15), app.debugDescription)
        for _ in 0..<max(0, rows! - 20) { addRow.tap() }
        for _ in 0..<max(0, cols! - 20) { app.buttons["右に列"].tap() }

        let resized = app.webViews.firstMatch.otherElements
            .matching(NSPredicate(format: "label CONTAINS %@", "\(rows!)段、\(cols!)目"))
            .firstMatch
        XCTAssertTrue(resized.waitForExistence(timeout: 60), "盤面を\(rows!)×\(cols!)にできない: \(app.debugDescription)")
        app.buttons["閉じる"].tap()

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

    func testSeedDocumentForAppUpdateProbe() throws {
        try requireAppUpdateProbe()
        let app = XCUIApplication()
        let appUpdateElementTimeout: TimeInterval = 60
        app.launch()

        XCTAssertTrue(app.webViews.firstMatch.waitForExistence(timeout: appUpdateElementTimeout))
        openDocumentsPanel(in: app, timeout: appUpdateElementTimeout).tap()
        let nameField = app.textFields["入力"]
        XCTAssertTrue(nameField.waitForExistence(timeout: appUpdateElementTimeout))
        replaceText("アプリ更新復元fixture", in: nameField, app: app)
        confirmDialog(closing: nameField, in: app)

        let webView = app.webViews.firstMatch
        let canvas = webView.otherElements
            .matching(NSPredicate(format: "label CONTAINS %@", "記号0個"))
            .firstMatch
        XCTAssertTrue(canvas.waitForExistence(timeout: appUpdateElementTimeout), app.debugDescription)
        canvas.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
        XCTAssertTrue(
            webView.otherElements
                .matching(NSPredicate(format: "label CONTAINS %@", "記号1個"))
                .firstMatch
                .waitForExistence(timeout: appUpdateElementTimeout),
            app.debugDescription
        )
        waitForDocumentSave(named: "アプリ更新復元fixture", in: webView)
    }

    func testUpdatedAppRestoresSeedDocument() throws {
        try requireAppUpdateProbe()
        let app = XCUIApplication()
        let appUpdateElementTimeout: TimeInterval = 60
        app.launch()

        XCTAssertTrue(app.webViews.firstMatch.waitForExistence(timeout: appUpdateElementTimeout))
        openDocumentsPanel(in: app, timeout: appUpdateElementTimeout)
        let restoredDocument = app.buttons
            .matching(NSPredicate(format: "label BEGINSWITH %@", "アプリ更新復元fixture、"))
            .firstMatch
        XCTAssertTrue(restoredDocument.waitForExistence(timeout: appUpdateElementTimeout), app.debugDescription)
        restoredDocument.tap()

        XCTAssertTrue(
            app.webViews.firstMatch.otherElements
                .matching(NSPredicate(format: "label CONTAINS %@", "記号1個"))
                .firstMatch
                .waitForExistence(timeout: appUpdateElementTimeout),
            app.debugDescription
        )
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
        // タップしたマスがブロックの左上になり、貼付が済むと通常の入力に戻る。
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
        for point in pasteOffsetsFromCanvasTopLeft where pasteBand.exists {
            pasteCanvas.coordinate(withNormalizedOffset: .zero).withOffset(point).tap()
            _ = XCTWaiter.wait(for: [XCTNSPredicateExpectation(
                predicate: NSPredicate(format: "exists == false"), object: pasteBand)], timeout: 5)
        }
        waitForStitchCount(3, on: saveProbeCanvas(count: 3, in: app), in: app)
        XCTAssertFalse(pasteBand.exists, app.debugDescription)
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
        fileSave.tap()
        assertDisappears(fileSave, from: app)
        let exportPicker = SystemSheet.element(in: app)
        XCTAssertTrue(exportPicker.waitForExistence(timeout: 20), app.debugDescription)
        // CIの再試行で同名ファイルを置き換えるとファイルプロバイダーが停止したため、
        // 実行ごとに名前を変えてシステムの置き換え確認を避ける。
        // CIのiPhoneではファイル名の入力欄が公開されないことがあるため、その場合は既定名を使う。
        var backupFileName = "knitting-editor-backup"
        let filename = app.textFields["DOCPicker.filenameTextField"]
        if filename.waitForExistence(timeout: 10) {
            backupFileName = "knitting-editor-backup-\(suffix)"
            replaceText(backupFileName, in: filename, app: app)
        }
        // 保存先はシステムの前回の場所に依存する。iPhoneでの確認時は「このiPhone内」が開いた。
        let saveInPicker = app.buttons.matching(NSPredicate(format: "label IN %@", ["保存", "Save"])).firstMatch
        XCTAssertTrue(saveInPicker.waitForExistence(timeout: 20), app.debugDescription)
        add(screenshotAttachment(named: "全データの保存先の選択"))
        saveInPicker.tap()
        // 名前を変えられず、前回の同名ファイルが残っているときだけ、確認が出るので置き換える。
        let replace = app.buttons.matching(NSPredicate(format: "label IN %@", ["置き換え", "Replace"])).firstMatch
        let exportFinishedOrReplaceAppeared = XCTNSPredicateExpectation(
            predicate: NSPredicate { _, _ in !exportPicker.exists || replace.exists },
            object: exportPicker
        )
        // 別プロセスの保存画面が閉じる途中はreplace.existsの問い合わせに17〜19秒かかることがある。
        // 保存済みでも20秒では1回しか判定できず失敗したため、エディターの表示と同じ時間待つ。
        let exportWaitResult = XCTWaiter.wait(for: [exportFinishedOrReplaceAppeared], timeout: Self.editorAppearanceTimeout)
        XCTAssertEqual(exportWaitResult, .completed, app.debugDescription)
        if exportPicker.exists && replace.exists {
            waitUntilStill(replace)
            replace.tap()
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
        save.tap()

        let currentDocument = app.buttons["この編み図を書き出す"]
        XCTAssertTrue(currentDocument.waitForExistence(timeout: Self.editorAppearanceTimeout))
        currentDocument.tap()

        let fileSave = app.buttons["ファイルに保存"]
        XCTAssertTrue(fileSave.waitForExistence(timeout: Self.editorAppearanceTimeout))
        XCTAssertTrue(app.buttons["共有"].exists)
        fileSave.tap()
        // 確認ダイアログの「キャンセル」を保存シートと取り違えないよう、ダイアログが消えてから探す。
        assertDisappears(fileSave, from: app)

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
        share.tap()

        let sheet = shareSheet(in: app)
        XCTAssertTrue(sheet.waitForExistence(timeout: 20), app.debugDescription)
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
            share.tap()

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

    func testBackslashDocumentNameReachesAllNativeExportActions() {
        assertAllNativeExportActions(documentName: "試作\\修正版")
    }

    private func assertAllNativeExportActions(documentName name: String) {
        XCUIDevice.shared.orientation = .portrait
        let app = XCUIApplication()
        app.launch()
        XCTAssertTrue(app.webViews.firstMatch.waitForExistence(timeout: Self.editorAppearanceTimeout))
        createDocument(named: name, in: app)
        app.buttons["出力"].tap()
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
        let copy = app.buttons["コピーして貼付"]
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
        output.tap()
        let close = app.buttons["閉じる"]
        XCTAssertTrue(close.waitForExistence(timeout: 10), app.debugDescription)
        let window = app.windows.firstMatch.frame
        // 下からのシートでも「閉じる」は右上に出るため、全幅になる本文のボタンの左端で右列かを確かめる。
        let png = app.buttons["PNGを保存"]
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

        app.buttons["出力"].tap()
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
        let app = launchWithAccessibilityExtraExtraExtraLarge()

        assertPrimaryControlsAreUsable(in: app)
        openDocumentsPanel(in: app)
        XCTAssertTrue(app.buttons["閉じる"].isHittable, app.debugDescription)
        app.buttons["閉じる"].tap()
        let save = app.buttons["出力"]
        XCTAssertTrue(save.waitForExistence(timeout: Self.editorAppearanceTimeout), app.debugDescription)
        save.tap()
        assertHittableAfterScrolling(app.buttons["PNGを保存"], in: app)
        assertHittableAfterScrolling(app.buttons["PDFを保存"], in: app)
        assertHittableAfterScrolling(app.buttons["この編み図を書き出す"], in: app)
    }

    /// iPhone・iPad、可変幅で選択操作帯が操作メニューを覆わないことを確認する。
    func testAccessibilityExtraExtraExtraLargeKeepsSelectionActionsSeparate() {
        let app = launchWithAccessibilityExtraExtraExtraLarge()
        assertPrimaryControlsAreUsable(in: app)
        add(screenshotAttachment(named: "最大文字・通常の操作列"))
        app.switches["範囲"].tap()
        let canvas = app.webViews.firstMatch.otherElements
            .matching(NSPredicate(format: "label CONTAINS %@", "編み図編集盤面"))
            .firstMatch
        XCTAssertTrue(canvas.waitForExistence(timeout: 10), app.debugDescription)
        // 最大文字では段数・目数の目盛りの帯が広がるので、帯の外側にある盤面の内側をなぞる。
        let start = canvas.coordinate(withNormalizedOffset: CGVector(dx: 0.55, dy: 0.55))
        let end = canvas.coordinate(withNormalizedOffset: CGVector(dx: 0.8, dy: 0.8))
        start.press(forDuration: 0.05, thenDragTo: end)
        let copy = app.buttons["コピーして貼付"]
        let clear = app.buttons["解除"]
        XCTAssertTrue(copy.waitForExistence(timeout: 10), app.debugDescription)
        XCTAssertTrue(copy.isHittable, app.debugDescription)
        XCTAssertTrue(clear.isHittable, app.debugDescription)
        for name in ["盤面", "ブロック", "出力"] {
            let button = app.buttons[name]
            XCTAssertTrue(button.isHittable, app.debugDescription)
            XCTAssertFalse(copy.frame.intersects(button.frame), "コピー帯が\(name)を覆う")
            XCTAssertFalse(clear.frame.intersects(button.frame), "解除が\(name)を覆う")
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

    /// 文字サイズを最大（アクセシビリティXXXL）にして起動し、編集画面が`webReady`を送り、
    /// 準備中の表示が消えるまで待ってからWebの内容を探す（#64）。
    private func launchWithAccessibilityExtraExtraExtraLarge() -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments += [
            "-UIPreferredContentSizeCategoryName",
            "UICTContentSizeCategoryAccessibilityXXXL",
        ]
        app.launch()
        XCTAssertTrue(app.webViews.firstMatch.waitForExistence(timeout: Self.editorAppearanceTimeout))
        XCTAssertTrue(
            waitForDisappearance(of: app.descendants(matching: .any)["editorLoadingOverlay"], timeout: Self.editorAppearanceTimeout),
            app.debugDescription
        )
        return app
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
            // iPadの右側パネルでもパネル内をドラッグするため、対象ボタンの横位置を使う。
            let dragX = min(max(frame.midX, visible.minX), visible.maxX)
            let start = app.coordinate(withNormalizedOffset: .zero)
                .withOffset(CGVector(dx: dragX, dy: visible.midY - direction * distance / 2))
            let end = start.withOffset(CGVector(dx: 0, dy: direction * distance))
            start.press(forDuration: 0.05, thenDragTo: end, withVelocity: .slow, thenHoldForDuration: 0.1)
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

    /// 保存シートを閉じる。
    ///
    /// iPadは「×」ボタン（label「Cancel」「キャンセル」）を押せるが、iPhoneでは同じボタンへ到達できず
    /// `isHittable`もfalseになる。ウィンドウ状態によっても押せるかどうかが変わるため、
    /// 押してから閉じたことを確かめ、閉じていなければ画面座標の下スワイプへ落とす。
    /// 戻り値は失敗時の診断用に、どの手段まで試したかを表す。
    @discardableResult
    private func dismissSystemSheet(in app: XCUIApplication) -> String {
        let sheet = SystemSheet.element(in: app)
        let closeButton = SystemSheet.closeButton(in: app)
        let buttonExists = closeButton.waitForExistence(timeout: 5)
        let buttonHittable = buttonExists && closeButton.isHittable
        if buttonHittable {
            closeButton.tap()
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
        return "閉じ方=下スワイプ\(retryNote)(×ボタン exists=\(buttonExists) hittable=\(buttonHittable)) window=\(app.windows.firstMatch.frame)"
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
    @discardableResult
    private func openDocumentsPanel(
        in app: XCUIApplication,
        timeout: TimeInterval = KnittingEditorUITests.editorAppearanceTimeout
    ) -> XCUIElement {
        let documents = app.buttons["編み図"]
        let newDocument = app.buttons["新しい編み図"]
        let close = app.buttons["閉じる"]
        XCTAssertTrue(documents.waitForExistence(timeout: timeout), app.debugDescription)
        let started = Date()
        var events: [String] = []
        func record(_ event: String) {
            events.append(String(format: "%.1f秒 ", Date().timeIntervalSince(started)) + event)
        }

        documents.tap()
        record("「編み図」をタップ")
        if !newDocument.waitForExistence(timeout: 10) {
            let panelShown = close.exists
            record("10秒待っても「新しい編み図」が無い（閉じる=\(panelShown)）")
            if !panelShown {
                documents.tap()
                record("「編み図」を押し直した（直後の閉じる=\(close.exists)）")
            }
        }
        if newDocument.waitForExistence(timeout: timeout) {
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

        for name in ["描く", "消す", "範囲"] {
            XCTAssertTrue(app.switches[name].waitForExistence(timeout: 10), "\(name) が見つかりません: \(app.debugDescription)")
        }
        // 編集ツールは横スクロールで、狭い画面や大きな文字では「範囲」が右の画面外にある。
        // スワイプの直後はスクロールがまだ反映されていないことがある（CIのiPhone 17・文字サイズ
        // 最大で、スワイプ0.02秒後の検査では「範囲」がスワイプ前の位置のままだった。成功した
        // 回は0.7秒後に検査していた）。押せる位置に来るまで待ち、来なければスワイプし直す。
        // ツールバーが動かない・届かない不具合は、最後の検査で失敗になる。
        let rangeSwitch = app.switches["範囲"]
        let toolbar = app.otherElements
            .matching(NSPredicate(format: "label BEGINSWITH %@", "編集ツール"))
            .firstMatch
        var swipes = 0
        while !rangeSwitch.isHittable, swipes < 3 {
            XCTAssertTrue(toolbar.waitForExistence(timeout: 5), app.debugDescription)
            toolbar.swipeLeft()
            swipes += 1
            _ = waitForHittable(rangeSwitch, timeout: 5)
        }
        XCTAssertTrue(
            rangeSwitch.isHittable,
            "「範囲」をツールバーのスクロールで押せる位置へ出せない（スワイプ\(swipes)回） " +
                "範囲=\(rangeSwitch.frame) ツールバー=\(toolbar.frame): \(app.debugDescription)"
        )
    }

    /// WebViewのページを上へ送り、要素が押せる位置に来るまで待つ。
    private func scrollWebViewUntilHittable(
        _ element: XCUIElement,
        in app: XCUIApplication,
        maximumSwipes: Int = 14
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
        return element.isHittable
    }

    /// 「最近使った項目」に依存せず、端末内に保存したバックアップを選べる状態まで待つ。
    private func backupFileInOnDeviceLocation(named fileName: String, in app: XCUIApplication) -> XCUIElement? {
        // 選択画面は別プロセスで表示されるため、シートの子孫ではなくアプリ全体から探す。
        let locations = app.descendants(matching: .any)
            .matching(NSPredicate(format: "label IN %@", ["このiPhone内", "このiPad内", "On My iPhone", "On My iPad"]))
        // 同じ名前の見出しや非表示のサイドバーも一致するため、画面内で押せる候補を探す。
        // 空や画面外のframeでisHittableを読むと、falseではなくXCTestの失敗になる。
        func waitForLocation(timeout: TimeInterval) -> XCUIElement? {
            var location: XCUIElement?
            let hittable = XCTNSPredicateExpectation(
                predicate: NSPredicate { _, _ in
                    let window = app.windows.firstMatch.frame
                    location = locations.allElementsBoundByIndex.first { element in
                        guard element.exists else { return false }
                        let frame = element.frame
                        return !frame.isEmpty && window.intersects(frame) && element.isHittable
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
                if waitForLocation(timeout: 3) == nil, browse.isHittable {
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
                guard element.exists else { return false }
                let frame = element.frame
                return !frame.isEmpty && app.windows.firstMatch.frame.intersects(frame) && element.isHittable
            },
            object: element
        )
        return XCTWaiter.wait(for: [hittable], timeout: timeout) == .completed
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

    private func requireAppUpdateProbe() throws {
        if !FileManager.default.fileExists(atPath: "/tmp/knitting-editor-app-update-probe") {
            throw XCTSkip("専用のアプリ更新シミュレーションスクリプトからのみ実行する")
        }
    }
}
