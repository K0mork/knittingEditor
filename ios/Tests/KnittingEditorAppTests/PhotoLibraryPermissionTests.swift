import XCTest

/// PNGの共有シートで写真への追加だけを許可する設定を確かめる（#208）。
final class PhotoLibraryPermissionTests: XCTestCase {
    func testPhotoLibraryAdditionHasTheApprovedPurposeString() throws {
        let info = try XCTUnwrap(Bundle.main.infoDictionary)
        XCTAssertEqual(
            info["NSPhotoLibraryAddUsageDescription"] as? String,
            "編み図の画像を写真に保存するために使います。"
        )
    }

    func testPhotoLibraryReadAccessIsNotRequested() throws {
        let info = try XCTUnwrap(Bundle.main.infoDictionary)
        XCTAssertNil(info["NSPhotoLibraryUsageDescription"])
    }
}
