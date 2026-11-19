#if DEBUG
import Foundation

/// UIテスト用。Releaseでは環境変数の読み取りもスクリプトの生成も含めない。
enum DebugEditorConfiguration {
    static func userScriptSource(environment: [String: String]) -> String? {
        var values: [String: Any] = [:]
        if let raw = environment["KNITTING_EDITOR_AUTOSAVE_DELAY_MS"],
           let delay = Int(raw), (0...2_147_483_647).contains(delay) {
            values["autosaveDelayMs"] = delay
        }
        if let size = environment["KNITTING_EDITOR_BRIDGE_IO_SIZE"], ["small", "medium", "large"].contains(size) {
            values["bridgeIOSize"] = size
        }
        // アプリ更新シミュレーションの更新前アプリがfixtureを書き込む（#446）。値は「1」だけを受け入れる。
        if environment["KNITTING_EDITOR_APP_UPDATE_FIXTURE"] == "1" {
            values["appUpdateFixture"] = true
        }
        guard !values.isEmpty,
              let data = try? JSONSerialization.data(withJSONObject: values, options: [.sortedKeys]),
              let json = String(data: data, encoding: .utf8) else { return nil }
        return "window.knittingEditorDebugConfiguration=Object.freeze(\(json));"
    }
}
#endif
