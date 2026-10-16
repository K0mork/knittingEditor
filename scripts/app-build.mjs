import { execFileSync } from 'node:child_process';

// CIのコミットを優先し、履歴のない配布元でもビルドを続ける。
export function appBuild(sha = process.env.GITHUB_SHA, revision = () => execFileSync('git', ['rev-parse', '--short=7', 'HEAD'], {
  encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
}).trim()) {
  try { return (sha?.trim() || revision()).slice(0, 7) || 'unknown'; }
  catch { return 'unknown'; }
}
