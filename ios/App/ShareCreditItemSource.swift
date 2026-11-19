import UIKit

/// 共有シートへ添える文面（#474）。サイト名とURLだけを含め、編み図の内容やファイル名は入れない。
/// Web版の共有シートには文面を添えない（Web Share APIでは渡す先の操作ごとに項目を切り替えられないため）。
///
/// `String`を直接`activityItems`へ並べると、「ファイルに保存」・AirDrop・コピーのような
/// ファイルをそのまま扱う操作が、文面を余分な項目として保存・送信してしまう。
/// そのため`UIActivityItemSource`として、渡す先の操作ごとに文面を出すかを決める。
final class ShareCreditItemSource: NSObject, UIActivityItemSource {
    static let title = "棒針編み図エディタ"
    static let text = "棒針編み図エディタで作成 https://knittingeditor.com/"

    /// ファイルをそのまま保存・送信する操作の種類。ここへ文面を渡すと、余分な項目として保存・送られる。
    private static let fileOnlyActivityTypes: [UIActivity.ActivityType] = [
        .saveToCameraRoll, .airDrop, .copyToPasteboard, .print, .assignToContact,
        .addToReadingList, .openInIBooks, .markupAsPDF,
    ]

    /// 文面を渡すかどうか。メール・メッセージ・外部の共有機能（既知の定数に無い`rawValue`）には渡す。
    /// `nil`は操作の種類が定まらない要求（プレビューなど）で、文面を渡しても保存されないので渡す。
    /// 「ファイルに保存」は公開された定数が無いので、rawValueの部分一致（`SaveToFiles`）で見分ける。
    static func includesText(for activityType: UIActivity.ActivityType?) -> Bool {
        guard let activityType else { return true }
        if activityType.rawValue.contains("SaveToFiles") { return false }
        return !fileOnlyActivityTypes.contains(activityType)
    }

    func activityViewControllerPlaceholderItem(_ activityViewController: UIActivityViewController) -> Any {
        // 文面の有無で項目の型（`String`）を共有シートへ伝える。
        Self.text
    }

    func activityViewController(
        _ activityViewController: UIActivityViewController,
        itemForActivityType activityType: UIActivity.ActivityType?
    ) -> Any? {
        Self.includesText(for: activityType) ? Self.text : nil
    }

    func activityViewController(
        _ activityViewController: UIActivityViewController,
        subjectForActivityType activityType: UIActivity.ActivityType?
    ) -> String {
        // 件名を使うのはメール。サイト名を件名へ入れる。
        Self.title
    }
}
