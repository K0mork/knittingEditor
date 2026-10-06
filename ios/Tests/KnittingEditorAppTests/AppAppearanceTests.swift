import UIKit
import XCTest
@testable import knittingEditor

/// 起動画面・準備中の表示・編集画面の色がそろっていることを確かめる（#79）。
final class AppAppearanceTests: XCTestCase {
    /// 編集画面のCSSは明るい配色だけを持つ。端末がダークモードでもアプリを明るい配色に固定し、
    /// 準備中の表示やシステムのダイアログだけが暗くならないようにする。
    func testAppIsFixedToLightAppearance() {
        let style = Bundle.main.object(forInfoDictionaryKey: "UIUserInterfaceStyle") as? String
        XCTAssertEqual(style, "Light")
    }

    func testLaunchScreenUsesLaunchBackgroundAsset() throws {
        let launchScreen = try XCTUnwrap(Bundle.main.object(forInfoDictionaryKey: "UILaunchScreen") as? [String: Any])
        XCTAssertEqual(launchScreen["UIColorName"] as? String, "LaunchBackground")
        let asset = try XCTUnwrap(UIColor(named: "LaunchBackground", in: .main, compatibleWith: nil))
        XCTAssertEqual(rgba(AppColors.launchBackground), rgba(asset))
    }

    /// 起動直後の準備中の表示は起動画面と同じ色で、ダークモードでも変わらない。
    func testLaunchLoadingStyleMatchesLaunchScreenInBothAppearances() {
        let style = EditorLoadingStyle.launch
        let light = UITraitCollection(userInterfaceStyle: .light)
        let dark = UITraitCollection(userInterfaceStyle: .dark)
        XCTAssertEqual(rgba(style.backgroundColor, traits: light), rgba(AppColors.launchBackground, traits: light))
        XCTAssertEqual(rgba(style.backgroundColor, traits: dark), rgba(AppColors.launchBackground, traits: light))
    }

    /// 編集画面へ戻るときの準備中の表示と`WKWebView`の背景は、編集画面の地の色（`#f3f0e8`）にする。
    func testInAppLoadingStyleMatchesEditorPageBackground() {
        XCTAssertEqual(rgba(AppColors.editorPageBackground), [0xF3, 0xF0, 0xE8, 0xFF])
        XCTAssertEqual(rgba(EditorLoadingStyle.inApp.backgroundColor), rgba(AppColors.editorPageBackground))
    }

    /// 準備中の表示の文字は、WCAGのAA（通常の文字で4.5:1）を満たす。
    func testLoadingTextContrastMeetsWCAGAA() {
        for style in [EditorLoadingStyle.launch, .inApp] {
            let ratio = contrastRatio(style.foregroundColor, style.backgroundColor)
            XCTAssertGreaterThanOrEqual(ratio, 4.5, "\(style): \(ratio)")
        }
    }

    /// Swift側の地の色が、同梱した編集画面のCSSの色とずれていないことを確かめる。
    func testEditorPageBackgroundMatchesBundledStylesheet() throws {
        let assets = try XCTUnwrap(Bundle.main.resourceURL?.appendingPathComponent("Web/assets", isDirectory: true))
        let stylesheets = try FileManager.default.contentsOfDirectory(at: assets, includingPropertiesForKeys: nil)
            .filter { $0.pathExtension == "css" }
        XCTAssertFalse(stylesheets.isEmpty, "同梱のCSSが見つからない")
        let css = try stylesheets.map { try String(contentsOf: $0, encoding: .utf8) }.joined().lowercased()
        let declared = try XCTUnwrap(rootBackgroundHex(in: css), "同梱のCSSの`:root`に地の色の宣言が見つからない")
        let expected = rgba(AppColors.editorPageBackground).prefix(3).map { String(format: "%02x", $0) }.joined()
        XCTAssertEqual(declared, expected, "編集画面のCSSの地の色が変わったら`AppColors.editorPageBackground`もそろえる")
    }

    /// `:root`の`background`（または`background-color`）に書かれた最後の色を、6桁の16進数で返す。
    /// 圧縮の有無や宣言の順番、空白、3桁の書き方に左右されないようにする。
    private func rootBackgroundHex(in css: String) throws -> String? {
        let rootBlock = try NSRegularExpression(pattern: #":root\s*\{([^}]*)\}"#)
        let declaration = try NSRegularExpression(
            pattern: #"(?:^|[;{\s])background(?:-color)?\s*:\s*#([0-9a-f]{6}|[0-9a-f]{3})(?![0-9a-f])"#
        )
        var found: String?
        for block in rootBlock.matches(in: css, range: NSRange(css.startIndex..., in: css)) {
            guard let bodyRange = Range(block.range(at: 1), in: css) else { continue }
            let body = String(css[bodyRange])
            for match in declaration.matches(in: body, range: NSRange(body.startIndex..., in: body)) {
                guard let hexRange = Range(match.range(at: 1), in: body) else { continue }
                let hex = String(body[hexRange])
                found = hex.count == 3 ? hex.map { "\($0)\($0)" }.joined() : hex
            }
        }
        return found
    }

    @MainActor
    func testLoadingStyleFollowsLaunchThenStaysInApp() {
        let model = WebViewModel()
        XCTAssertEqual(model.loadingStyle, .launch)

        model.webContentDidBecomeReady()
        XCTAssertEqual(model.loadingStyle, .inApp)

        model.webContentDidStartNavigation(to: URL(string: "knitting-local://bundle/guide/index.html"))
        model.webContentDidStartNavigation(to: LocalWebSchemeHandler.indexURL)
        XCTAssertTrue(model.isPreparingEditor)
        XCTAssertEqual(model.loadingStyle, .inApp, "使い方ページから戻るときは起動画面の色を挟まない")
    }

    private func contrastRatio(_ first: UIColor, _ second: UIColor) -> Double {
        let lighter = max(relativeLuminance(first), relativeLuminance(second))
        let darker = min(relativeLuminance(first), relativeLuminance(second))
        return (lighter + 0.05) / (darker + 0.05)
    }

    private func relativeLuminance(_ color: UIColor) -> Double {
        let channels = rgba(color).prefix(3).map { value -> Double in
            let c = Double(value) / 255
            return c <= 0.03928 ? c / 12.92 : pow((c + 0.055) / 1.055, 2.4)
        }
        return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
    }

    private func rgba(_ color: UIColor, traits: UITraitCollection = UITraitCollection(userInterfaceStyle: .light)) -> [Int] {
        var red: CGFloat = 0
        var green: CGFloat = 0
        var blue: CGFloat = 0
        var alpha: CGFloat = 0
        XCTAssertTrue(color.resolvedColor(with: traits).getRed(&red, green: &green, blue: &blue, alpha: &alpha))
        return [red, green, blue, alpha].map { Int(($0 * 255).rounded()) }
    }
}
