import js from '@eslint/js';
import tseslint from 'typescript-eslint';

const modules = ['viewer', 'data', 'drawing', 'ui'];

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      '.wrangler/**',
      'node_modules/**',
      'public/vendor/**',
      '.venv/**',
      'data-cache/**',
      'playwright-report/**',
      'test-results/**',
      'tmp/**',
      'output/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...modules.map((module) => ({
    files: [`src/${module}/**/*.{ts,tsx}`],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: modules
            .filter((other) => other !== module)
            .map((other) => ({
              group: [`**/${other}`, `**/${other}/**`],
              message: 'Usa contratos de shared; App.tsx conecta los módulos.',
            })),
        },
      ],
    },
  })),
  {
    files: ['src/shared/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: modules.flatMap((module) => [`**/${module}`, `**/${module}/**`]) },
      ],
    },
  },
);
