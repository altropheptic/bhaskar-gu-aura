/**
 * Test runner config. Logic tests run in Node; files that need a DOM opt in
 * with `// @vitest-environment jsdom`. Coverage covers the browser modules and
 * the /api functions, with minimum thresholds enforced in CI.
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.js'],
    coverage: {
      provider: 'v8',
      include: ['js/**/*.js', 'api/**/*.js'],
      exclude: ['js/types.js'],
      reporter: ['text-summary', 'text', 'html'],
      reportsDirectory: 'coverage',
      // CI fails if coverage drops below these (current: ~81% lines, 74% statements).
      thresholds: { lines: 78, statements: 70, functions: 65, branches: 62 },
    },
  },
});
