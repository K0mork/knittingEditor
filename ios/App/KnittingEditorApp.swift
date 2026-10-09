import SwiftUI
import UIKit

@main
@MainActor
struct KnittingEditorApp: App {
    @Environment(\.scenePhase) private var scenePhase
    @State private var webViewModel = WebViewModel()

    var body: some Scene {
        WindowGroup {
            ContentView(model: webViewModel)
                .onChange(of: scenePhase) { _, phase in
                    guard phase == .background || phase == .inactive else { return }
                    webViewModel.flushPendingSave()
                }
                .onOpenURL { url in
                    webViewModel.handleIncomingURL(url)
                }
        }
        .commands {
            EditorCommands(model: webViewModel)
        }
    }
}

struct ContentView: View {
    let model: WebViewModel

    var body: some View {
        ZStack {
            WebViewContainer(model: model)
                // 地の色を左右と下の端まで広げ、横向きで左右に黒い帯を出さない（#146）。
                // ボタンなどは、Web側が`env(safe-area-inset-*)`の余白でセーフエリアの内側に置く。
                // 上の端は、ステータスバーの文字の色と合わせるため広げない。
                .ignoresSafeArea(.container, edges: [.horizontal, .bottom])
                .accessibilityLabel("棒針編み図エディタ")
                .accessibilityIdentifier("knittingEditorWebView")

            if model.isPreparingEditor {
                let style = model.loadingStyle
                ZStack {
                    Color(uiColor: style.backgroundColor)
                        .ignoresSafeArea()
                    VStack(spacing: 12) {
                        ProgressView()
                            .tint(Color(uiColor: style.foregroundColor))
                        Text("編み図を準備しています…")
                            .font(.body)
                            .foregroundStyle(Color(uiColor: style.foregroundColor))
                    }
                    .accessibilityElement(children: .combine)
                    .accessibilityLabel("編み図を準備しています")
                    .accessibilityIdentifier("editorLoadingOverlay")
                }
                // 出すときはすぐ覆い、消すときだけ編集画面へふわっとつなぐ（#117）。動きは
                // `WebViewModel.webContentDidBecomeReady`の`withAnimation`で付ける。
                .transition(.asymmetric(insertion: .identity, removal: .opacity))
                // `ZStack`は取り除く途中の要素を後ろへ回すので、重ね順を固定してWebViewの上で消す。
                .zIndex(1)
            }
        }
    }
}

/// 起動画面から編集画面までの色。端末の外観（ライト・ダーク）に合わせる（#116）。
/// 編集画面のCSSと同じ色を、ライト用とダーク用の両方で持つ。どちらかだけ変えると、
/// 起動画面・準備中の表示・編集画面の順に色がちらつく（#79）。
enum AppColors {
    /// 起動画面（`UILaunchScreen`）の色。起動直後の準備中の表示も同じ色にして、つなぎ目を無くす。
    static let launchBackground = UIColor(named: "LaunchBackground")
        ?? UIColor(red: 0.204, green: 0.435, blue: 0.259, alpha: 1)
    /// 編集画面と使い方ページの地の色。`packages/editor-core/styles/base.css`の`:root`の`background`と同じ。
    static let editorPageBackground = dynamic(light: 0xF3F0E8, dark: 0x171C19)
    /// 編集画面の補足の文字の色（`packages/editor-core/styles/base.css`の`--hint-text`と同じ）。
    /// 地の色とのコントラスト比は、ライトで約5.9:1、ダークで約10:1。
    static let editorSecondaryText = dynamic(light: 0x526059, dark: 0xB6C2BA)

    private static func dynamic(light: UInt32, dark: UInt32) -> UIColor {
        UIColor { traits in rgb(traits.userInterfaceStyle == .dark ? dark : light) }
    }

    private static func rgb(_ value: UInt32) -> UIColor {
        UIColor(
            red: CGFloat((value >> 16) & 0xFF) / 255,
            green: CGFloat((value >> 8) & 0xFF) / 255,
            blue: CGFloat(value & 0xFF) / 255,
            alpha: 1
        )
    }
}

/// 準備中の表示の配色。直前に見えていた画面の色に合わせる。
enum EditorLoadingStyle: Equatable {
    /// 起動直後。起動画面から続けて表示する。
    case launch
    /// 使い方ページから戻るときなど、編集画面を一度表示したあと。ページの地の色に合わせる。
    case inApp

    var backgroundColor: UIColor {
        switch self {
        case .launch: return AppColors.launchBackground
        case .inApp: return AppColors.editorPageBackground
        }
    }

    /// 準備中の表示を消すときの動き。「視差効果を減らす」がオンのときは動かさずに消す。
    static let dismissDuration: TimeInterval = 0.2

    static func dismissAnimation(reduceMotion: Bool) -> Animation? {
        reduceMotion ? nil : .easeOut(duration: dismissDuration)
    }

    var foregroundColor: UIColor {
        switch self {
        case .launch: return .white // 起動画面の緑とのコントラスト比は約6:1。
        case .inApp: return AppColors.editorSecondaryText
        }
    }
}
