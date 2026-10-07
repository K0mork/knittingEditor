import Foundation
import StoreKit
import UIKit

/// App Storeの評価の依頼（StoreKitのシステムの依頼画面）を出すかどうかの判定（#84）。
///
/// 依頼はPNG・PDFを保存・共有し終えた作業の区切りでだけ検討し、初回の起動直後や編集の途中には出さない。
/// 条件と理由は`ios/docs/NATIVE_BRIDGE.md`の「App Storeの評価の依頼」に書く。
/// システムは条件を満たしても画面を出さないことがあり（1年に3回まで、TestFlightでは出ない）、
/// 出たかどうかはアプリから分からない。そのため、依頼を試みた時点で記録する。
enum ReviewRequestPolicy {
    /// 依頼を検討する書き出しの種類。`.knit`のバックアップは作業の完成ではないので数えない。
    static let milestoneMimeTypes: Set<String> = ["image/png", "application/pdf"]
    /// 前回の依頼のあと（初めてなら最初から）に、PNG・PDFを保存・共有し終えた回数。
    static let minimumSuccessfulExports = 3
    /// 初めて起動してから依頼までに空ける時間。
    static let minimumTimeSinceFirstLaunch: TimeInterval = 3 * 24 * 60 * 60
    /// 前回の依頼から次の依頼までに空ける時間。
    static let minimumTimeBetweenRequests: TimeInterval = 120 * 24 * 60 * 60

    struct State: Equatable {
        var firstLaunchDate: Date?
        var successfulExportCount = 0
        var lastRequestedVersion: String?
        var lastRequestDate: Date?
    }

    static func countsAsMilestone(mimeType: String) -> Bool {
        milestoneMimeTypes.contains(mimeType)
    }

    static func shouldRequest(state: State, appVersion: String, now: Date) -> Bool {
        guard let firstLaunchDate = state.firstLaunchDate,
              now.timeIntervalSince(firstLaunchDate) >= minimumTimeSinceFirstLaunch else { return false }
        guard state.successfulExportCount >= minimumSuccessfulExports else { return false }
        // 同じバージョンでは一度だけ依頼する。
        guard !appVersion.isEmpty, state.lastRequestedVersion != appVersion else { return false }
        if let lastRequestDate = state.lastRequestDate,
           now.timeIntervalSince(lastRequestDate) < minimumTimeBetweenRequests {
            return false
        }
        return true
    }
}

/// 判定に使う記録を`UserDefaults`へ保存する。編み図のデータとは別に、端末内だけに置く。
struct ReviewRequestStore {
    private enum Key {
        static let firstLaunchDate = "reviewRequest.firstLaunchDate"
        static let successfulExportCount = "reviewRequest.successfulExportCount"
        static let lastRequestedVersion = "reviewRequest.lastRequestedVersion"
        static let lastRequestDate = "reviewRequest.lastRequestDate"
    }

    let defaults: UserDefaults

    func load() -> ReviewRequestPolicy.State {
        ReviewRequestPolicy.State(
            firstLaunchDate: defaults.object(forKey: Key.firstLaunchDate) as? Date,
            successfulExportCount: max(0, defaults.integer(forKey: Key.successfulExportCount)),
            lastRequestedVersion: defaults.string(forKey: Key.lastRequestedVersion),
            lastRequestDate: defaults.object(forKey: Key.lastRequestDate) as? Date
        )
    }

    func save(_ state: ReviewRequestPolicy.State) {
        set(state.firstLaunchDate, forKey: Key.firstLaunchDate)
        defaults.set(state.successfulExportCount, forKey: Key.successfulExportCount)
        set(state.lastRequestedVersion, forKey: Key.lastRequestedVersion)
        set(state.lastRequestDate, forKey: Key.lastRequestDate)
    }

    private func set(_ value: Any?, forKey key: String) {
        if let value {
            defaults.set(value, forKey: key)
        } else {
            defaults.removeObject(forKey: key)
        }
    }
}

/// 書き出しの完了を数え、評価の依頼を出してよいかを答える。
@MainActor
final class ReviewRequestTracker {
    private let store: ReviewRequestStore
    private let appVersion: String
    private let now: () -> Date

    init(
        defaults: UserDefaults = .standard,
        appVersion: String = AppVersionInfo.current.version,
        now: @escaping () -> Date = Date.init
    ) {
        store = ReviewRequestStore(defaults: defaults)
        self.appVersion = appVersion
        self.now = now
        recordFirstLaunchIfNeeded()
    }

    /// 初めて起動した日時を記録する。この版より前から使っている場合は、この版を初めて起動した日時になる。
    func recordFirstLaunchIfNeeded() {
        var state = store.load()
        guard state.firstLaunchDate == nil else { return }
        state.firstLaunchDate = now()
        store.save(state)
    }

    /// PNG・PDFを保存・共有し終えたときに呼ぶ。依頼を出してよければ`true`を返す。
    /// 依頼を実際に出したら`didRequestReview()`を呼ぶ。出せなかったときは次の区切りで改めて判定する。
    func recordSuccessfulExport(mimeType: String) -> Bool {
        guard ReviewRequestPolicy.countsAsMilestone(mimeType: mimeType) else { return false }
        var state = store.load()
        state.successfulExportCount += 1
        store.save(state)
        return ReviewRequestPolicy.shouldRequest(state: state, appVersion: appVersion, now: now())
    }

    /// 依頼の直前にも条件を確かめる。待つ間に別の依頼を出していないことを確かめるため。
    func shouldRequestNow() -> Bool {
        ReviewRequestPolicy.shouldRequest(state: store.load(), appVersion: appVersion, now: now())
    }

    func didRequestReview() {
        var state = store.load()
        state.successfulExportCount = 0
        state.lastRequestedVersion = appVersion
        state.lastRequestDate = now()
        store.save(state)
    }

    /// 保存画面・共有シートが閉じ切るのを待ってから出す。
    static let requestDelay: TimeInterval = 1

    /// PNG・PDFの保存・共有を終えたときに呼ぶ。条件を満たせば、少し待ってから依頼を出す。
    func exportDidSucceed(mimeType: String, window: @escaping @MainActor () -> UIWindow?) {
        guard recordSuccessfulExport(mimeType: mimeType) else { return }
        DispatchQueue.main.asyncAfter(deadline: .now() + Self.requestDelay) { [weak self] in
            MainActor.assumeIsolated {
                self?.requestReviewIfAppropriate(in: window())
            }
        }
    }

    /// アプリが前面にあり、ほかの画面（保存画面、共有シート、警告）が出ていないときだけ依頼する。
    private func requestReviewIfAppropriate(in window: UIWindow?) {
        guard shouldRequestNow(),
              let window,
              let scene = window.windowScene,
              scene.activationState == .foregroundActive,
              window.rootViewController?.presentedViewController == nil else { return }
        didRequestReview()
        AppStore.requestReview(in: scene)
    }
}
