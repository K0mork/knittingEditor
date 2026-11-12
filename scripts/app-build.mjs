import { execFileSync } from 'node:child_process';

// CIのコミットを優先し、履歴のない配布元でもビルドを続ける。
// GA4は数字だけや指数表記に見える値（例: 8e13233）を数値として記録するため、先頭に`g`を付ける。
export function appBuild(sha = process.env.GITHUB_SHA, revision = () => execFileSync('git', ['rev-parse', '--short=7', 'HEAD'], {
  encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
}).trim()) {
  try {
    const shortRevision = (sha?.trim() || revision()).slice(0, 7);
    return shortRevision ? `g${shortRevision}` : 'unknown';
  } catch { return 'unknown'; }
}
