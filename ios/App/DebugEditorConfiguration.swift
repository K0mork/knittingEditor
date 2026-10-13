#if DEBUG
import Foundation

/// UIテスト用。Releaseでは環境変数の読み取りもスクリプトの生成も含めない。
enum DebugEditorConfiguration {
    static func userScriptSource(environment: [String: String]) -> String? {
        guard let raw = environment["KNITTING_EDITOR_AUTOSAVE_DELAY_MS"],
              let delay = Int(raw), (0...2_147_483_647).contains(delay) else { return nil }
        return "window.knittingEditorDebugConfiguration=Object.freeze({autosaveDelayMs:\(delay)});"
    }
}
#endif
