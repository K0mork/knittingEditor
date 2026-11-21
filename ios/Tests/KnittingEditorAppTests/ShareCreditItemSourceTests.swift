import UIKit
import XCTest
@testable import knittingEditor

/// 共有シートへ添える文面が、渡す先の操作ごとに切り替わることを確かめる（#474）。
/// 実際の共有シートで各操作がどう受け取るかはSimulatorのUIテストと実機で確かめるので、ここでは判定だけを確かめる。
final class ShareCreditItemSourceTests: XCTestCase {
    private let source = ShareCreditItemSource()

    /// 実際の共有シートと同じように、`UIActivityViewController`経由で文面を取り出す。
    private func item(for activityType: UIActivity.ActivityType?) -> Any? {
        let activity = UIActivityViewController(activityItems: [], applicationActivities: nil)
        return source.activityViewController(activity, itemForActivityType: activityType)
    }

    func testTextCarriesTheSiteNameAndURLOnly() {
        XCTAssertEqual(ShareCreditItemSource.title, "棒針編み図エディタ")
        XCTAssertEqual(ShareCreditItemSource.text, "棒針編み図エディタで作成 https://knittingeditor.com/")
    }

    func testMessageLikeActivitiesGetTheText() {
        // メール・メッセージと、外部の共有機能（既知の定数に無い`rawValue`）には文面を渡す。
        for activityType: UIActivity.ActivityType? in [.mail, .message, .init("com.example.share-extension")] {
            XCTAssertTrue(ShareCreditItemSource.includesText(for: activityType), "\(String(describing: activityType))")
            XCTAssertEqual(item(for: activityType) as? String, ShareCreditItemSource.text)
        }
    }

    func testFileOnlyActivitiesDoNotGetTheText() {
        // ファイルをそのまま保存・送信する操作では、ファイルだけを渡す。
        let fileOnlyTypes: [UIActivity.ActivityType] = [
            .saveToCameraRoll, .airDrop, .copyToPasteboard, .print, .assignToContact,
            .addToReadingList, .openInIBooks, .markupAsPDF,
        ]
        for activityType in fileOnlyTypes {
            XCTAssertFalse(ShareCreditItemSource.includesText(for: activityType), "\(activityType.rawValue)")
            XCTAssertNil(item(for: activityType), "\(activityType.rawValue)")
        }
    }

    /// 「ファイルに保存」は公開された定数が無い。iOS 27.2のSimulatorのdyld共有キャッシュに
    /// ある実際のrawValueで、`SaveToFiles`の部分一致が効くことを確かめる。
    func testSaveToFilesActivityFromIOS27DoesNotGetTheText() {
        let saveToFiles = UIActivity.ActivityType("com.apple.DocumentManagerUICore.SaveToFiles")
        XCTAssertFalse(ShareCreditItemSource.includesText(for: saveToFiles))
        XCTAssertNil(item(for: saveToFiles))
    }

    func testUnspecifiedActivityTypeStillGetsTheText() {
        // 操作の種類が定まらない要求（プレビューなど）には、保存先が無いので文面を渡す。
        XCTAssertTrue(ShareCreditItemSource.includesText(for: nil))
        XCTAssertEqual(item(for: nil) as? String, ShareCreditItemSource.text)
    }

    func testPlaceholderItemKeepsTheTextType() {
        let activity = UIActivityViewController(activityItems: [], applicationActivities: nil)
        XCTAssertEqual(source.activityViewControllerPlaceholderItem(activity) as? String, ShareCreditItemSource.text)
    }

    func testMailSubjectIsTheSiteName() {
        let activity = UIActivityViewController(activityItems: [], applicationActivities: nil)
        XCTAssertEqual(source.activityViewController(activity, subjectForActivityType: .mail), ShareCreditItemSource.title)
    }
}
