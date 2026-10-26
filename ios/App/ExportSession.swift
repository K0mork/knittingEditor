import Foundation
import UniformTypeIdentifiers

/// 保存画面・共有シートへ渡している書き出し。一時ファイルは編み図名で一意なディレクトリに置く。
@MainActor
final class ExportSession {
    let url: URL
    let directory: URL
    let mimeType: String
    /// Webが結果を待っている要求のID。別の文書へ移ったら、返す先が無いので`nil`にする。
    var requestID: String?
    private var isFinished = false

    init(data: Data, filename: String, mimeType: String, requestID: String?) throws {
        // 保存画面には一時ファイルの名前がそのまま出る。UUIDを名前にすると
        // 利用者に意味のない名前を提案してしまうため、編み図名のファイル名を
        // 一意なディレクトリの中へ置く。
        let directory = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString, isDirectory: true)
        let temporaryURL = Self.exportFileURL(in: directory, filename: filename, mimeType: mimeType)
        do {
            try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
            try data.write(to: temporaryURL, options: [.atomic])
        } catch {
            try? FileManager.default.removeItem(at: directory)
            throw error
        }
        self.url = temporaryURL
        self.directory = directory
        self.mimeType = mimeType
        self.requestID = requestID
    }

    /// 通知より先に終了を確定し、delegateの重複や通知中の再入でも後処理を一度に限る。
    func finish(
        saved: Bool,
        status: NativeExportResult.Status?,
        failureNotice: NativeExportResult.FailureNotice?,
        report: (String, Bool, NativeExportResult.Status?, NativeExportResult.FailureNotice?) -> Void,
        reportFailure: (NativeExportResult.FailureNotice?) -> Void,
        didSave: (String) -> Void
    ) {
        guard !isFinished else { return }
        isFinished = true
        try? FileManager.default.removeItem(at: directory)
        if let requestID = requestID {
            report(requestID, saved, status, failureNotice)
        } else if status == .error {
            reportFailure(failureNotice)
        }
        // 書き出しを保存・共有し終えた作業の区切りで、App Storeの評価の依頼を検討する（#84）。
        if saved {
            didSave(mimeType)
        }
    }

    /// 保存画面へ提案するファイル名を組み立てる。
    ///
    /// `filename`は`NativeBridgeMessage`が区切り文字と制御文字を拒否済みなので、
    /// そのままパス要素として使える。拡張子が無い場合だけMIME種別から補う。
    nonisolated static func exportFileURL(in directory: URL, filename: String, mimeType: String) -> URL {
        let url = directory.appendingPathComponent(filename)
        guard url.pathExtension.isEmpty else { return url }
        let fallback = UTType(mimeType: mimeType)?.preferredFilenameExtension ?? "dat"
        return url.appendingPathExtension(fallback)
    }
}
