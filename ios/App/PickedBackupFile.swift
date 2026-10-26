import Foundation

/// Document Pickerが渡す複製の読み込みと後処理。
enum PickedBackupFile {
    static func read(at url: URL) throws -> Data {
        try Data(contentsOf: url, options: [.mappedIfSafe])
    }

    /// `asCopy: true`のDocument Pickerはアプリの一時領域へ複製を作る。
    /// 読み込み後に消さないと一時領域へ蓄積するため、一時領域内だけを削除する。
    static func removePickedCopy(at url: URL) {
        let temporary = FileManager.default.temporaryDirectory.standardizedFileURL.resolvingSymlinksInPath()
        let candidate = url.standardizedFileURL.resolvingSymlinksInPath()
        guard candidate.path.hasPrefix(temporary.path + "/") else { return }
        try? FileManager.default.removeItem(at: url)
    }
}
