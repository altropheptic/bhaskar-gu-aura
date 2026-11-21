/**
 * Lint rules: ESLint's recommended set plus a few that catch real bugs in a
 * vanilla-JS codebase (unused code, loose equality, accidental globals).
 */
import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['dist/**', 'node_modules/**', 'supabase/**', '.vercel/**'] },
  js.configs.recommended,
  {
    files: ['js/**/*.js', 'public/**/*.js'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: { ...globals.browser } },
  },
  {
    files: ['public/sw.js'],
    languageOptions: { sourceType: 'script', globals: { ...globals.serviceworker } },
  },
  {
    files: ['api/**/*.js', 'tests/**/*.js', '*.config.js'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: { ...globals.node } },
  },
  {
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrors: 'none' }],
      eqeqeq: ['error', 'always'],
      'no-implicit-globals': 'error',
      'prefer-const': 'error',
      'no-var': 'error',
      'no-control-regex': 'off', // medSchema strips control characters on purpose
    },
  },
];
