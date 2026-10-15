import UIKit
@preconcurrency import WebKit

/// WKWebViewがページへ渡さないトラックパッドのピンチを、盤面の倍率へ渡す。
enum TrackpadZoom {
    nonisolated static func dispatchScript(factor: Double, x: Double, y: Double) -> String? {
        guard factor.isFinite, factor > 0, x.isFinite, y.isFinite else { return nil }
        // Doubleの文字列表現はロケールに依存しない。有限数だけなのでJavaScriptの数値として渡せる。
        return "window.dispatchEvent(new CustomEvent('knittingEditorNativeZoom',{detail:{factor:\(factor),x:\(x),y:\(y)}}));"
    }
}

@MainActor
final class TrackpadZoomHandler: NSObject, UIGestureRecognizerDelegate {
    private weak var model: WebViewModel?
    private weak var webView: WKWebView?
    private var lastScale: CGFloat = 1
    private(set) lazy var recognizer: UIPinchGestureRecognizer = {
        let recognizer = UIPinchGestureRecognizer(target: self, action: #selector(handlePinch(_:)))
        recognizer.delegate = self
        recognizer.cancelsTouchesInView = false
        recognizer.delaysTouchesBegan = false
        recognizer.delaysTouchesEnded = false
        return recognizer
    }()

    init(model: WebViewModel) {
        self.model = model
        super.init()
    }

    func attach(to webView: WKWebView) {
        self.webView = webView
        webView.addGestureRecognizer(recognizer)
    }

    func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer, shouldReceive event: UIEvent) -> Bool {
        event.type == .transform
    }

    func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer, shouldRecognizeSimultaneouslyWith otherGestureRecognizer: UIGestureRecognizer) -> Bool {
        true
    }

    @objc private func handlePinch(_ recognizer: UIPinchGestureRecognizer) {
        if recognizer.state == .began { lastScale = 1; return }
        guard recognizer.state == .changed else { return }
        let scale = recognizer.scale
        guard scale.isFinite, scale > 0 else { return }
        let factor = scale / lastScale
        lastScale = scale
        guard model?.canPerform(.zoomIn) == true, let webView,
              webView.window?.rootViewController?.presentedViewController == nil else { return }
        let position = recognizer.location(in: webView)
        guard let script = TrackpadZoom.dispatchScript(factor: Double(factor), x: Double(position.x), y: Double(position.y)) else { return }
        webView.evaluateJavaScript(script, completionHandler: nil)
    }
}
