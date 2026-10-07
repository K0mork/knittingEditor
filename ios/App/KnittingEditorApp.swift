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
                .ignoresSafeArea(.container, edges: .bottom)
                .accessibilityLabel("棒針編み図エディタ")
                .accessibilityIdentifier("knittingEditorWebView")

            if model.isPreparingEditor {
                let style = model.loadingStyle
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
        }
    }
}

/// 起動画面から編集画面までの色。v1.0は明るい配色に固定する（`Info.plist`の`UIUserInterfaceStyle`）。
/// 編集画面のCSSにはダーク用の配色が無いため、端末の設定に合わせて黒い背景を挟むと、
/// 起動画面・準備中の表示・編集画面の順に色がちらつく（#79）。
enum AppColors {
    /// 起動画面（`UILaunchScreen`）の色。起動直後の準備中の表示も同じ色にして、つなぎ目を無くす。
    static let launchBackground = UIColor(named: "LaunchBackground")
        ?? UIColor(red: 0.204, green: 0.435, blue: 0.259, alpha: 1)
    /// 編集画面と使い方ページの地の色。`packages/editor-core/styles/base.css`の`:root`の`background`と同じ。
    static let editorPageBackground = UIColor(red: 0xF3 / 255, green: 0xF0 / 255, blue: 0xE8 / 255, alpha: 1)
    /// 編集画面の補足の文字の色（`packages/editor-core/styles/base.css`の`.gesture-hint`の`color`と同じ）。地の色とのコントラスト比は約5.9:1。
    static let editorSecondaryText = UIColor(red: 0x52 / 255, green: 0x60 / 255, blue: 0x59 / 255, alpha: 1)
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

    var foregroundColor: UIColor {
        switch self {
        case .launch: return .white // 起動画面の緑とのコントラスト比は約6:1。
        case .inApp: return AppColors.editorSecondaryText
        }
    }
}
