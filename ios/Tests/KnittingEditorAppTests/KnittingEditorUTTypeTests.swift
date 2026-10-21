import UniformTypeIdentifiers
import XCTest
@testable import knittingEditor

/// `.knit`の種類名は、Filesの「情報を見る」や共有シートに出る（#82）。
final class KnittingEditorUTTypeTests: XCTestCase {
    /// Info.plistの`UTTypeDescription`・`CFBundleTypeName`の値。InfoPlist.stringsでは、この値が訳のキーになる。
    private static let typeNameKey = "棒針編み図バックアップ"
    /// アプリの画面は日本語だけなので、訳も日本語だけを持つ。英語の訳を入れると、App Storeの「言語」に
    /// 英語が出て、英語で使えると誤解されやすい。
    private static let localizedTypeNames = [
        "ja": "棒針編み図バックアップ",
    ]

    /// 識別子を変えると、既存の`.knit`とアプリの関連付けが切れる。
    func testKnitTypeIdentifierIsUnchanged() {
        XCTAssertEqual(UTType.knittingEditorBackup.identifier, "com.k0mork.knitting-editor.knit")
        XCTAssertEqual(UTType.knittingEditorBackup.preferredFilenameExtension, "knit")
        XCTAssertEqual(UTType(filenameExtension: "knit"), .knittingEditorBackup)
    }

    func testInfoPlistUsesTheTranslationKeyAsTypeName() throws {
        let info = try XCTUnwrap(Bundle.main.infoDictionary)
        let exported = try XCTUnwrap(info["UTExportedTypeDeclarations"] as? [[String: Any]])
        let documents = try XCTUnwrap(info["CFBundleDocumentTypes"] as? [[String: Any]])
        XCTAssertEqual(exported.first?["UTTypeDescription"] as? String, Self.typeNameKey)
        XCTAssertEqual(documents.first?["CFBundleTypeName"] as? String, Self.typeNameKey)
    }

    /// 端末やアプリの表示言語に依存しないよう、各言語の`InfoPlist.strings`をファイルとして直接読む。
    /// `localizedString(forKey:)`は、キーが無いとキーそのものを返す。日本語の訳はキーと同じ文字列なので、
    /// その方法ではキーが欠けていても通ってしまう。
    func testKnitTypeNameIsTranslatedIntoJapanese() throws {
        for (language, expected) in Self.localizedTypeNames.sorted(by: { $0.key < $1.key }) {
            let path = try XCTUnwrap(
                Bundle.main.path(
                    forResource: "InfoPlist",
                    ofType: "strings",
                    inDirectory: nil,
                    forLocalization: language
                ),
                "\(language).lproj/InfoPlist.stringsがアプリに入っていません"
            )
            XCTAssertTrue(
                path.hasSuffix("/\(language).lproj/InfoPlist.strings"),
                "\(language)の代わりに別の言語のファイルが選ばれました: \(path)"
            )
            let data = try Data(contentsOf: URL(fileURLWithPath: path))
            let strings = try XCTUnwrap(
                PropertyListSerialization.propertyList(from: data, format: nil) as? [String: String],
                "\(language).lproj/InfoPlist.stringsを読めません"
            )
            XCTAssertEqual(strings[Self.typeNameKey], expected, language)
        }
    }

    /// アプリに入る言語は日本語だけにする。`.lproj`が1つも無いと、Foundationはどの端末でもアプリの言語を
    /// 英語と判定し、ファイル選択などシステムが出す文言も英語になる。日本語だけを入れると、端末の言語によらず日本語になる。
    func testAppIsLocalizedOnlyIntoJapanese() {
        XCTAssertEqual(Bundle.main.localizations.filter { $0 != "Base" }, ["ja"])
        XCTAssertEqual(Bundle.main.developmentLocalization, "ja")
    }

    /// システムが返す種類名が日本語になることを確かめる。アプリの言語は端末の言語によらず日本語なので、
    /// CIのSimulatorの表示言語が英語でも日本語の経路を通る。
    func testSystemDescribesKnitTypeInJapanese() throws {
        let language = try XCTUnwrap(Bundle.main.preferredLocalizations.first)
        print("KnittingEditorUTTypeTests: app language = \(language)")
        XCTAssertEqual(language, "ja")
        XCTAssertEqual(UTType.knittingEditorBackup.localizedDescription, Self.localizedTypeNames["ja"])
    }
}
