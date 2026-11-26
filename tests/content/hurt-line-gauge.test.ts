import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// #935 묶음 2-2: 게이지가 안 주는 실패에 아픈 소리(いてっ 등)가 붙으면
// 「痛い目にあうたび1マス減るよ」(`ui.card.gauge`) 안내와 어긋나 "아픈 건지 아닌지" 헷갈린다(Mia, Theo 대조).
// 규칙: 아픈 소리 줄은 `do.gauge`가 음수인 규칙 안에서만 쓴다(`docs/design/ja-text.md` 3절 ノビー 감탄사 칸).
const dir = (rel: string): string => fileURLToPath(new URL(rel, import.meta.url));
const texts = JSON.parse(readFileSync(dir('../../content/text/ja.json'), 'utf8')) as Record<string, string>;
const PAIN = /いてっ|いてて|痛い|痛っ/u;

type Use = { file: string; key: string; hurt: boolean };

function sayKeys(say: unknown): string[] {
  if (!Array.isArray(say)) return [];
  const k = say[1];
  return typeof k === 'string' ? [k] : Array.isArray(k) ? k.filter((x): x is string => typeof x === 'string') : [];
}

function collect(node: unknown, file: string, hurt: boolean, out: Use[]): void {
  if (Array.isArray(node)) {
    for (const n of node) collect(n, file, hurt, out);
    return;
  }
  if (node === null || typeof node !== 'object') return;
  const o = node as Record<string, unknown>;
  const d = o['do'];
  const here =
    hurt || (d !== null && typeof d === 'object' && typeof (d as Record<string, unknown>)['gauge'] === 'number' && ((d as Record<string, number>)['gauge'] as number) < 0);
  for (const key of sayKeys(o['say'])) out.push({ file, key, hurt: here });
  for (const v of Object.values(o)) collect(v, file, here, out);
}

/** 화자 변형(`<키>.jjuk` 등)까지 포함한 그 키의 글 전부. */
const variants = (key: string): string[] =>
  Object.keys(texts).filter((k) => k === key || k.startsWith(`${key}.`));

const files = [
  ...readdirSync(dir('../../content/screens'))
    .filter((f) => f.endsWith('.json') && f !== 'order.json')
    .map((f) => `screens/${f}`),
  'characters.json',
];

describe('아픈 소리 줄은 게이지가 주는 규칙에서만 (#935)', () => {
  const uses: Use[] = [];
  for (const f of files) collect(JSON.parse(readFileSync(dir(`../../content/${f}`), 'utf8')), f, false, uses);

  it('say 키를 찾는다 (검사가 비어 통과하지 않게)', () => {
    expect(uses.filter((u) => u.hurt).length).toBeGreaterThan(0);
    expect(uses.filter((u) => !u.hurt).length).toBeGreaterThan(0);
  });

  it('게이지가 안 주는 자리의 대사에 いてっ·いてて·痛い·痛っ가 없다', () => {
    const bad = uses
      .filter((u) => !u.hurt)
      .flatMap((u) => variants(u.key).filter((k) => PAIN.test(texts[k] ?? '')).map((k) => `${u.file} ${k}: ${texts[k]}`));
    expect([...new Set(bad)]).toEqual([]);
  });
});
