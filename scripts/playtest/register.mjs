// `node --import ./scripts/playtest/register.mjs scripts/playtest/replay.ts`
// src/는 Vite 관례대로 확장자 없이 import한다(`./hit`). Node의 타입 제거 실행은 확장자를 붙여 주지 않아서,
// 상대 경로에 `.ts` 파일이 있으면 그걸로 푼다. 의존성 없음(Node 22.15+ `module.registerHooks`). 재생 도구 전용.

import { existsSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { URL, fileURLToPath } from 'node:url';

registerHooks({
  resolve(specifier, context, next) {
    const relative = specifier.startsWith('./') || specifier.startsWith('../');
    if (relative && context.parentURL?.startsWith('file:') && !/\.[a-z]+$/.test(specifier)) {
      const url = new URL(`${specifier}.ts`, context.parentURL);
      if (existsSync(fileURLToPath(url))) return next(url.href, context);
    }
    return next(specifier, context);
  },
});
