import Foundation

enum NativeBridgeLimits {
    static let maxFileBytes = 128 * 1024 * 1024
}

enum NativeBridgeMessage: Equatable {
    case exportFile(data: Data, filename: String, mimeType: String)
    case openBackup

    enum MessageError: Error, Equatable {
        case invalidEnvelope
        case unsupportedVersion
        case unsupportedType
        case invalidFile
        case fileTooLarge
    }

    static func decode(body: Any) -> Result<NativeBridgeMessage, MessageError> {
        guard let dictionary = body as? [String: Any],
              let version = dictionary["version"] as? NSNumber,
              version.intValue == 1,
              let type = dictionary["type"] as? String else {
            return .failure(.invalidEnvelope)
        }

        switch type {
        case "openBackup":
            return .success(.openBackup)
        case "exportFile":
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
            return .success(.exportFile(data: data, filename: safeFilename, mimeType: mimeType))
        default:
            return .failure(.unsupportedType)
        }
    }

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
