import UIKit
import XCTest
@testable import knittingEditor

/// 起動画面・準備中の表示・編集画面の色が、ライト・ダークのそれぞれでそろっていることを確かめる（#79、#116）。
final class AppAppearanceTests: XCTestCase {
    private let light = UITraitCollection(userInterfaceStyle: .light)
    private let dark = UITraitCollection(userInterfaceStyle: .dark)

    /// 編集画面のCSSはライト用とダーク用の配色を持つので、アプリは端末の外観に従う。
    func testAppFollowsSystemAppearance() {
        XCTAssertNil(Bundle.main.object(forInfoDictionaryKey: "UIUserInterfaceStyle"))
    }

    func testLaunchScreenUsesLaunchBackgroundAsset() throws {
        let launchScreen = try XCTUnwrap(Bundle.main.object(forInfoDictionaryKey: "UILaunchScreen") as? [String: Any])
        XCTAssertEqual(launchScreen["UIColorName"] as? String, "LaunchBackground")
        let asset = try XCTUnwrap(UIColor(named: "LaunchBackground", in: .main, compatibleWith: nil))
        XCTAssertEqual(rgba(AppColors.launchBackground), rgba(asset))
    }

    /// 起動直後の準備中の表示は、ライト・ダークのどちらでも起動画面と同じ色にする。
    func testLaunchLoadingStyleMatchesLaunchScreenInBothAppearances() {
        let style = EditorLoadingStyle.launch
        XCTAssertEqual(rgba(style.backgroundColor, traits: light), rgba(AppColors.launchBackground, traits: light))
        XCTAssertEqual(rgba(style.backgroundColor, traits: dark), rgba(AppColors.launchBackground, traits: dark))
        XCTAssertEqual(rgba(AppColors.launchBackground, traits: light), [0x34, 0x6F, 0x42, 0xFF])
        XCTAssertEqual(rgba(AppColors.launchBackground, traits: dark), [0x1F, 0x42, 0x28, 0xFF])
    }

    /// 編集画面へ戻るときの準備中の表示と`WKWebView`の背景は、編集画面の地の色にする。
    func testInAppLoadingStyleMatchesEditorPageBackground() {
        XCTAssertEqual(rgba(AppColors.editorPageBackground, traits: light), [0xF3, 0xF0, 0xE8, 0xFF])
        XCTAssertEqual(rgba(AppColors.editorPageBackground, traits: dark), [0x17, 0x1C, 0x19, 0xFF])
        for traits in [light, dark] {
            XCTAssertEqual(rgba(EditorLoadingStyle.inApp.backgroundColor, traits: traits), rgba(AppColors.editorPageBackground, traits: traits))
        }
    }

    /// 準備中の表示の文字は、ライト・ダークのどちらでもWCAGのAA（通常の文字で4.5:1）を満たす。
    func testLoadingTextContrastMeetsWCAGAA() {
        for style in [EditorLoadingStyle.launch, .inApp] {
            for traits in [light, dark] {
                let ratio = contrastRatio(style.foregroundColor, style.backgroundColor, traits: traits)
                XCTAssertGreaterThanOrEqual(ratio, 4.5, "\(style) \(traits.userInterfaceStyle.rawValue): \(ratio)")
            }
        }
    }

    /// Swift側の地の色が、同梱した編集画面のCSSのライト用・ダーク用の色とずれていないことを確かめる。
    func testEditorPageBackgroundMatchesBundledStylesheet() throws {
        let assets = try XCTUnwrap(Bundle.main.resourceURL?.appendingPathComponent("Web/assets", isDirectory: true))
        let stylesheets = try FileManager.default.contentsOfDirectory(at: assets, includingPropertiesForKeys: nil)
            .filter { $0.pathExtension == "css" }
        XCTAssertFalse(stylesheets.isEmpty, "同梱のCSSが見つからない")
        let css = try stylesheets.map { try String(contentsOf: $0, encoding: .utf8) }.joined().lowercased()
        let darkBlocks = try NSRegularExpression(pattern: #"@media\s*\(\s*prefers-color-scheme\s*:\s*dark\s*\)\s*\{\s*:root\s*\{[^}]*\}\s*\}"#)
        let fullRange = NSRange(css.startIndex..., in: css)
        let darkCSS = darkBlocks.matches(in: css, range: fullRange)
            .compactMap { Range($0.range, in: css).map { String(css[$0]) } }
            .joined()
        let lightCSS = darkBlocks.stringByReplacingMatches(in: css, range: fullRange, withTemplate: "")
        for (traits, source) in [(light, lightCSS), (dark, darkCSS)] {
            let declared = try XCTUnwrap(rootBackgroundHex(in: source), "同梱のCSSの`:root`に地の色の宣言が見つからない（\(traits.userInterfaceStyle.rawValue)）")
            let expected = rgba(AppColors.editorPageBackground, traits: traits).prefix(3).map { String(format: "%02x", $0) }.joined()
            XCTAssertEqual(declared, expected, "編集画面のCSSの地の色が変わったら`AppColors.editorPageBackground`もそろえる")
        }
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

    private func contrastRatio(_ first: UIColor, _ second: UIColor, traits: UITraitCollection) -> Double {
        let lighter = max(relativeLuminance(first, traits: traits), relativeLuminance(second, traits: traits))
        let darker = min(relativeLuminance(first, traits: traits), relativeLuminance(second, traits: traits))
        return (lighter + 0.05) / (darker + 0.05)
    }

    private func relativeLuminance(_ color: UIColor, traits: UITraitCollection) -> Double {
        let channels = rgba(color, traits: traits).prefix(3).map { value -> Double in
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
