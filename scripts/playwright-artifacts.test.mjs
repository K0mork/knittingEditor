// @vitest-environment node
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';

const workflow = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
// 隣接ジョブの名前には依存せず、webジョブのインデント範囲だけを読む。
const web = workflow.match(/^  web:\r?\n([\s\S]*?)(?=^  [\w-]+:|$(?![\s\S]))/m)?.[1] ?? '';
const steps = web.split(/(?=^      - )/m);
const e2e = steps.find((step) => step.includes('run: npm run test:e2e'));
const upload = steps.find((step) => step.includes('name: Upload Playwright failure artifacts'));

describe('Playwright failure artifacts', () => {
  beforeAll(() => {
    expect(web, 'ci.yml must contain the web job').not.toBe('');
    expect(e2e, 'web must contain the E2E step').toBeDefined();
    expect(upload, 'web must contain the failure artifact upload step').toBeDefined();
  });
  it('uploads only after the E2E step fails without masking the failure', () => {
    expect(e2e).toContain('id: e2e');
    expect(e2e).not.toContain('continue-on-error');
    expect(web).not.toMatch(/^    continue-on-error:/m);
    expect(upload).toContain("if: failure() && steps.e2e.outcome == 'failure'");
    expect(steps.indexOf(upload)).toBeGreaterThan(steps.indexOf(e2e));
  });

  it('keeps diagnostics separate from Pages with bounded retention and unique attempts', () => {
    expect(upload).toContain('actions/upload-artifact@cf430e030ddbb5b0abf93d22962f4752f3646cd9 # v7');
    expect(upload).toContain('name: playwright-failure-${{ github.run_id }}-${{ github.run_attempt }}');
    expect(upload).toContain('path: test-results/');
    expect(upload).toContain('retention-days: 7');
    expect(upload).toContain('if-no-files-found: warn');
    expect(upload).not.toContain('path: dist');
    expect(web).toContain('uses: actions/upload-pages-artifact@');
  });
});
