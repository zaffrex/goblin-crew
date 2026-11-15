import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/', 'coverage/', 'node_modules/'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // ADR-0004 결정 2: core는 엔진/UI/브라우저에 의존하지 않는다.
    // 브라우저 전역(window, document 등)은 tsconfig.core.json(DOM lib 없음)이 막는다.
    files: ['src/core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['**/engine', '**/engine/**', '**/ui', '**/ui/**', '**/main'], message: 'src/core는 engine/ui/main을 import하지 않는다 (ADR-0004).' },
          ],
        },
      ],
    },
  },
);
