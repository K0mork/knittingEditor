import Foundation

enum NativeBridgeLimits {
    static let maxFileBytes = 128 * 1024 * 1024
}

enum NativeBridgeMessage: Equatable {
    /// `requestID`はWebが結果を待つ書き出しの識別子（#122）。持たないメッセージも受け付け、結果を返さない。
    case exportFile(data: Data, filename: String, mimeType: String, requestID: String?)
    case openBackup
    case webReady
    case commandState(EditorCommandState)

    enum MessageError: Error, Equatable {
        case invalidEnvelope
        case unsupportedVersion
        case unsupportedType
        case invalidFile
        case fileTooLarge
    }

    static func decode(body: Any) -> Result<NativeBridgeMessage, MessageError> {
        guard let dictionary = body as? [String: Any],
              let version = dictionary["version"] as? NSNumber else {
            return .failure(.invalidEnvelope)
        }
        guard version.intValue == 1 else {
            return .failure(.unsupportedVersion)
        }
        guard let type = dictionary["type"] as? String else {
            return .failure(.invalidEnvelope)
        }

        switch type {
        case "openBackup":
            return .success(.openBackup)
        case "webReady":
            return .success(.webReady)
        case "commandState":
            guard let canUndo = dictionary["canUndo"] as? Bool,
                  let canRedo = dictionary["canRedo"] as? Bool else {
                return .failure(.invalidEnvelope)
            }
            return .success(.commandState(EditorCommandState(canUndo: canUndo, canRedo: canRedo)))
        case "exportFile":
            let requestID = exportRequestID(body: body)
            guard dictionary["id"] == nil || requestID != nil else {
                return .failure(.invalidEnvelope)
            }
            guard let filename = dictionary["filename"] as? String,
                  let mimeType = dictionary["mimeType"] as? String,
                  let encoded = dictionary["dataBase64"] as? String,
                  let data = Data(base64Encoded: encoded, options: []),
                  !data.isEmpty else {
                return .failure(.invalidFile)
            }
            guard data.count <= NativeBridgeLimits.maxFileBytes else {
                return .failure(.fileTooLarge)
            }
            guard let safeFilename = sanitizedFilename(filename),
                  ["image/png", "application/pdf", "application/gzip"].contains(mimeType) else {
                return .failure(.invalidFile)
            }
            return .success(.exportFile(
                data: data,
                filename: safeFilename,
                mimeType: mimeType,
                requestID: requestID
            ))
        default:
            return .failure(.unsupportedType)
        }
    }

    /// `exportFile`の要求IDを取り出す。ファイルの検証に失敗したときも、Webへ結果を返すために使う。
    /// IDはイベントへそのまま載せるので、英数字・`-`・`_`の64文字までに限る。
    static func exportRequestID(body: Any) -> String? {
        guard let dictionary = body as? [String: Any],
              dictionary["type"] as? String == "exportFile",
              let id = dictionary["id"] as? String,
              (1...64).contains(id.count),
              id.unicodeScalars.allSatisfy({ requestIDCharacters.contains($0) }) else {
            return nil
        }
        return id
    }

    private static let requestIDCharacters = CharacterSet(
        charactersIn: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"
    )

    private static func sanitizedFilename(_ filename: String) -> String? {
        let trimmed = filename.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty,
              trimmed.count <= 180,
              !trimmed.contains("/"),
              !trimmed.contains("\\"),
              !trimmed.contains(".."),
              !trimmed.unicodeScalars.contains(where: { CharacterSet.controlCharacters.contains($0) }) else {
            return nil
        }
        return trimmed
    }
}

/// 書き出しを保存・共有し終えたか、取りやめたかをWebへ返すイベント（#122）。
enum NativeExportResult {
    static let eventName = "knittingEditorNativeExportFinished"

    static func script(requestID: String, saved: Bool) -> String? {
        let detail: [String: Any] = ["id": requestID, "saved": saved]
        guard let jsonData = try? JSONSerialization.data(withJSONObject: detail, options: [.sortedKeys]),
              let json = String(data: jsonData, encoding: .utf8) else { return nil }
        return "window.dispatchEvent(new CustomEvent('\(eventName)',{detail:\(json)}));"
    }
}
