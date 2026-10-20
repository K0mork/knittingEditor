import UIKit
@preconcurrency import WebKit

/// frameはWebView座標で、UIKitが付けた操作用の余白をすでに含む。
struct FoldRegion: Equatable {
    struct Region {
        let frame: CGRect
        let isActive: Bool
    }

    let axis: String
    let start: Double
    let end: Double

    nonisolated static func select(_ regions: [Region]) -> FoldRegion? {
        guard let frame = regions.first(where: {
            $0.isActive && !$0.frame.isNull && !$0.frame.isInfinite &&
                $0.frame.minX.isFinite && $0.frame.minY.isFinite &&
                $0.frame.width.isFinite && $0.frame.height.isFinite &&
                $0.frame.width > 0 && $0.frame.height > 0
        })?.frame else { return nil }
        let vertical = frame.height >= frame.width
        return FoldRegion(
            axis: vertical ? "vertical" : "horizontal",
            start: Double(vertical ? frame.minX : frame.minY),
            end: Double(vertical ? frame.maxX : frame.maxY)
        )
    }

    nonisolated static func script(_ region: FoldRegion?) -> String {
        let detail = region.map { "{axis:'\($0.axis)',start:\($0.start),end:\($0.end)}" } ?? "null"
        return "window.dispatchEvent(new CustomEvent('knittingEditorNativeFoldChanged',{detail:\(detail)}));"
    }
}

/// WKWebView自身で読むので、SwiftUIのセーフエリア座標からの変換は不要。
@MainActor
final class FoldAwareWebView: WKWebView {
    private var lastFold: FoldRegion?
    private var hasSentFold = false
    private var foldTimer: Timer?
    private var editorReady = false

    override func layoutSubviews() {
        super.layoutSubviews()
        sendFoldIfChanged()
    }

    override func didMoveToWindow() {
        super.didMoveToWindow()
        foldTimer?.invalidate()
        foldTimer = nil
        // 折り姿勢だけが変わるとboundsもtraitも変わらない場合がある。
        // iPhone Duo Simulator（Xcode 27.1 / iOS 27.1）で折り目移動時にlayoutSubviewsが呼ばれず、0.25秒の監視が必要と確認済み。
        // 表示中だけ補助的に監視し、同じ値はWebへ送らない。
        if #available(iOS 27.1, *), window != nil {
            foldTimer = Timer.scheduledTimer(withTimeInterval: 0.25, repeats: true) { [weak self] _ in
                MainActor.assumeIsolated { self?.sendFoldIfChanged() }
            }
        }
    }

    func foldPageDidStartNavigation() {
        editorReady = false
        hasSentFold = false
    }

    func foldEditorDidBecomeReady() {
        editorReady = true
        hasSentFold = false
        sendFoldIfChanged()
    }

    private func sendFoldIfChanged() {
        guard editorReady else { return }
        var fold: FoldRegion?
        // 古いSDKのCIでもビルドできるよう、新APIを持つコンパイラだけで参照する。
        #if compiler(>=6.4)
        if #available(iOS 27.1, *) {
            fold = FoldRegion.select(reservedRegions(kind: .division, options: .includeInactive).map {
                FoldRegion.Region(frame: $0.frame, isActive: $0.isActive)
            })
        }
        #endif
        guard !hasSentFold || fold != lastFold else { return }
        lastFold = fold
        hasSentFold = true
        evaluateJavaScript(FoldRegion.script(fold), completionHandler: nil)
    }
}
