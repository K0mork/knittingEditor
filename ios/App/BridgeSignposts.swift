import Foundation
import os

/// Instrumentsのos_signpostで見る固定区間名。カテゴリがPointsOfInterestではないため、Points of Interestには出ない。値はバイト数と許可済みMIMEだけを公開する。
enum BridgeSignposts {
    static let exportDecode: StaticString = "BridgeExportDecode"
    static let exportWrite: StaticString = "BridgeExportWrite"
    static let backupRead: StaticString = "BridgeBackupRead"
    static let backupEncode: StaticString = "BridgeBackupEncode"
    static let backupJavaScript: StaticString = "BridgeBackupJavaScript"
    private static let signposter = OSSignposter(
        subsystem: Bundle.main.bundleIdentifier ?? "knittingEditor", category: "NativeBridge"
    )

    static func begin(_ name: StaticString) -> OSSignpostIntervalState {
        signposter.beginInterval(name, id: signposter.makeSignpostID())
    }

    static func end(_ name: StaticString, _ state: OSSignpostIntervalState, bytes: Int, mimeType: String = "application/gzip") {
        signposter.endInterval(name, state, "bytes=\(bytes, privacy: .public) mime=\(mimeType, privacy: .public)")
    }
}
