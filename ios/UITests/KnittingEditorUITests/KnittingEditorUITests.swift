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

        // 戻るリンクはページの一番下にある。XCUITestの自動スクロールに任せると、
        // タップ位置が画面の外（y=3275）で計算されて外れ、使い方ページのまま残った（#95）。
        // 自分でページを送り、押せる位置に来てから叩く。使い方ページのまま（リンクが残って
        // いる）ときに限って押し直し、最後まで戻らなければ失敗にする。
        let back = app.links["棒針編み図エディタへ戻る"]
        XCTAssertTrue(back.waitForExistence(timeout: 10), app.debugDescription)
        scrollWebViewUntilHittable(back, in: app)
        // ページの末尾に、アプリから渡したバージョンとビルド番号が出る（#84）。
        let version = app.webViews.firstMatch.staticTexts.matching(
            NSPredicate(format: "label BEGINSWITH %@ AND label CONTAINS %@", "バージョン ", "（ビルド ")
        ).firstMatch
        XCTAssertTrue(version.waitForExistence(timeout: 10), app.debugDescription)
        back.tap()
        let save = app.buttons["保存"]
        if !save.waitForExistence(timeout: 10), back.exists {
            scrollWebViewUntilHittable(back, in: app)
            back.tap()
        }
        XCTAssertTrue(save.waitForExistence(timeout: 20), "使い方ページから編集画面へ戻れない: \(app.debugDescription)")
        XCTAssertFalse(app.otherElements["editorLoadingOverlay"].exists, app.debugDescription)
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
    /// 対策前は、見出しやツールバーのピンチで画面全体が拡大され（「保存」が約2倍になって
    /// 画面外へ出た）、見出し・ラベル・ボタン・リンクの長押しで文字が選択されて
    /// 「Copy」「Look Up」などのメニューが出た。入力欄の文字選択は
    /// `testDocumentDialogRemainsUsableAfterFocusingInput`で確かめる。
    func testEditorChromeIgnoresPageZoomAndTextSelection() {
        let app = XCUIApplication()
        app.launch()

        let webView = app.webViews.firstMatch
        XCTAssertTrue(webView.waitForExistence(timeout: Self.editorAppearanceTimeout))
        let heading = webView.staticTexts["棒針編み図エディタ"].firstMatch
        let save = app.buttons["保存"]
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
        assertFrameUnchanged(of: save, from: saveFrame, in: app, note: "保存")

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

    /// 盤面のタップで置いた記号を、操作メニューの「元に戻す」「やり直す」で取り消し・再実行できる。
    /// WKWebView上のタッチ入力と、指を離した時点で履歴を1件にまとめる処理をまとめて確かめる。
    func testUndoAndRedoRestoreBoardEdits() {
        let app = XCUIApplication()
        app.launch()

        XCTAssertTrue(app.webViews.firstMatch.waitForExistence(timeout: Self.editorAppearanceTimeout))
        createDocument(named: "元に戻す確認", in: app)

        let webView = app.webViews.firstMatch
        let canvas = webView.otherElements
            .matching(NSPredicate(format: "label CONTAINS %@", "編み図編集盤面"))
            .firstMatch
        XCTAssertTrue(canvas.waitForExistence(timeout: Self.editorAppearanceTimeout), app.debugDescription)
        XCTAssertTrue(canvas.label.contains("記号0個"), canvas.debugDescription)
        let undo = app.buttons["元に戻す"]
        let redo = app.buttons["やり直す"]
        XCTAssertTrue(undo.waitForExistence(timeout: 10), app.debugDescription)
        XCTAssertFalse(undo.isEnabled, app.debugDescription)
        XCTAssertFalse(redo.isEnabled, app.debugDescription)

        canvas.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
        waitForStitchCount(1, on: canvas, in: app)
        XCTAssertTrue(undo.isHittable, app.debugDescription)

        undo.tap()
        waitForStitchCount(0, on: canvas, in: app)
        XCTAssertTrue(redo.isEnabled, app.debugDescription)

        redo.tap()
        waitForStitchCount(1, on: canvas, in: app)
        XCTAssertFalse(redo.isEnabled, app.debugDescription)
    }

    /// 入力を伴うダイアログは背景タップで閉じない。入力欄をタップするとキーボードが出て
    /// ダイアログが上へずれるため、続けて置いた指が背景へ当たり、入力した名前ごと
    /// 取り消されていた。
    func testPromptDialogIgnoresBackgroundTaps() {
        let app = XCUIApplication()
        app.launch()
        XCTAssertTrue(app.webViews.firstMatch.waitForExistence(timeout: Self.editorAppearanceTimeout))

        openDocumentsPanel(in: app).tap()

        let nameField = app.textFields["入力"]
        XCTAssertTrue(nameField.waitForExistence(timeout: Self.editorAppearanceTimeout), app.debugDescription)

        // ダイアログの下は背景。実際の事故はキーボードでダイアログが上へずれた直後に
        // 起きるが、ここでは同じ背景を直接叩いて、閉じないことだけを確かめる。
        // キーボードを出すとWebKitの待機で実行時間がCIの上限を超えるため出さない。
        let backdrop = app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.92))
        XCTAssertGreaterThan(backdrop.screenPoint.y, nameField.frame.maxY, app.debugDescription)
        backdrop.tap()

        XCTAssertTrue(nameField.exists, "背景タップでpromptダイアログを閉じてはいけない: \(app.debugDescription)")
        app.buttons["キャンセル"].tap()
        XCTAssertFalse(nameField.waitForExistence(timeout: 2), app.debugDescription)
    }

    func testSavePanelShowsBackupActions() {
        let app = XCUIApplication()
        app.launch()
        XCTAssertTrue(app.webViews.firstMatch.waitForExistence(timeout: Self.editorAppearanceTimeout))

        let save = app.buttons["保存"]
        XCTAssertTrue(save.waitForExistence(timeout: Self.editorAppearanceTimeout))
        save.tap()

        XCTAssertTrue(app.buttons["この編み図"].waitForExistence(timeout: Self.editorAppearanceTimeout))
        XCTAssertTrue(app.buttons["全データ"].exists)
        XCTAssertTrue(app.buttons["復元"].exists)
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

    func testDocumentSwitchAutosavesEachDocument() {
        let app = XCUIApplication()
        app.launch()

        XCTAssertTrue(app.webViews.firstMatch.waitForExistence(timeout: Self.editorAppearanceTimeout))
        createDocument(named: "M2切替A", in: app)

        let webView = app.webViews.firstMatch
        let emptyCanvas = webView.otherElements
            .matching(NSPredicate(format: "label CONTAINS %@", "記号0個"))
            .firstMatch
        XCTAssertTrue(emptyCanvas.waitForExistence(timeout: Self.editorAppearanceTimeout), app.debugDescription)
        emptyCanvas.coordinate(withNormalizedOffset: CGVector(dx: 0.35, dy: 0.5)).tap()
        let editedCanvas = webView.otherElements
            .matching(NSPredicate(format: "label CONTAINS %@", "記号1個"))
            .firstMatch
        XCTAssertTrue(editedCanvas.waitForExistence(timeout: Self.editorAppearanceTimeout), app.debugDescription)
        waitForDocumentSave(named: "M2切替A", in: webView)

        createDocument(named: "M2切替B", in: app)

        let secondEmptyCanvas = webView.otherElements
            .matching(NSPredicate(format: "label CONTAINS %@", "記号0個"))
            .firstMatch
        XCTAssertTrue(secondEmptyCanvas.waitForExistence(timeout: Self.editorAppearanceTimeout), app.debugDescription)
        secondEmptyCanvas.coordinate(withNormalizedOffset: CGVector(dx: 0.65, dy: 0.5)).tap()
        XCTAssertTrue(
            webView.otherElements
                .matching(NSPredicate(format: "label CONTAINS %@", "記号1個"))
                .firstMatch
                .waitForExistence(timeout: Self.editorAppearanceTimeout),
            app.debugDescription
        )
        waitForDocumentSave(named: "M2切替B", in: webView)
        openDocumentsPanel(in: app)
        let documentA = app.buttons
            .matching(NSPredicate(format: "label BEGINSWITH %@", "M2切替A"))
            .firstMatch
        XCTAssertTrue(documentA.waitForExistence(timeout: Self.editorAppearanceTimeout))
        documentA.tap()
        XCTAssertTrue(
            webView.otherElements
                .matching(NSPredicate(format: "label CONTAINS %@", "記号1個"))
                .firstMatch
                .waitForExistence(timeout: Self.editorAppearanceTimeout),
            app.debugDescription
        )

        openDocumentsPanel(in: app)
        let documentB = app.buttons
            .matching(NSPredicate(format: "label BEGINSWITH %@", "M2切替B"))
            .firstMatch
        XCTAssertTrue(documentB.waitForExistence(timeout: Self.editorAppearanceTimeout))
        documentB.tap()
        XCTAssertTrue(
            webView.otherElements
                .matching(NSPredicate(format: "label CONTAINS %@", "記号1個"))
                .firstMatch
                .waitForExistence(timeout: Self.editorAppearanceTimeout),
            app.debugDescription
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
    /// 欄はReactの制御された`type="number"`で、空にすると`0`へ戻る。キャレットが先頭に
    /// 入ると`20`が`100020`のようになるため、`replaceText`と同じく末尾側を叩いてから
    /// 消して入力する。末尾で`0`の後ろに入力した`01000`は数値として同じなので、
    /// 文字列ではなく数値で比べる。
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

    /// 保存パネルから出力を始め、ファイルの保存先を選ぶ画面が出るまでの秒数を返す。
    private func measureExport(button name: String, in app: XCUIApplication) -> TimeInterval {
        let save = app.buttons["保存"]
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
            .matching(NSPredicate(format: "label BEGINSWITH %@", "アプリ更新復元fixture"))
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

    /// `.knit`の書き出しがシステムの保存UIまで到達し、閉じたあと編集画面へ戻れることを確認する。
    ///
    /// iOS 27のDocument Pickerは別プロセスのUIで「キャンセル」ボタンを持たず、
    /// 閉じる操作は「<」→「×」か下スワイプである。要素は`isHittable`がfalseで直接タップできないため、
    /// 画面座標の下スワイプで閉じる。シートの有無は`SystemSheet`の要素で判定する
    /// （実機で表示中のみ存在し、閉じると消えることを確認済み）。
    func testBackupExportSheetDismissesBackToEditor() throws {
        if ProcessInfo.processInfo.environment["CI"] == "true" {
            throw XCTSkip("Xcode 15.4 CI SimulatorではWebKitがgzipバックアップ生成中に無応答になるため、保存パネル・PNG/PDF導線とローカルSimulatorで検証する")
        }
        let app = XCUIApplication()
        app.launch()

        XCTAssertTrue(app.webViews.firstMatch.waitForExistence(timeout: Self.editorAppearanceTimeout))
        let save = app.buttons["保存"]
        XCTAssertTrue(save.waitForExistence(timeout: Self.editorAppearanceTimeout))
        save.tap()

        let currentDocument = app.buttons["この編み図"]
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

    func testPngAndPdfExportsReachNativeFileActions() {
        let app = XCUIApplication()
        app.launch()

        XCTAssertTrue(app.webViews.firstMatch.waitForExistence(timeout: Self.editorAppearanceTimeout))
        let save = app.buttons["保存"]
        XCTAssertTrue(save.waitForExistence(timeout: Self.editorAppearanceTimeout))
        save.tap()

        let png = app.buttons["PNGを保存"]
        XCTAssertTrue(png.waitForExistence(timeout: Self.editorAppearanceTimeout))
        png.tap()
        let pngFileSave = app.buttons["ファイルに保存"]
        XCTAssertTrue(pngFileSave.waitForExistence(timeout: Self.editorAppearanceTimeout))
        cancelExportAlert(in: app)

        let pdf = app.buttons["PDFを保存"]
        XCTAssertTrue(pdf.waitForExistence(timeout: Self.editorAppearanceTimeout))
        pdf.tap()
        let pdfFileSave = app.buttons["ファイルに保存"]
        XCTAssertTrue(pdfFileSave.waitForExistence(timeout: Self.editorAppearanceTimeout))
        cancelExportAlert(in: app)
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
        app.buttons["キャンセル"].tap()
    }

    func testDocumentDialogRemainsUsableAfterFocusingInput() {
        let app = XCUIApplication()
        app.launch()
        // 実機は端末の向きのまま始まるので、縦向きにしてから確かめる。横向きは`testNameDialogButtonsStayAboveKeyboardInLandscape`で確かめる。
        XCUIDevice.shared.orientation = .portrait

        XCTAssertTrue(app.webViews.firstMatch.waitForExistence(timeout: Self.editorAppearanceTimeout))
        openDocumentsPanel(in: app).tap()

        let nameField = app.textFields["入力"]
        XCTAssertTrue(nameField.waitForExistence(timeout: 10))
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
        XCTAssertTrue(
            selectionActions.waitForExistence(timeout: 10),
            "入力欄で文字を選択・コピーできない: \(app.debugDescription)"
        )
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

    // 文字サイズ最大のテストは、確かめる流れごとに分ける。1つのテストで起動から回転までを
    // 続けると、CIのSimulatorでは要素が多い画面の操作1回に数十秒かかることがあり、
    // 途中での横向きへの回転（19〜59秒）を含めて実行時間の上限や操作の時間切れに達していた（#44）。

    func testAccessibilityExtraExtraExtraLargeKeepsPrimaryControlsUsable() {
        let app = launchWithAccessibilityExtraExtraExtraLarge()

        assertPrimaryControlsAreUsable(in: app)
        openDocumentsPanel(in: app)
        XCTAssertTrue(app.buttons["閉じる"].isHittable, app.debugDescription)
    }

    func testAccessibilityExtraExtraExtraLargeKeepsSaveActionsReachable() {
        let app = launchWithAccessibilityExtraExtraExtraLarge()

        let save = app.buttons["保存"]
        XCTAssertTrue(save.waitForExistence(timeout: Self.editorAppearanceTimeout), app.debugDescription)
        save.tap()
        assertHittableAfterScrolling(app.buttons["PNGを保存"], in: app)
        assertHittableAfterScrolling(app.buttons["PDFを保存"], in: app)
        assertHittableAfterScrolling(app.buttons["この編み図"], in: app)
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

    /// 文字サイズを最大（アクセシビリティXXXL）にして起動し、WebViewが出るまで待つ。
    private func launchWithAccessibilityExtraExtraExtraLarge() -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments += [
            "-UIPreferredContentSizeCategoryName",
            "UICTContentSizeCategoryAccessibilityXXXL",
        ]
        app.launch()
        XCTAssertTrue(app.webViews.firstMatch.waitForExistence(timeout: Self.editorAppearanceTimeout))
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
        app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.15)).press(
            forDuration: 0.05,
            thenDragTo: app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.98)),
            withVelocity: .default,
            thenHoldForDuration: 0.0
        )
        return "閉じ方=下スワイプ(×ボタン exists=\(buttonExists) hittable=\(buttonHittable)) window=\(app.windows.firstMatch.frame)"
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
        for name in ["編み図", "盤面", "ブロック", "保存"] {
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
        maximumSwipes: Int = 12
    ) {
        let webView = app.webViews.firstMatch
        var swipes = 0
        while !element.isHittable, swipes < maximumSwipes {
            webView.swipeUp()
            swipes += 1
            _ = waitForHittable(element, timeout: 2)
        }
        XCTAssertTrue(
            element.isHittable,
            "スワイプ\(swipes)回で押せる位置に来ない frame=\(element.frame): \(app.debugDescription)"
        )
    }

    private func waitForHittable(_ element: XCUIElement, timeout: TimeInterval) -> Bool {
        let hittable = XCTNSPredicateExpectation(
            predicate: NSPredicate(format: "isHittable == true"),
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
