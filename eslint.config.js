// @ts-check
import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import importPlugin from 'eslint-plugin-import';
import eslintConfigPrettier from 'eslint-config-prettier';

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    ignores: ['**/dist/**', '**/coverage/**', '**/node_modules/**', '**/.husky/**', 'infra/**'],
  },
  js.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      import: importPlugin,
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      // TypeScript itself already checks undefined identifiers/globals (incl. JSX,
      // DOM globals via tsconfig `lib`); eslint's no-undef doesn't understand TS
      // ambient types and produces false positives, so it's disabled for TS files
      // per typescript-eslint's own recommendation.
      'no-undef': 'off',
      'import/no-default-export': 'error',
      'import/no-cycle': 'error',
      'import/order': [
        'warn',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
          'newlines-between': 'always',
        },
      ],
      'no-console': 'warn',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
    },
  },
  {
    files: ['apps/server/**/*.ts'],
    rules: {
      'no-console': 'error',
    },
  },
  {
    files: ['**/vite.config.ts', '**/*.config.ts', '**/*.config.js'],
    rules: {
      'import/no-default-export': 'off',
    },
  },
  eslintConfigPrettier,
];
