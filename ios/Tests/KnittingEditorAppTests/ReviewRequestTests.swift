import Foundation
import XCTest
@testable import knittingEditor

/// App Storeの評価の依頼を出す条件を確かめる（#84）。
/// システムの依頼画面はTestFlightでは表示されず、実機でも表示回数が制限されるため、
/// 画面の表示ではなく、依頼を試みるかどうかの判定をここで確かめる。
final class ReviewRequestPolicyTests: XCTestCase {
    private let firstLaunch = Date(timeIntervalSince1970: 1_800_000_000)
    private let day: TimeInterval = 24 * 60 * 60

    private func readyState() -> ReviewRequestPolicy.State {
        ReviewRequestPolicy.State(
            firstLaunchDate: firstLaunch,
            successfulExportCount: ReviewRequestPolicy.minimumSuccessfulExports,
            lastRequestedVersion: nil,
            lastRequestDate: nil
        )
    }

    func testRequestsAfterEnoughExportsAndDays() {
        XCTAssertTrue(ReviewRequestPolicy.shouldRequest(state: readyState(), appVersion: "1.0", now: firstLaunch + 3 * day))
    }

    func testDoesNotRequestSoonAfterFirstLaunch() {
        XCTAssertFalse(ReviewRequestPolicy.shouldRequest(state: readyState(), appVersion: "1.0", now: firstLaunch))
        XCTAssertFalse(ReviewRequestPolicy.shouldRequest(state: readyState(), appVersion: "1.0", now: firstLaunch + 3 * day - 1))
    }

    func testDoesNotRequestWithoutRecordedFirstLaunch() {
        var state = readyState()
        state.firstLaunchDate = nil
        XCTAssertFalse(ReviewRequestPolicy.shouldRequest(state: state, appVersion: "1.0", now: firstLaunch + 30 * day))
    }

    func testDoesNotRequestBeforeEnoughExports() {
        var state = readyState()
        state.successfulExportCount = ReviewRequestPolicy.minimumSuccessfulExports - 1
        XCTAssertFalse(ReviewRequestPolicy.shouldRequest(state: state, appVersion: "1.0", now: firstLaunch + 30 * day))
    }

    func testRequestsOnlyOncePerVersion() {
        var state = readyState()
        state.lastRequestedVersion = "1.0"
        state.lastRequestDate = firstLaunch
        XCTAssertFalse(ReviewRequestPolicy.shouldRequest(state: state, appVersion: "1.0", now: firstLaunch + 365 * day))
        XCTAssertTrue(ReviewRequestPolicy.shouldRequest(state: state, appVersion: "1.1", now: firstLaunch + 365 * day))
    }

    func testWaitsBetweenRequestsEvenAfterUpdate() {
        var state = readyState()
        state.lastRequestedVersion = "1.0"
        state.lastRequestDate = firstLaunch + 10 * day
        XCTAssertFalse(ReviewRequestPolicy.shouldRequest(state: state, appVersion: "1.1", now: firstLaunch + 129 * day))
        XCTAssertTrue(ReviewRequestPolicy.shouldRequest(state: state, appVersion: "1.1", now: firstLaunch + 130 * day))
    }

    func testDoesNotRequestWithoutAppVersion() {
        XCTAssertFalse(ReviewRequestPolicy.shouldRequest(state: readyState(), appVersion: "", now: firstLaunch + 30 * day))
    }

    func testOnlyPngAndPdfCountAsMilestones() {
        XCTAssertTrue(ReviewRequestPolicy.countsAsMilestone(mimeType: "image/png"))
        XCTAssertTrue(ReviewRequestPolicy.countsAsMilestone(mimeType: "application/pdf"))
        XCTAssertFalse(ReviewRequestPolicy.countsAsMilestone(mimeType: "application/gzip"))
    }
}

@MainActor
final class ReviewRequestTrackerTests: XCTestCase {
    private var suiteName = ""
    private var defaults: UserDefaults!
    private var now = Date(timeIntervalSince1970: 1_800_000_000)
    private let day: TimeInterval = 24 * 60 * 60

