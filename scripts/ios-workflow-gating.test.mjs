// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const ci = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
const full = readFileSync(new URL('../.github/workflows/ios-full.yml', import.meta.url), 'utf8');

// ジョブは行頭のキーで始まり、同じ字下げの次のキーの手前まで続く。中の空白の量には依存しない。
function job(workflow, name) {
  const pattern = new RegExp(`^([ \\t]+)${name}:[ \\t]*\\r?\\n([\\s\\S]*?)(?=^\\1[\\w-]+:|$(?![\\s\\S]))`, 'm');
  return workflow.match(pattern)?.[2] ?? '';
}

// `changes`の分類は、`case "$path" in`の分岐をパターンごとに読む。
function classifyArm(workflow, pattern) {
  const cases = workflow.match(/case "\$path" in\r?\n([\s\S]*?)^[ \t]*esac/m)?.[1] ?? '';
  for (const arm of cases.matchAll(/^[ \t]+([^\r\n()]+)\)[ \t]*\r?\n([\s\S]*?)^[ \t]+;;/gm)) {
    if (arm[1].split('|').map((entry) => entry.trim()).includes(pattern)) return arm[2];
  }
  return '';
}

describe('ci.yml iOS Simulator gating', () => {
  const changes = job(ci, 'changes');
  const ios = job(ci, 'ios');

  it('publishes ios_native from the change detection job', () => {
    expect(changes).toMatch(/^ {4}outputs:[ \t]*$/m);
    expect(changes).toMatch(/^ {6}ios_native:[ \t]*\$\{\{[ \t]*steps\.detect\.outputs\.ios_native[ \t]*\}\}[ \t]*$/m);
  });

  it('runs the Simulator job only when ios_native is true', () => {
    expect(ios).toMatch(/^ {4}if:[ \t]*needs\.changes\.outputs\.ios_native[ \t]*==[ \t]*'true'[ \t]*$/m);
  });

  it('requires the Simulator for ios/ and workflow changes, but not for shared code', () => {
    expect(classifyArm(changes, 'ios/*')).toContain('ios_native=true');
    expect(classifyArm(changes, '.github/workflows/*')).toContain('ios_native=true');
    const shared = classifyArm(changes, 'packages/*');
    expect(shared).toContain('ios=true');
    expect(shared).not.toContain('ios_native=true');
  });
});

describe('ios-full.yml nightly skip', () => {
  const decide = job(full, 'decide');

  it.each(['ios_full', 'app_update', 'release_archive'])('runs %s only after an approved decide job', (name) => {
    const body = job(full, name);
    expect(body, `ios-full.yml must contain the ${name} job`).not.toBe('');
    expect(body).toMatch(/^ {4}needs:[ \t]*decide[ \t]*$/m);
    expect(body).toMatch(/^ {4}if:[ \t]*needs\.decide\.outputs\.run[ \t]*==[ \t]*'true'[ \t]*$/m);
  });

  it('skips only a nightly run whose commit already passed', () => {
    const guard = decide.indexOf('"$GITHUB_EVENT_NAME" != schedule');
    expect(guard, 'decide must special-case the nightly schedule').toBeGreaterThan(-1);
    expect(decide.slice(0, guard)).not.toContain('run=false');
    const schedule = decide.slice(guard);
    expect(schedule).toMatch(/\]\]; then\r?\n[ \t]+echo "run=true" >> "\$GITHUB_OUTPUT"\r?\n[ \t]+exit 0/);
    expect(schedule).toContain('head_sha=$GITHUB_SHA');
    expect(schedule).toContain('status=success');
    expect(schedule).toContain('run=false');
  });
});
