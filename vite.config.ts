import { defineConfig } from 'vitest/config';

// BASE_PATH: 하위 경로 배포용 (GitHub Pages는 /goblin-crew/, PR 프리뷰는 그 아래 경로).
// 비어 있으면 '/'. 런타임 에셋 경로는 engine/assets.ts의 assetUrl()로만 만든다.
function normalizeBase(raw: string | undefined): string {
  if (!raw) return '/';
  const withLead = raw.startsWith('/') ? raw : `/${raw}`;
  return withLead.endsWith('/') ? withLead : `${withLead}/`;
}

export default defineConfig({
  base: normalizeBase(process.env.BASE_PATH),
  build: {
    target: 'es2022',
    sourcemap: true,
  },
  test: {
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts', 'scripts/**/*.test.ts'],
    environment: 'node',
  },
});
