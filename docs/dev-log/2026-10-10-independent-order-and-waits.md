# 2026-10-10 — テストの実行順依存と自動保存の固定待機を解消

- 影響: テストのみ。#195（Closes #195）の対象2ファイルは各ケースの前に全ストアを空にし、旧形式の編み図fixtureも毎回作り直す。製品の動作・保存形式は変えない。
- 主なファイル: `packages/editor-core/ui/EditorView.test.tsx`、`packages/editor-core/storage/lastBackup.test.ts`、`tests/e2e/editor.spec.ts`。
- テスト: バックアップ日時の除外テストが自身で日時を記録する。E2Eの自動保存の固定待機をIndexedDBの内容の`expect.poll`へ変更し、消去前に描画された記号の保存を確認する。描画復元・消去に通常と1,400msの保存開始遅延ケースを用意する。DBを観測する接続は読み取り後に閉じる。
- 検証: 次のとおり。

- `npm ci`：成功。
- `npm run typecheck`：成功。
- `npm test`：37ファイル、259件成功。
- `npm run build`：成功。
- `npm run check:dist`：成功。
- `npx vitest run --sequence.shuffle --sequence.seed=42`：37ファイル、259件成功。
- `npx vitest run --sequence.shuffle --sequence.seed=7`：37ファイル、259件成功。
- `npx vitest run --sequence.shuffle --sequence.seed=2026`：37ファイル、259件成功。
- `npx vitest run packages/editor-core/ui/EditorView.test.tsx packages/editor-core/storage/lastBackup.test.ts --sequence.shuffle --sequence.seed=42`：17件成功。
- `npx vitest run packages/editor-core/ui/EditorView.test.tsx`：12件成功。
- `npx vitest run packages/editor-core/storage/lastBackup.test.ts`：5件成功。
- `(cd ios/Web && ../../node_modules/.bin/tsc -p tsconfig.app.json --noEmit)`：成功。
- `(cd ios/Web && ../../node_modules/.bin/vitest run --config vite.config.ts)`：8ファイル、34件成功。
- `npx playwright test tests/e2e/editor.spec.ts --list`：81ケースの読み込み成功。ブラウザーでの実行ではない。
- `git diff --check`：成功。

PATHのNodeはv26.8.1だったため、必須確認とVitestの単独・シャッフル確認、iOS Web確認はNode v24.21.0で再実行しました。上記コマンドを `npm exec --cache /private/tmp/g19-npm-cache --package=node@24 -- sh -c '<確認コマンドを && で接続>'` のシェル内で実行し、終了コード0を確認しました。`npm ci`とPlaywrightの一覧確認はPATHのNodeで実行しました。

補助確認として `npx tsc --noEmit --target es2022 --module esnext --moduleResolution bundler --lib es2022,dom --skipLibCheck tests/e2e/editor.spec.ts` を試しましたが、TypeScript 7のTS5112で失敗しました。`--ignoreConfig`を加えた同じコマンドは、既存の`node:fs`と`Buffer`に対するNode型定義の不足（TS2591）で失敗しました。依存関係や設定は今回の範囲外なので変更していません。必須の型検査は成功しています。

- 未実行: ブラウザーとSimulatorを起動できない環境のため、Chromium/WebKitのE2E（通常・遅延保存）、保存停止時の消去テストの負例は別環境で確認する。iOSのビルド・Simulator全体、更新復元、Archive、オフライン同梱物検査はPR CIに任せる。
- デプロイ影響: none。テストのみの変更で、配信後の追加確認は不要。
