import UIKit

/// Apple Pencil（第2世代以降）のダブルタップで、描くと消すを切り替える（#269）。
///
/// iPadの設定（設定 > Apple Pencil の「ダブルタップ」）に従う。Appleの指針どおり、利用者が選んだ動作を
/// アプリが置き換えない。切り替えの中身はWeb側の「描く」「消す」ボタンと同じ処理で、ここは命令を送るだけにする。
enum PencilDoubleTap {
    /// iPadの設定ごとの扱い。消しゴムへの切り替えと、直前の道具への切り替えは、どちらも描く⇔消すにする。
    /// このアプリの道具は描くと消すの2つが中心で、直前の道具はほぼ必ずもう一方になるため。
    /// 「オフ」や、カラーパレットなどこのアプリに無い動作のときは何もしない。
    nonisolated static func command(for action: UIPencilPreferredAction) -> EditorCommand? {
        switch action {
        case .switchEraser, .switchPrevious: return .toggleEraser
        default: return nil
        }
    }
}

/// 編集画面のWebViewに付ける`UIPencilInteraction`の受け手。
@MainActor
final class PencilDoubleTapHandler: NSObject, UIPencilInteractionDelegate {
    private weak var model: WebViewModel?
    /// テストで設定の値を差し替える。既定はiPadの設定。
    /// `UIPencilInteraction.preferredTapAction`はMainActorでしか読めないので、クロージャの型にもMainActorを付ける。
    private let preferredAction: @MainActor () -> UIPencilPreferredAction

    init(
        model: WebViewModel,
        preferredAction: @escaping @MainActor () -> UIPencilPreferredAction = { UIPencilInteraction.preferredTapAction }
    ) {
        self.model = model
        self.preferredAction = preferredAction
    }

    /// iPadOS 17.5以降で呼ばれる。
    @available(iOS 17.5, *)
    func pencilInteraction(_ interaction: UIPencilInteraction, didReceiveTap tap: UIPencilInteraction.Tap) {
        handleTap()
    }

    /// iPadOS 17.0〜17.4で呼ばれる。17.5以降は上の`didReceiveTap`が代わりに呼ばれる。
    func pencilInteractionDidTap(_ interaction: UIPencilInteraction) {
        handleTap()
    }

    func handleTap() {
        guard let command = PencilDoubleTap.command(for: preferredAction()) else { return }
        model?.perform(command)
    }
}
