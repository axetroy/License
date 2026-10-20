import eslint from '@eslint/js';

export default [
  {
    ignores: ['node_modules/**', 'coverage/**', 'dist/**', 'docs/public/playground/**'],
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
        crypto: 'readonly',
        globalThis: 'readonly',
        self: 'readonly',
        XPathResult: 'readonly',
        XMLSerializer: 'readonly',
        TextDecoder: 'readonly',
        global: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        document: 'readonly',
        location: 'readonly',
        navigator: 'readonly',
        window: 'readonly',
        DOMParser: 'readonly',
        TextEncoder: 'readonly',
        Uint8Array: 'readonly',
        Uint32Array: 'readonly',
        atob: 'readonly',
        btoa: 'readonly',
        Blob: 'readonly',
        FileReader: 'readonly',
        setTimeout: 'readonly',
      },
    },
  },
];
