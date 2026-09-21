import Foundation
import WebKit

final class LocalWebSchemeHandler: NSObject, WKURLSchemeHandler {
    static let scheme = "knitting-local"
    static let indexURL = URL(string: "\(scheme)://bundle/index.html")!

    private let bundle: Bundle

    init(bundle: Bundle) {
        self.bundle = bundle
    }

    func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
        guard let requestURL = urlSchemeTask.request.url,
              let resourceURL = Self.resourceURL(for: requestURL, bundle: bundle),
              let data = try? Data(contentsOf: resourceURL) else {
            urlSchemeTask.didFailWithError(URLError(.fileDoesNotExist))
            return
        }

        let response = URLResponse(
            url: requestURL,
            mimeType: Self.mimeType(for: resourceURL.pathExtension),
            expectedContentLength: data.count,
            textEncodingName: Self.textEncoding(for: resourceURL.pathExtension)
        )
        urlSchemeTask.didReceive(response)
        urlSchemeTask.didReceive(data)
        urlSchemeTask.didFinish()
    }

    func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {
        // Assets are read synchronously and cannot be cancelled after delivery starts.
    }

    static func resourceURL(for requestURL: URL, bundle: Bundle) -> URL? {
        guard requestURL.scheme == scheme,
              requestURL.host == "bundle" else { return nil }

        let path = requestURL.path
        let components = path.split(separator: "/", omittingEmptySubsequences: true)
        guard components.allSatisfy({ $0 != "." && $0 != ".." }) else { return nil }

        let relativePath = components.joined(separator: "/")
        let candidates = relativePath.isEmpty || path.hasSuffix("/")
            ? [relativePath.isEmpty ? "index.html" : "\(relativePath)/index.html"]
            : [relativePath, "\(relativePath)/index.html"]

        // 同梱Web資産の外側は配信しない。Webディレクトリを解決できない場合も、
        // アプリバンドル全体へ範囲を広げず何も返さない。
        guard let webRoot = bundle.url(forResource: "Web", withExtension: nil)?.standardizedFileURL else { return nil }

        for candidate in candidates {
            guard let resourceURL = Self.bundleURL(for: candidate, bundle: bundle) else { continue }
            var isDirectory = ObjCBool(false)
            guard FileManager.default.fileExists(atPath: resourceURL.path, isDirectory: &isDirectory), !isDirectory.boolValue else { continue }

            let standardizedResource = resourceURL.standardizedFileURL
            guard standardizedResource.path.hasPrefix(webRoot.path + "/") else { return nil }
            return standardizedResource
        }
        return nil
    }

    private static func bundleURL(for relativePath: String, bundle: Bundle) -> URL? {
        if let webIndex = bundle.url(forResource: "index.html", withExtension: nil, subdirectory: "Web") {
            let candidate = webIndex.deletingLastPathComponent().appendingPathComponent(relativePath)
            if FileManager.default.fileExists(atPath: candidate.path) {
                return candidate
            }
        }
        let path = relativePath as NSString
        let filename = path.lastPathComponent as NSString
        let name = filename.deletingPathExtension
        let ext = filename.pathExtension
        let directory = path.deletingLastPathComponent
        let webDirectory = directory == "." ? "Web" : "Web/\(directory)"
        return bundle.url(
            forResource: name,
            withExtension: ext.isEmpty ? nil : ext,
            subdirectory: webDirectory
        )
    }

    private static func mimeType(for pathExtension: String) -> String {
        switch pathExtension.lowercased() {
        case "html": return "text/html"
        case "js", "mjs": return "text/javascript"
        case "css": return "text/css"
        case "json": return "application/json"
        case "svg": return "image/svg+xml"
        case "png": return "image/png"
        default: return "application/octet-stream"
        }
    }

    private static func textEncoding(for pathExtension: String) -> String? {
        ["html", "js", "mjs", "css", "json"].contains(pathExtension.lowercased()) ? "utf-8" : nil
    }
}
