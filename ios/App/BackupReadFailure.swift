import Foundation
import os

/// 読み込みに失敗したときだけ、エラーと原本の状態から案内を選ぶ。
enum BackupReadFailure {
    static let defaultMessage = "バックアップを読み込めませんでした"
    static let iCloudMessage = "iCloudからファイルをダウンロードできませんでした。インターネットに接続してから、もう一度お試しください。"
    static let tooLargeMessage = "バックアップが大きすぎます"

    struct ICloudItemState {
        let isUbiquitousItem: Bool
        let downloadingStatus: URLUbiquitousItemDownloadingStatus?
        let downloadingError: Error?
    }

    struct ErrorKind: Equatable {
        let domain: String
        let code: Int
    }

    private static let logger = Logger(
        subsystem: Bundle.main.bundleIdentifier ?? "knittingEditor", category: "BackupRead"
    )
    private static let maximumDepth = 32
    private static let maximumErrors = 128
    private static let networkCodes: Set<Int> = [
        URLError.notConnectedToInternet.rawValue, URLError.networkConnectionLost.rawValue,
        URLError.timedOut.rawValue, URLError.cannotFindHost.rawValue,
        URLError.cannotConnectToHost.rawValue, URLError.dnsLookupFailed.rawValue,
        URLError.internationalRoamingOff.rawValue, URLError.callIsActive.rawValue,
        URLError.dataNotAllowed.rawValue,
    ]

    static func message(for error: Error, item: ICloudItemState? = nil) -> String {
        isICloudDownloadFailure(error, item: item) ? iCloudMessage : defaultMessage
    }

    static func isICloudDownloadFailure(_ error: Error, item: ICloudItemState? = nil) -> Bool {
        // 状態が取れないときは、未ダウンロードと決めつけずにエラーだけで判定する。
        if let item, item.isUbiquitousItem, item.downloadingStatus == .notDownloaded {
            return true
        }
        return errorKinds(for: error, item: item).contains { kind in
            switch kind.domain {
            case NSCocoaErrorDomain:
                return (NSUbiquitousFileErrorMinimum...NSUbiquitousFileErrorMaximum).contains(kind.code)
            case NSURLErrorDomain:
                return networkCodes.contains(kind.code)
            case "BRCloudDocsErrorDomain":
                return true
            default:
                return false
            }
        }
    }

    /// 原本と複製で同じ連鎖をたどる。循環、深すぎる連鎖、大量の枝に上限を設ける。
    static func errorKinds(for error: Error, item: ICloudItemState? = nil) -> [ErrorKind] {
        var visited: Set<ObjectIdentifier> = []
        // 走査中は参照を保持し、解放済みオブジェクトの識別子が再利用されるのを防ぐ。
        var errors: [NSError] = []
        func visit(_ error: NSError, depth: Int) {
            guard depth <= maximumDepth, errors.count < maximumErrors,
                  visited.insert(ObjectIdentifier(error)).inserted else { return }
            errors.append(error)
            if let underlying = error.userInfo[NSUnderlyingErrorKey] as? Error {
                visit(underlying as NSError, depth: depth + 1)
            }
            if let underlying = error.userInfo[NSMultipleUnderlyingErrorsKey] as? [Any] {
                for case let child as Error in underlying.prefix(maximumErrors) {
                    visit(child as NSError, depth: depth + 1)
                }
            }
        }
        visit(error as NSError, depth: 0)
        let kinds = errors.map { ErrorKind(domain: $0.domain, code: $0.code) }
        // 元のエラーの上限に達しても、リソース値のエラーは別に調べる。
        return kinds + (item?.downloadingError.map { errorKinds(for: $0) } ?? [])
    }

    /// ファイル名、パス、説明、その他のuserInfoはログへ渡さない。
    static func log(_ error: Error, item: ICloudItemState? = nil) {
        let chain = errorKinds(for: error, item: item)
            .map { "\($0.domain)(\($0.code))" }.joined(separator: " -> ")
        logger.error("\(chain, privacy: .public)")
    }
}
