import Foundation
import XCTest
@testable import knittingEditor

/// 「使い方」に表示するバージョンとビルド番号を、Info.plistから同梱ページへ渡せることを確かめる（#84）。
final class AppVersionInfoTests: XCTestCase {
    func testCurrentReadsMarketingVersionAndBuildNumber() {
        let info = AppVersionInfo.current
        XCTAssertEqual(info.version, Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String)
        XCTAssertEqual(info.build, Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String)
        XCTAssertFalse(info.version.isEmpty)
        XCTAssertFalse(info.build.isEmpty)
    }

    func testUserScriptDefinesFrozenAppInfo() throws {
        let source = AppVersionInfo(version: "1.2", build: "34").userScriptSource
        let prefix = "window.knittingEditorAppInfo=Object.freeze("
        let suffix = ");"
        XCTAssertTrue(source.hasPrefix(prefix), source)
        XCTAssertTrue(source.hasSuffix(suffix), source)

        let json = String(source.dropFirst(prefix.count).dropLast(suffix.count))
        let decoded = try JSONSerialization.jsonObject(with: Data(json.utf8)) as? [String: String]
        XCTAssertEqual(decoded, ["version": "1.2", "build": "34"])
    }

    /// 値に引用符や`</script>`が入っても、JSONの文字列として渡り、スクリプトとして実行されない。
    func testUserScriptEscapesValues() throws {
        let hostile = "1\"});alert(1);//</script>"
        let source = AppVersionInfo(version: hostile, build: "\n").userScriptSource
        let prefix = "window.knittingEditorAppInfo=Object.freeze("
        let json = String(source.dropFirst(prefix.count).dropLast(2))
        let decoded = try JSONSerialization.jsonObject(with: Data(json.utf8)) as? [String: String]
        XCTAssertEqual(decoded, ["version": hostile, "build": "\n"])
        XCTAssertFalse(source.contains("\n"))
    }

    @MainActor
    func testUserScriptRunsBeforeBundledPagesInMainFrameOnly() {
        let script = AppVersionInfo(version: "1.0", build: "1").userScript
        XCTAssertEqual(script.injectionTime, .atDocumentStart)
        XCTAssertTrue(script.isForMainFrameOnly)
    }
}
