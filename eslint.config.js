// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import importPlugin from 'eslint-plugin-import';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import eslintConfigPrettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/coverage/**', '**/node_modules/**', '**/.husky/**', 'infra/**'],
  },
  js.configs.recommended,
  {
    // Type-checked linting (incl. no-floating-promises, no-misused-promises) per
    // spec/conventions. Scoped to .ts/.tsx only: `projectService: true` resolves
    // each file's nearest tsconfig.json automatically (apps/web, apps/server,
    // packages/shared each declare their own, all extending tsconfig.base.json),
    // so plain root .js config files (this file, commitlint.config.js) are
    // untouched and need no separate tsconfig membership or disable-type-checked
    // override.
    files: ['**/*.{ts,tsx}'],
    extends: [...tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      import: importPlugin,
    },
    rules: {
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
    // React 19 + Vite per spec/conventions: eslint-plugin-react + react-hooks,
    // scoped to apps/web only.
    files: ['apps/web/**/*.{ts,tsx}'],
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
    },
    rules: {
      ...reactPlugin.configs.flat.recommended.rules,
      ...reactHooksPlugin.configs['recommended-latest'].rules,
      // React 19's automatic JSX transform means React never needs to be in
      // scope, and props are typed with TS interfaces, not PropTypes.
      'react/react-in-jsx-scope': 'off',
      'react/jsx-uses-react': 'off',
      'react/prop-types': 'off',
    },
    settings: {
      react: { version: 'detect' },
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
);
