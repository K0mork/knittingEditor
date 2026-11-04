import Foundation
import XCTest
@testable import knittingEditor

final class BackupReadFailureTests: XCTestCase {
    private let iCloudMessage = "iCloudからファイルをダウンロードできませんでした。インターネットに接続してから、もう一度お試しください。"
    private let defaultMessage = "バックアップを読み込めませんでした"

    private enum GenericError: Error { case readFailed }

    private final class CyclicError: NSError, @unchecked Sendable {
        override var userInfo: [String: Any] {
            [NSUnderlyingErrorKey: self, NSMultipleUnderlyingErrorsKey: [self]]
        }
    }

    func testCocoaUbiquitousErrorsShowICloudMessage() {
        for code in [CocoaError.Code.ubiquitousFileUbiquityServerNotAvailable, .ubiquitousFileUnavailable] {
            XCTAssertEqual(BackupReadFailure.message(for: CocoaError(code)), iCloudMessage)
        }
        for code in [NSUbiquitousFileErrorMinimum, NSUbiquitousFileErrorMaximum] {
            XCTAssertEqual(BackupReadFailure.message(for: NSError(domain: NSCocoaErrorDomain, code: code)), iCloudMessage)
        }
    }

    func testNestedNetworkErrorShowsICloudMessage() {
        let error = NSError(domain: NSCocoaErrorDomain, code: 256, userInfo: [
            NSUnderlyingErrorKey: NSError(domain: "調整エラー", code: 1, userInfo: [
                NSUnderlyingErrorKey: URLError(.notConnectedToInternet),
            ]),
        ])
        XCTAssertEqual(BackupReadFailure.message(for: error), iCloudMessage)
    }

    func testMultipleUnderlyingDataNotAllowedShowsICloudMessage() {
        let error = NSError(domain: NSCocoaErrorDomain, code: 256, userInfo: [
            NSMultipleUnderlyingErrorsKey: [CocoaError(.fileReadNoSuchFile), URLError(.dataNotAllowed)],
        ])
        XCTAssertEqual(BackupReadFailure.message(for: error), iCloudMessage)
    }

    func testNetworkAndCloudDocsErrorsShowICloudMessage() {
        let codes: [URLError.Code] = [
            .notConnectedToInternet, .networkConnectionLost, .timedOut, .cannotFindHost,
            .cannotConnectToHost, .dnsLookupFailed, .internationalRoamingOff, .callIsActive, .dataNotAllowed,
        ]
        for code in codes {
            XCTAssertEqual(BackupReadFailure.message(for: URLError(code)), iCloudMessage)
        }
        XCTAssertEqual(BackupReadFailure.message(for: NSError(domain: "BRCloudDocsErrorDomain", code: 1)), iCloudMessage)
    }

    func testNotDownloadedICloudItemShowsICloudMessage() {
        let notDownloaded = BackupReadFailure.ICloudItemState(
            isUbiquitousItem: true, downloadingStatus: .notDownloaded, downloadingError: nil
        )
        XCTAssertEqual(BackupReadFailure.message(for: CocoaError(.fileReadNoSuchFile), item: notDownloaded), iCloudMessage)
        let unknown = BackupReadFailure.ICloudItemState(
            isUbiquitousItem: true, downloadingStatus: nil, downloadingError: nil
        )
        XCTAssertEqual(
            BackupReadFailure.message(for: CocoaError(.fileReadNoSuchFile), item: unknown), defaultMessage,
            "状態が取れないだけでは iCloud の失敗としない"
        )
    }

    func testResourceDownloadingErrorIsClassifiedAndLogged() {
        let item = BackupReadFailure.ICloudItemState(
            isUbiquitousItem: true, downloadingStatus: .current, downloadingError: URLError(.notConnectedToInternet)
        )
        let error = CocoaError(.fileReadNoSuchFile)
        XCTAssertEqual(BackupReadFailure.message(for: error, item: item), iCloudMessage)
        XCTAssertEqual(BackupReadFailure.errorKinds(for: error, item: item), [
            .init(domain: NSCocoaErrorDomain, code: 260), .init(domain: NSURLErrorDomain, code: -1009),
        ])
    }

    func testOtherFailuresKeepDefaultMessage() {
        let errors: [Error] = [
            CocoaError(.fileReadNoSuchFile), CocoaError(.fileReadNoPermission), CocoaError(.fileReadCorruptFile),
            GenericError.readFailed, URLError(.cancelled), NSError(domain: "別の領域", code: 4355),
            NSError(domain: NSCocoaErrorDomain, code: NSUbiquitousFileErrorMinimum - 1),
            NSError(domain: NSCocoaErrorDomain, code: NSUbiquitousFileErrorMaximum + 1),
        ]
        for error in errors {
            XCTAssertEqual(BackupReadFailure.message(for: error), defaultMessage)
        }
    }

    func testDownloadedOrLocalItemKeepsDefaultMessage() {
        for status in [URLUbiquitousItemDownloadingStatus.current, .downloaded] {
            let item = BackupReadFailure.ICloudItemState(
                isUbiquitousItem: true, downloadingStatus: status, downloadingError: nil
            )
            XCTAssertEqual(BackupReadFailure.message(for: CocoaError(.fileReadNoSuchFile), item: item), defaultMessage)
        }
        let local = BackupReadFailure.ICloudItemState(
            isUbiquitousItem: false, downloadingStatus: .notDownloaded, downloadingError: nil
        )
        XCTAssertEqual(BackupReadFailure.message(for: CocoaError(.fileReadNoSuchFile), item: local), defaultMessage)
    }

    func testCyclicUnderlyingErrorsTerminate() {
        let error = CyclicError(domain: NSCocoaErrorDomain, code: 260)
        XCTAssertEqual(BackupReadFailure.message(for: error), defaultMessage)
        XCTAssertEqual(BackupReadFailure.errorKinds(for: error), [.init(domain: NSCocoaErrorDomain, code: 260)])
    }

    func testDeepAndWideErrorChainsAreBounded() {
        var error: Error = URLError(.notConnectedToInternet)
        for _ in 0..<64 {
            error = NSError(domain: NSCocoaErrorDomain, code: 256, userInfo: [NSUnderlyingErrorKey: error])
        }
        XCTAssertEqual(BackupReadFailure.message(for: error), defaultMessage, "上限より深い原因へ進まない")
        XCTAssertEqual(BackupReadFailure.errorKinds(for: error).count, 33)
        let branches = NSError(domain: NSCocoaErrorDomain, code: 256, userInfo: [
            NSMultipleUnderlyingErrorsKey: (0..<256).map { NSError(domain: "原因", code: $0) },
        ])
        XCTAssertEqual(BackupReadFailure.errorKinds(for: branches).count, 128)
    }

    func testLoggedChainHasOnlyDomainsAndCodes() {
        let error = NSError(domain: NSCocoaErrorDomain, code: 256, userInfo: [
            NSFilePathErrorKey: "/非公開/編み図.knit", NSLocalizedDescriptionKey: "非公開の説明",
            NSUnderlyingErrorKey: URLError(.notConnectedToInternet),
        ])
        XCTAssertEqual(BackupReadFailure.errorKinds(for: error), [
            .init(domain: NSCocoaErrorDomain, code: 256), .init(domain: NSURLErrorDomain, code: -1009),
        ])
    }
}
