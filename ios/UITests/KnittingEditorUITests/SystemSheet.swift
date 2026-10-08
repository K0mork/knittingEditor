import XCTest

/// Document Pickerなど、別プロセスで出るシステムシートの要素を端末の言語に依存せずに探す。
///
/// アプリがローカライズを持たない間は、閉じるボタンのidentifierが`Cancel`だった。
/// `InfoPlist.xcstrings`（#119）でローカライズを持つと、identifierは無くなり、labelが端末の言語の
/// 「Cancel」「キャンセル」になる。ファイル一覧の`Browse View (Picker)`は言語によらず同じである。
///
/// アプリの確認ダイアログにも「キャンセル」ボタンがあるため、ダイアログが消えてから使う。
@MainActor
enum SystemSheet {
    private static let identifiers = ["Cancel", "Browse View (Picker)"]
    private static let closeLabels = ["Cancel", "キャンセル"]

    /// 表示中のシートにだけ存在する要素。閉じると消える。
    static func element(in app: XCUIApplication) -> XCUIElement {
        app.descendants(matching: .any)
            .matching(NSPredicate(format: "identifier IN %@ OR label IN %@", identifiers, closeLabels))
            .firstMatch
    }

    /// シートを閉じるボタン（iPadの「×」）。
    static func closeButton(in app: XCUIApplication) -> XCUIElement {
        app.buttons
            .matching(NSPredicate(format: "identifier == %@ OR label IN %@", "Cancel", closeLabels))
            .firstMatch
    }
}
