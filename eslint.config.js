import eslint from '@eslint/js';

export default [
  {
    ignores: ['node_modules/**', 'coverage/**'],
  },
  eslint.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        Buffer: 'readonly',
        process: 'readonly',
      },
    },
  },
];
