// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { checkPrSmokeUiTests, swiftTestMethods, validateSmokeList } from './check-pr-smoke-ui-tests.mjs';

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

describe('PR smoke UI test list', () => {
  it('discovers methods by class, including async/throwing tests, but not comments/literals/helpers', () => {
    expect([...swiftTestMethods(source)]).toEqual(['First/testOne', 'First/testAsync', 'Second/testOther']);
  });

  it('allows header comments and CRLF', () => {
    expect(validateSmokeList('# header\r\n\r\nFirst/testOne\r\n', swiftTestMethods(source)))
      .toEqual(['First/testOne']);
  });

  it.each(['First/testRenamed', 'WrongClass/testOne', 'First/testRemoved', 'First/testLiteral'])
  ('rejects stale or nonexistent method %s', (entry) => {
    expect(() => validateSmokeList(entry, swiftTestMethods(source))).toThrow('Unknown');
  });

  it.each(['First', 'First/testOne()', 'First/*', 'knittingEditorUITests/First/testOne', ' First/testOne '])
  ('rejects malformed selection %s', (entry) => {
    expect(() => validateSmokeList(entry, swiftTestMethods(source))).toThrow('Invalid');
  });

  it('rejects duplicate lists', () => {
    expect(() => validateSmokeList('First/testOne\nFirst/testOne', swiftTestMethods(source))).toThrow('Duplicate');

  });

  it.each(['', '# no selections\n'])('rejects an empty list %s', (list) => {
    expect(() => validateSmokeList(list, swiftTestMethods(source))).toThrow('Empty');
  });

  it('does not require new UI tests to be listed', () => {
    expect(validateSmokeList('First/testOne', swiftTestMethods(source + '\nclass NewTests: XCTestCase { func testNewLayout() {} }'))).toEqual(['First/testOne']);
  });

  it('validates the actual repository list', () => {
    expect(checkPrSmokeUiTests().length).toBeGreaterThan(0);
  });
});
