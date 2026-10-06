import Foundation
import WebKit

/// アプリのバージョンとビルド番号。不具合の報告で版を確かめられるよう、「使い方」の末尾に表示する（#84）。
///
/// 同梱ページへは`WKUserScript`で`window.knittingEditorAppInfo`として渡す。Info.plistの値を
/// そのまま使うので、通信せずに表示でき、Web資産へバージョンを書き込む必要もない。
struct AppVersionInfo: Equatable {
    let version: String
    let build: String

    static let current = AppVersionInfo(bundle: .main)

    init(version: String, build: String) {
        self.version = version
        self.build = build
    }

    init(bundle: Bundle) {
        self.init(
            version: bundle.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "",
            build: bundle.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? ""
        )
    }

    /// 同梱ページの読み込み前に、変更できない`window.knittingEditorAppInfo`を置くスクリプト。
    /// 値はJSONとして埋め込み、文字列の内容がスクリプトとして解釈されないようにする。
    var userScriptSource: String {
        let payload = ["version": version, "build": build]
        guard let data = try? JSONSerialization.data(withJSONObject: payload, options: [.sortedKeys]),
              let json = String(data: data, encoding: .utf8) else {
            return ""
        }
        return "window.knittingEditorAppInfo=Object.freeze(\(json));"
    }

    @MainActor
    var userScript: WKUserScript {
        WKUserScript(source: userScriptSource, injectionTime: .atDocumentStart, forMainFrameOnly: true)
    }
}
