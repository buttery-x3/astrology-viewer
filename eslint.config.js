import js from '@eslint/js';
import ts from 'typescript-eslint';
import svelte from 'eslint-plugin-svelte';

export default [
  { ignores:['node_modules/**','dist/**','.tools/**','.cache/**','vendor/**','src/lib/astronomy/generated/**','docs/**','public/**','test-results/**','playwright-report/**'] },
  js.configs.recommended,
  ...ts.configs.recommended,
  ...svelte.configs['flat/recommended'],
  {
    languageOptions:{globals:{console:'readonly',process:'readonly',Buffer:'readonly',setTimeout:'readonly',clearTimeout:'readonly',performance:'readonly',fetch:'readonly',crypto:'readonly',URL:'readonly',TextEncoder:'readonly',window:'readonly',document:'readonly',navigator:'readonly'}},
    rules:{'@typescript-eslint/no-unused-vars':['error',{argsIgnorePattern:'^_',varsIgnorePattern:'^_'}]},
  },
  { files:['**/*.ts','**/*.svelte'],rules:{'no-undef':'off'} },
  { files:['scripts/**','tests/**'],rules:{'@typescript-eslint/no-explicit-any':'off'} },
  { files:['**/*.svelte'],languageOptions:{parserOptions:{parser:ts.parser}},rules:{'svelte/no-at-html-tags':'error'} },
];
