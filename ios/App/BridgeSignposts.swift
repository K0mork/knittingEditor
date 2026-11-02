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

    /// signpostの区間と開始時刻。所要時間はDEBUGの計測ファイル（`BridgeIntervalLog`）だけが使う。
    struct Interval {
        fileprivate let state: OSSignpostIntervalState
        fileprivate let start: ContinuousClock.Instant
    }

    static func begin(_ name: StaticString) -> Interval {
        Interval(state: signposter.beginInterval(name, id: signposter.makeSignpostID()), start: .now)
    }

    static func end(_ name: StaticString, _ interval: Interval, bytes: Int, mimeType: String = "application/gzip") {
        signposter.endInterval(name, interval.state, "bytes=\(bytes, privacy: .public) mime=\(mimeType, privacy: .public)")
#if DEBUG
        BridgeIntervalLog.record(
            name: String(describing: name), duration: interval.start.duration(to: .now),
            bytes: bytes, mimeType: mimeType, end: Date()
        )
#endif
    }
}

#if DEBUG
/// 実機計測（`ios/scripts/measure-bridge-io.sh`）用。UIテストの間はXCUITestのsignpostで
/// アプリのsignpostバッファがあふれ、前半の区間がxctraceの記録から落ちるため、所要時間を
/// アプリのコンテナへ1行ずつ書く。`KNITTING_EDITOR_BRIDGE_IO_SIZE`があるときだけ動き、
/// Releaseには含めない。書けなくても何もしない。
enum BridgeIntervalLog {
    static let fileName = "bridge-io-intervals.tsv"

    /// 計測の起動でなければ`nil`。
    private static let destination: URL? = {
        guard ProcessInfo.processInfo.environment["KNITTING_EDITOR_BRIDGE_IO_SIZE"] != nil else { return nil }
        return FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first?
            .appendingPathComponent(fileName, isDirectory: false)
    }()
    private static let queue = DispatchQueue(label: "com.k0mork.knittingEditor.BridgeIntervalLog", qos: .utility)
    /// 前回の起動の行が混ざらないよう、起動後の最初の書き込みの前に一度だけ消す。`queue`の上でだけ評価する。
    private static let removePreviousRun: Void = {
        if let destination { try? FileManager.default.removeItem(at: destination) }
    }()

    /// `名前<TAB>ミリ秒（小数3桁）<TAB>バイト数<TAB>MIME<TAB>終了時刻（ISO 8601、UTC）`。
    static func line(name: String, duration: Duration, bytes: Int, mimeType: String, end: Date) -> String {
        let components = duration.components
        let milliseconds = Double(components.seconds) * 1_000 + Double(components.attoseconds) / 1e15
        let fields = [
            name,
            String(format: "%.3f", locale: Locale(identifier: "en_US_POSIX"), milliseconds),
            String(bytes),
            mimeType,
            Date.ISO8601FormatStyle(includingFractionalSeconds: true).format(end),
        ].map { $0.replacingOccurrences(of: "\t", with: " ").replacingOccurrences(of: "\n", with: " ") }
        return fields.joined(separator: "\t")
    }

    static func record(name: String, duration: Duration, bytes: Int, mimeType: String, end: Date) {
        guard let destination else { return }
        queue.async {
            _ = removePreviousRun
            let data = Data((line(name: name, duration: duration, bytes: bytes, mimeType: mimeType, end: end) + "\n").utf8)
            guard FileManager.default.fileExists(atPath: destination.path) else {
                FileManager.default.createFile(atPath: destination.path, contents: data)
                return
            }
            guard let handle = try? FileHandle(forWritingTo: destination) else { return }
            defer { try? handle.close() }
            _ = try? handle.seekToEnd()
            try? handle.write(contentsOf: data)
        }
    }
}
#endif
