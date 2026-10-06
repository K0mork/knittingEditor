import UniformTypeIdentifiers
import XCTest
@testable import knittingEditor

/// `.knit`の種類名は、Filesの「情報を見る」や共有シートに出る（#82）。
final class KnittingEditorUTTypeTests: XCTestCase {
    /// Info.plistの`UTTypeDescription`・`CFBundleTypeName`の値。InfoPlist.stringsでは、この値が訳のキーになる。
    private static let typeNameKey = "棒針編み図バックアップ"
    private static let localizedTypeNames = [
        "ja": "棒針編み図バックアップ",
        "en": "Knitting Chart Backup",
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

    func testKnitTypeNameIsTranslatedIntoJapaneseAndEnglish() throws {
        for (language, expected) in Self.localizedTypeNames {
            let path = try XCTUnwrap(
                Bundle.main.path(forResource: language, ofType: "lproj"),
                "\(language).lprojがアプリに入っていません"
            )
            let bundle = try XCTUnwrap(Bundle(path: path))
            XCTAssertEqual(
                bundle.localizedString(forKey: Self.typeNameKey, value: nil, table: "InfoPlist"),
                expected,
                language
            )
        }
    }

    /// システムが返す種類名が、アプリの表示言語の訳になっていることを確かめる。
    /// キーが訳と合っていないと、英語の端末でもInfo.plistの日本語がそのまま出る。
    func testSystemDescribesKnitTypeInTheAppLanguage() throws {
        let language = try XCTUnwrap(Bundle.main.preferredLocalizations.first)
        let expected = try XCTUnwrap(Self.localizedTypeNames[language], "想定していない表示言語: \(language)")
        XCTAssertEqual(UTType.knittingEditorBackup.localizedDescription, expected)
    }
}
