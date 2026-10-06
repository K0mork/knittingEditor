import SwiftUI
import UIKit
@preconcurrency import WebKit

/// メニューバーとキーボードショートカットから実行する編集画面の操作。
///
/// `rawValue`はWeb側の`ios/Web/src/nativeBridge.ts`の`NATIVE_COMMANDS`と一致させる。
/// 操作の中身はWeb側の画面のボタンと同じ処理で、ネイティブは呼び出すだけにする。
enum EditorCommand: String, CaseIterable, Sendable {
    case newDocument
    case restoreBackup
    case exportBackup
    case exportAllBackup
    case exportPng
    case exportPdf
    case undo
    case redo
    case openGuide

    static let eventName = "knittingEditorNativeCommand"

    /// Web側へ操作を届けるスクリプト。`rawValue`は英字だけなので、そのまま文字列へ埋め込める。
    var dispatchScript: String {
        "window.dispatchEvent(new CustomEvent('\(Self.eventName)',{detail:'\(rawValue)'}));"
    }
}

/// Web側の編集履歴の状態。メニューの「元に戻す」「やり直す」を画面のボタンと同じ条件で選べるようにする。
struct EditorCommandState: Equatable, Sendable {
    var canUndo = false
    var canRedo = false
}

extension WebViewModel {
    /// 編集画面が動いているときだけ操作を受け付ける。使い方ページと読み込み中、
    /// 保存画面・共有シート・Document Pickerを出している間は選べない。
    func canPerform(_ command: EditorCommand) -> Bool {
        Self.canPerform(
            command,
            webContentReady: webContentReady,
            presentingNativeUI: isPresentingNativeUI,
            state: editorCommandState
        )
    }

    nonisolated static func canPerform(
        _ command: EditorCommand,
        webContentReady: Bool,
        presentingNativeUI: Bool = false,
        state: EditorCommandState
    ) -> Bool {
        // 保存先の選択や共有シートを出している間に、Web側で次の出力やダイアログを始めない。
        guard webContentReady, !presentingNativeUI else { return false }
        switch command {
        case .undo: return state.canUndo
        case .redo: return state.canRedo
        default: return true
        }
    }

    func perform(_ command: EditorCommand) {
        guard canPerform(command), let webView else { return }
        // 表示中の画面を`isPresentingNativeUI`で数え漏らしたときの備え。
        guard webView.window?.rootViewController?.presentedViewController == nil else { return }
        webView.evaluateJavaScript(command.dispatchScript, completionHandler: nil)
    }
}

/// iPadのメニューバーと、⌘キーの長押しで出るショートカットの一覧に載せる項目。
///
/// キーの割り当ては、iPadOSの慣習（⌘N・⌘O・⌘S・⌘Z・⇧⌘Z）と、Web版のキー操作（⌘Z・⇧⌘Z）に合わせる。
/// 使い方は慣習の⌘?にすると、メニューに載ってもiPadのSimulatorで押したときに呼ばれなかった
/// （⇧⌘/も同じ。原因は確かめていない）。押して動くことを確かめた⇧⌘H（Help）にする。
struct EditorCommands: Commands {
    let model: WebViewModel

    var body: some Commands {
        CommandGroup(replacing: .newItem) {
            item("新しい編み図…", .newDocument, "n")
            item("バックアップから復元…", .restoreBackup, "o")
        }
        CommandGroup(replacing: .saveItem) {
            item("この編み図をバックアップ…", .exportBackup, "s")
            item("全データをバックアップ…", .exportAllBackup, "s", modifiers: [.command, .option])
        }
        CommandGroup(replacing: .importExport) {
            item("PNGで書き出す…", .exportPng, "e", modifiers: [.command, .shift])
            item("PDFで書き出す…", .exportPdf, "p")
        }
        // 標準の「取り消す」はUIKitの取り消し管理へ送られ、Web側の編集履歴には届かない。
        // 入力欄の文字の取り消しも、Web側が入力中は選べる状態にして、ここから`execCommand`で行う。
        CommandGroup(replacing: .undoRedo) {
            item("元に戻す", .undo, "z")
            item("やり直す", .redo, "z", modifiers: [.command, .shift])
        }
        CommandGroup(replacing: .help) {
            item("棒針編み図の使い方", .openGuide, "h", modifiers: [.command, .shift])
        }
    }

    private func item(
        _ title: String,
        _ command: EditorCommand,
        _ key: KeyEquivalent,
        modifiers: EventModifiers = .command
    ) -> some View {
        Button(title) { model.perform(command) }
            .keyboardShortcut(key, modifiers: modifiers)
            .disabled(!model.canPerform(command))
    }
}