    override func setUp() async throws {
        try await super.setUp()
        suiteName = "ReviewRequestTrackerTests.\(UUID().uuidString)"
        defaults = try XCTUnwrap(UserDefaults(suiteName: suiteName))
    }

    override func tearDown() async throws {
        defaults.removePersistentDomain(forName: suiteName)
        defaults = nil
        try await super.tearDown()
    }

    private func makeTracker(version: String = "1.0") -> ReviewRequestTracker {
        ReviewRequestTracker(defaults: defaults, appVersion: version, now: { [unowned self] in self.now })
    }

    private func exportPNG(times: Int, with tracker: ReviewRequestTracker) -> [Bool] {
        (0..<times).map { _ in tracker.recordSuccessfulExport(mimeType: "image/png") }
    }

    func testRecordsFirstLaunchOnlyOnce() {
        let launch = now
        _ = makeTracker()
        now += 10 * day
        _ = makeTracker()
        XCTAssertEqual(ReviewRequestStore(defaults: defaults).load().firstLaunchDate, launch)
    }

    /// 初回起動の当日は、何回書き出しても依頼しない。
    func testDoesNotRequestOnFirstDayEvenAfterManyExports() {
        let tracker = makeTracker()
        XCTAssertEqual(exportPNG(times: 10, with: tracker), Array(repeating: false, count: 10))
    }

    func testRequestsOnThirdExportAfterThreeDays() {
        let tracker = makeTracker()
        now += 3 * day
        XCTAssertEqual(exportPNG(times: 3, with: tracker), [false, false, true])
    }

    func testBackupExportsDoNotCount() {
        let tracker = makeTracker()
        now += 3 * day
        for _ in 0..<5 {
            XCTAssertFalse(tracker.recordSuccessfulExport(mimeType: "application/gzip"))
        }
        XCTAssertEqual(ReviewRequestStore(defaults: defaults).load().successfulExportCount, 0)
    }

    func testCountsPersistAcrossLaunches() {
        _ = exportPNG(times: 2, with: makeTracker())
        now += 3 * day
        XCTAssertTrue(makeTracker().recordSuccessfulExport(mimeType: "application/pdf"))
    }

    /// 依頼を試みたら、同じ版では二度と依頼せず、回数も数え直す。
    func testRequestIsRecordedAndNotRepeatedForSameVersion() {
        let tracker = makeTracker()
        now += 3 * day
        _ = exportPNG(times: 3, with: tracker)
        XCTAssertTrue(tracker.shouldRequestNow())
        tracker.didRequestReview()

        let state = ReviewRequestStore(defaults: defaults).load()
        XCTAssertEqual(state.successfulExportCount, 0)
        XCTAssertEqual(state.lastRequestedVersion, "1.0")
        XCTAssertEqual(state.lastRequestDate, now)

        XCTAssertFalse(tracker.shouldRequestNow())
        now += 365 * day
        XCTAssertEqual(exportPNG(times: 5, with: tracker), Array(repeating: false, count: 5))
    }

    func testNextVersionNeedsNewExportsAndInterval() {
        let tracker = makeTracker()
        now += 3 * day
        _ = exportPNG(times: 3, with: tracker)
        tracker.didRequestReview()

        let updated = makeTracker(version: "1.1")
        now += 30 * day
        XCTAssertEqual(exportPNG(times: 3, with: updated), [false, false, false])
        now += 90 * day
        XCTAssertTrue(updated.recordSuccessfulExport(mimeType: "image/png"))
    }

    /// 依頼を出せなかった（アプリが背面にあったなど）ときは記録せず、次の区切りで改めて判定する。
    func testUnsentRequestIsRetriedAtNextMilestone() {
        let tracker = makeTracker()
        now += 3 * day
        XCTAssertEqual(exportPNG(times: 3, with: tracker), [false, false, true])
        XCTAssertTrue(tracker.recordSuccessfulExport(mimeType: "image/png"))
    }
}
