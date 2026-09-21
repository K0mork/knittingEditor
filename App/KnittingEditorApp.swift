import SwiftUI

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

            if !model.webContentReady {
                Color(.systemBackground)
                    .ignoresSafeArea()
                VStack(spacing: 12) {
                    ProgressView()
                    Text("編み図を準備しています…")
                        .font(.body)
                        .foregroundStyle(.secondary)
                }
                .accessibilityElement(children: .combine)
                .accessibilityLabel("編み図を準備しています")
                .accessibilityIdentifier("editorLoadingOverlay")
            }
        }
    }
}
