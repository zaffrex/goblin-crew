// 배포본 합계 3MB 경고선 (ADR-0007 결정 8 "초기 로드 합계", 설계 회의 #1 Sam 안).
// 파일 하나하나의 상한은 이미 다른 테스트가 본다: 캐릭터 시트 합계 300KB(sprites.test.ts), 배경·화면 시트 100KB(scene-build).
// 여기서는 합계만 본다. 그림은 작지만 소리(ADR-0007 결정 10, CC0 음악 한 곡이 1~3MB)가 들어오면 바로 넘을 수 있는 선이다.
//
// 세는 것: 빌드 산출물(JS·CSS·HTML, 소스맵 제외: 플레이어는 받지 않는다) + `public/` 전부(배포 때 그대로 복사된다).
// 화면 시트는 그 화면에 들어갈 때 받지만 전부 더한다. 초기 로드의 상한으로 본다(보수적).
// 넘으면 정상 에셋인지 보고 L1로 올린다(ADR-0007 결정 8). 이 숫자를 몰래 올리지 않는다.

import { describe, expect, it } from 'vitest';
import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { build, type Rollup } from 'vite';

const ROOT = join(import.meta.dirname, '..', '..');
const LOAD_MAX_BYTES = 3 * 1024 * 1024;

function filesUnder(dir: string): { path: string; bytes: number }[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    return e.isDirectory() ? filesUnder(p) : [{ path: relative(ROOT, p), bytes: statSync(p).size }];
  });
}

async function bundleFiles(): Promise<{ path: string; bytes: number }[]> {
  const out = (await build({
    root: ROOT,
    logLevel: 'silent',
    // public/은 아래에서 따로 센다. 디스크에는 안 쓴다.
    build: { write: false, sourcemap: false, copyPublicDir: false },
  })) as Rollup.RollupOutput | Rollup.RollupOutput[];
  return (Array.isArray(out) ? out : [out]).flatMap((o) =>
    o.output.map((f) => ({
      path: `dist/${f.fileName}`,
      bytes: f.type === 'chunk' ? Buffer.byteLength(f.code) : typeof f.source === 'string' ? Buffer.byteLength(f.source) : f.source.byteLength,
    })),
  );
}

const kb = (n: number) => `${(n / 1024).toFixed(1)}KB`;

describe('배포본 합계 (ADR-0007 결정 8)', () => {
  it('빌드 산출물 + public/ 합계가 3MB 경고선 안이다', async () => {
    const files = [...(await bundleFiles()), ...filesUnder(join(ROOT, 'public'))];
    expect(files.some((f) => f.path.endsWith('.js')), 'JS 번들이 세어졌다').toBe(true);
    const total = files.reduce((a, f) => a + f.bytes, 0);
    const top = [...files].sort((a, b) => b.bytes - a.bytes).slice(0, 5).map((f) => `${f.path} ${kb(f.bytes)}`).join(', ');
    expect(total, `합계 ${kb(total)} / 큰 것: ${top}`).toBeLessThanOrEqual(LOAD_MAX_BYTES);
  }, 60_000);
});
