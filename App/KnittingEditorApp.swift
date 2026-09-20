import SwiftUI

@main
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
        }
    }
}

struct ContentView: View {
    let model: WebViewModel

    var body: some View {
        WebViewContainer(model: model)
            .ignoresSafeArea(.container, edges: .bottom)
            .accessibilityLabel("棒針編み図エディタ")
    }
}
