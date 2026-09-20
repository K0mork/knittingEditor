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
        guard !components.isEmpty,
              components.allSatisfy({ $0 != "." && $0 != ".." }) else { return nil }

        let relativePath = components.joined(separator: "/")
        let resourceURL = bundle.url(forResource: relativePath, withExtension: nil, subdirectory: "Web")
            ?? bundle.url(forResource: relativePath, withExtension: nil)
        guard let resourceURL else { return nil }

        let standardizedResource = resourceURL.standardizedFileURL
        let standardizedRoot = (bundle.url(forResource: "Web", withExtension: nil) ?? bundle.bundleURL)
            .standardizedFileURL
        guard standardizedResource.path.hasPrefix(standardizedRoot.path + "/") else { return nil }
        return standardizedResource
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
