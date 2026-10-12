// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { checkIpadUiTests, swiftTestMethods, validateSkiplist } from './check-ipad-ui-tests.mjs';

const source = `
final class First: XCTestCase {
  func testOne() { if true { print("}") } }
  func testAsync() async throws {}
  // func testRemoved() {}
  /* func testCommented() {} */
  let diagnostic = "func testLiteral() {}"
  func helper() {}
}
final class Second: XCTestCase { func testOther() throws {} }
enum SystemSheet { static func testHelper() {} }
`;

describe('iPad UI test skip list', () => {
  it('discovers methods by class, including async/throwing tests, but not comments/literals/helpers', () => {
    expect([...swiftTestMethods(source)]).toEqual(['First/testOne', 'First/testAsync', 'Second/testOther']);
  });

  it('allows header comments and CRLF', () => {
    expect(validateSkiplist('# header\r\n\r\nFirst/testOne\r\n', swiftTestMethods(source)))
      .toEqual(['First/testOne']);
  });

  it.each(['First/testRenamed', 'WrongClass/testOne', 'First/testRemoved', 'First/testLiteral'])
  ('rejects stale or nonexistent method %s', (entry) => {
    expect(() => validateSkiplist(entry, swiftTestMethods(source))).toThrow('Unknown');
  });

  it.each(['First', 'First/testOne()', 'First/*', 'knittingEditorUITests/First/testOne', ' First/testOne '])
  ('rejects malformed selection %s', (entry) => {
    expect(() => validateSkiplist(entry, swiftTestMethods(source))).toThrow('Invalid');
  });

  it('rejects duplicate lists', () => {
    expect(() => validateSkiplist('First/testOne\nFirst/testOne', swiftTestMethods(source))).toThrow('Duplicate');

  });

  it('allows empty and comment-only lists to run the full suite', () => {
    expect(validateSkiplist('', swiftTestMethods(source))).toEqual([]);
    expect(validateSkiplist('# no exclusions\n', swiftTestMethods(source))).toEqual([]);
  });

  it('does not require new UI tests to be listed', () => {
    expect(validateSkiplist('First/testOne', swiftTestMethods(source + '\nclass NewTests: XCTestCase { func testNewLayout() {} }'))).toEqual(['First/testOne']);
  });

  it('validates the actual repository skip list', () => {
    expect(checkIpadUiTests().length).toBeGreaterThan(0);
  });
});
