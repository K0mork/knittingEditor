import { createHash } from 'node:crypto';
import { defineConfig, devices } from '@playwright/test';

/**
 * previewサーバーのポート。worktreeごとに作業場所のパスから決め、並行するセッションの
 * サーバーと重ならないようにする。`PLAYWRIGHT_PORT`で上書きできる。
 */
function previewPort(): number {
  const fromEnv = Number(process.env.PLAYWRIGHT_PORT);
  if (Number.isInteger(fromEnv) && fromEnv > 0) return fromEnv;
  const digest = createHash('sha256').update(import.meta.dirname).digest();
  return 4173 + (digest.readUInt16BE(0) % 1000);
}

const port = previewPort();
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  timeout: 45_000,
  reporter: 'list',
  use: { baseURL, trace: 'retain-on-failure' },
  webServer: {
    command: `npm run build && npm run preview -- --host 127.0.0.1 --port ${port} --strictPort`,
    url: baseURL,
    // 既存のサーバーは再利用しない。別のworktreeや古いビルドのサーバーに対してテストが
    // 通ってしまうため。ポートが使われていれば、Playwrightはテストを始めずに失敗する。
    reuseExistingServer: false,
    timeout: 120_000,
  },
  /*
   * 端末・画面幅・ブラウザに依存するE2Eは、その状況が実在するプロジェクトだけで実行する。
   * 複数の画面幅を1つのテストで扱うものや、どのプロジェクトでも確かめるもの（データ保護など）はタグを付けない。
   * `@phone`: テスト自身がスマホの幅（縦向き430px以下、横向き844×390など）にする。
   * `@wide`: テスト自身がタブレットかPCの幅（760px以上、スマホ横向きを除く）にする。
   * `@webkit-only`: WebKitでしか存在しない状況（iOS版のCSS、iOSの折り返し配置、iPhoneのUser-Agent）。
   * `@not-webkit`: Web版でルートの文字を拡大する状況（SafariはWebページのルート文字を端末設定で拡大しない）。
   * `@static`: 配信されたHTML・テキスト・ファイル・リンク・メタデータと、ブラウザに依存しない確認だけを行う（要素の大きさの測定を含む）。
   * `@engine`: 端末ごとではなくブラウザエンジンごとに1回だけ確かめる。
   */
  projects: [
    // `@wide`はスマホになく、`@webkit-only`・`@static`・`@engine`はChromium mobileにない状況。
    { name: 'chromium-mobile', use: { ...devices['Pixel 7'] }, grepInvert: /@wide|@webkit-only|@static|@engine/ },
    // `@static`は配信内容だけで、`@not-webkit`はSafariにない文字拡大の状況。
    { name: 'webkit-mobile', use: { ...devices['iPhone 14'] }, grepInvert: /@static|@not-webkit/ },
    // `@phone`はPCになく、`@webkit-only`はChromiumにない状況。
    { name: 'chromium-desktop', use: { ...devices['Desktop Chrome'] }, grepInvert: /@phone|@webkit-only/ },
  ],
});
