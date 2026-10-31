// @ts-check
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import eslintPluginSecurity from 'eslint-plugin-security';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['eslint.config.mjs'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginSecurity.configs.recommended,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: 'commonjs',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      // Una promesa sin esperar es un error que nadie ve: en cero, por eso error.
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      'prettier/prettier': ['error', { endOfLine: 'auto' }],
    },
  },
  {
    // Clean code estricto en el código de producción (los specs quedan
    // fuera: sus describe son largos por naturaleza). Van como `warn`
    // porque hay deuda medida (ver CLAUDE.md, "Convenciones de nomenclatura y estilo"): el
    // objetivo es que el conteo solo baje, y cada regla pasa a `error` cuando
    // llegue a cero. Conteo al 2026-10-31 en CLAUDE.md.
    files: ['src/**/*.ts'],
    ignores: ['src/**/*.spec.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      'max-lines': ['warn', { max: 400, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': ['warn', { max: 50, skipBlankLines: true, skipComments: true }],
      complexity: ['warn', 10],
      'max-params': ['warn', 4],
      'max-depth': ['warn', 3],
      // Un número suelto en la lógica es una regla de negocio escondida:
      // va a una constante con nombre (0, 1, -1 y 100 no cuentan).
      'no-magic-numbers': [
        'warn',
        {
          ignore: [0, 1, -1, 100],
          ignoreArrayIndexes: true,
          ignoreDefaultValues: true,
          enforceConst: true,
        },
      ],
      // El contrato de cada función a la vista, sin leerla por dentro.
      '@typescript-eslint/explicit-function-return-type': [
        'warn',
        {
          allowExpressions: true,
          allowTypedFunctionExpressions: true,
          allowHigherOrderFunctions: true,
        },
      ],
    },
  },
);
