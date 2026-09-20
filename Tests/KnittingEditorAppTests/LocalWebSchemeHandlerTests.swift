import XCTest
@testable import knittingEditor

@MainActor
final class LocalWebSchemeHandlerTests: XCTestCase {
    func testIndexURLUsesStableLocalOrigin() {
        XCTAssertEqual(LocalWebSchemeHandler.indexURL.absoluteString, "knitting-local://bundle/index.html")
        XCTAssertEqual(LocalWebSchemeHandler.indexURL.scheme, LocalWebSchemeHandler.scheme)
    }

    func testResourceURLRejectsUnexpectedOriginAndTraversal() {
        let bundle = Bundle(for: LocalWebSchemeHandler.self)
        XCTAssertNil(
            LocalWebSchemeHandler.resourceURL(
                for: URL(string: "https://bundle/index.html")!,
                bundle: bundle
            )
        )
        XCTAssertNil(
            LocalWebSchemeHandler.resourceURL(
                for: URL(string: "knitting-local://bundle/../Info.plist")!,
                bundle: bundle
            )
        )
    }

    func testResourceURLFindsBundledWebAsset() {
        let bundle = Bundle(for: LocalWebSchemeHandler.self)
        XCTAssertNotNil(
            LocalWebSchemeHandler.resourceURL(
                for: URL(string: "knitting-local://bundle/index.html")!,
                bundle: bundle
            )
        )
    }
}
