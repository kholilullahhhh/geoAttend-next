import coreWebVitals from 'eslint-config-next/core-web-vitals';
import typescript from 'eslint-config-next/typescript';

/**
 * ESLint flat config for the dashboard.
 *
 * eslint-config-next v16 ships flat configs directly, so no FlatCompat shim is
 * needed (and none should be added: bridging it reintroduces the circular
 * config structures that Next's own presets deliberately avoid).
 */
const config = [
  ...coreWebVitals,
  ...typescript,
  {
    ignores: ['.next/**', 'node_modules/**', 'next-env.d.ts'],
  },
  {
    rules: {
      // Leading-underscore names are the conventional "intentionally unused"
      // marker, and are allowed rather than reported.
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
 ];

export default config;