// 겹쳐 그리는 물건 쌍의 앞뒤를 물건 시트에서 고정한다 (#764).
// 엔진은 층(`back` → 사람 → `front`)마다 `objects`에 적은 순서대로 그린다(`sceneDraws`). 같은 물건이라도 멈춘 모습·anim마다
// 층이 다를 수 있어서, `objects` 순서만 맞고 층이 엇갈리면 뒤에 있어야 할 것이 앞에 그려진다. 미리보기 스크립트는 시트를
// 통째로 그리지 않아서 이걸 못 잡는다(PR #917·#925 리뷰에서 손으로 짚은 것).
// 시트가 없는 화면(그림 전, 예: `laundromat`)은 보지 않는다. 시트 PR이 시트를 만드는 순간 그 화면 규칙이 켜진다.
// 형식: docs/decisions/2026-11-16-scene-art-format-v1.md. 그림 쪽 고정 검사는 vitest에 둔다(결정 2026-11-22-art-timing-guard-in-vitest).

import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseSceneArt, type Layer, type SceneArtMeta, type ScenePictureObject } from '../../src/core/sceneArt';

const ROOT = join(import.meta.dirname, '..', '..');

interface OrderRule {
  /** 뒤에 그려질 물건(`key` 또는 그 물건이 맡은 대상 ID). */
  below: string;
  /** 그 위에 그려질 물건. */
  above: string;
  /** 있으면 `below`의 이 anim들(이름만, 대상 접두 없이)만 본다. 없으면 멈춘 모습·anim 전부. */
  belowAnims?: string[];
  why: string;
}

const RULES: Record<string, OrderRule[]> = {
  magpie_nest: [{ below: 'nest', above: 'magpie', why: '까치가 둥지 위에 앉는다' }],
  laundromat: [
    { below: 'shutter', above: 'gap', why: '틈 속 열쇠·까치 머리가 셔터 판 위(PR #917 리뷰)' },
    { below: 'nest', above: 'magpie', why: '앉은 까치가 둥지 위(결정 2026-11-25-laundromat-magpie-sit-key-zone-mask)' },
    { below: 'magpie', above: 'shutter', belowAnims: ['fly_out', 'fly_in'], why: '날기는 벽 뒤(laundromat.md E3)' },
  ],
};

interface Drawn {
  index: number;
  /** 어디서 나온 층인지(실패 메시지용). */
  layers: { layer: Layer; from: string }[];
}

const isPicture = (o: SceneArtMeta['objects'][number]): o is ScenePictureObject => o.effect === undefined;

/**
 * 물건 하나가 그려질 수 있는 층 전부. 머리 위 anim(`anchor`)은 사람 위 따로 그려서 뺀다(16절).
 * `onlyAnims`가 있으면 그 이름의 anim만 본다.
 */
function drawn(meta: SceneArtMeta, name: string, onlyAnims?: string[]): Drawn | null {
  const index = meta.objects.findIndex((o) => isPicture(o) && (o.key === name || o.ids.includes(name)));
  if (index < 0) return null;
  const o = meta.objects[index] as ScenePictureObject;
  const layers: Drawn['layers'] = [];
  if (!onlyAnims) {
    if (o.default.frame !== null) layers.push({ layer: o.default.layer, from: 'default' });
    for (const [i, s] of (o.states ?? []).entries()) if (s.frame !== null) layers.push({ layer: s.layer, from: `states[${i}]` });
  }
  for (const [full, a] of Object.entries(meta.anims)) {
    if (a.object !== o.key || a.anchor) continue;
    const short = full.slice(full.indexOf('.') + 1);
    if (onlyAnims && !onlyAnims.includes(short)) continue;
    layers.push({ layer: a.layer, from: full });
    for (const [j, v] of (a.variants ?? []).entries()) layers.push({ layer: v.layer, from: `${full}.variants[${j}]` });
  }
  return { index, layers };
}

const rank = (l: Layer): number => (l === 'back' ? 0 : 1);

/** 규칙을 어기는 층 조합. 빈 배열이면 통과. 물건이 시트에 없으면 그 이름을 적는다. */
function violations(meta: SceneArtMeta, rule: OrderRule): string[] {
  const lo = drawn(meta, rule.below, rule.belowAnims);
  const hi = drawn(meta, rule.above);
  if (!lo || !hi) return [`시트에 없음: ${!lo ? rule.below : rule.above}`];
  if (rule.belowAnims && lo.layers.length === 0) return [`anim 없음: ${rule.below}.${rule.belowAnims.join('|')}`];
  const out: string[] = [];
  for (const b of lo.layers)
    for (const a of hi.layers) {
      const lr = rank(b.layer);
      const hr = rank(a.layer);
      if (hr < lr || (hr === lr && hi.index < lo.index))
        out.push(`${rule.below} ${b.from}(${b.layer}, #${lo.index}) 위에 ${rule.above} ${a.from}(${a.layer}, #${hi.index})가 안 그려짐`);
    }
  return out;
}

const read = (id: string): SceneArtMeta => parseSceneArt(JSON.parse(readFileSync(join(ROOT, 'public', 'scenes', `${id}-objects.json`), 'utf8')));
const withSheet = Object.keys(RULES).filter((id) => existsSync(join(ROOT, 'public', 'scenes', `${id}-objects.json`)));

describe('겹치는 물건의 앞뒤 (#764)', () => {
  it('검사할 화면이 있다(폴더를 잘못 읽어 0개로 통과하지 않게)', () => {
    expect(withSheet).toContain('magpie_nest');
  });

  it.each(withSheet.flatMap((id) => RULES[id]!.map((r) => [id, r] as const)))('%s: %o', (id, rule) => {
    expect(violations(read(id), rule), rule.why).toEqual([]);
  });
});

describe('검사기 자체', () => {
  const pic = (layer: Layer) => ({ frame: 0, layer });
  const meta = (objects: { key: string; ids: string[]; layer: Layer; states?: Layer[] }[], anims: SceneArtMeta['anims'] = {}): SceneArtMeta => ({
    image: 'x.png',
    screen: 'x',
    bg: null,
    frames: [{ src: [0, 0, 1, 1], at: [0, 0] }],
    objects: objects.map((o) => ({
      key: o.key,
      ids: o.ids,
      default: pic(o.layer),
      ...(o.states ? { states: o.states.map((l) => ({ ...pic(l), when: { flags: { f: true } } })) } : {}),
    })),
    anims,
  });
  const rule: OrderRule = { below: 'shutter', above: 'gap', why: '' };

  it('순서·층이 맞으면 통과', () => {
    const m = meta([
      { key: 'shutter', ids: ['shutter'], layer: 'back' },
      { key: 'gap', ids: ['gap'], layer: 'back', states: ['front'] },
    ]);
    expect(violations(m, rule)).toEqual([]);
  });

  it('같은 층에서 순서가 거꾸로면 잡는다', () => {
    const m = meta([
      { key: 'gap', ids: ['gap'], layer: 'back' },
      { key: 'shutter', ids: ['shutter'], layer: 'back' },
    ]);
    expect(violations(m, rule)).toHaveLength(1);
  });

  it('순서가 맞아도 위 물건의 state 하나가 낮은 층이면 잡는다', () => {
    const m = meta([
      { key: 'shutter', ids: ['shutter'], layer: 'front' },
      { key: 'gap', ids: ['gap'], layer: 'front', states: ['back'] },
    ]);
    expect(violations(m, rule)).toEqual(['shutter default(front, #0) 위에 gap states[0](back, #1)가 안 그려짐']);
  });

  it('anim 층과 갈래 층도 본다, 머리 위 anim은 뺀다', () => {
    const m = meta(
      [
        { key: 'shutter', ids: ['shutter'], layer: 'back' },
        { key: 'gap', ids: ['gap'], layer: 'back' },
      ],
      {
        'shutter.lift': { object: 'shutter', layer: 'front', frames: [0], ms: [80], variants: [{ frames: [0], ms: [80], layer: 'back', when: { flags: {} } }] },
        'gap.hat': { object: 'gap', layer: 'front', frames: [0], ms: [80], anchor: { char: 'mukjik', point: 'head' } },
      },
    );
    expect(violations(m, rule)).toEqual(['shutter shutter.lift(front, #0) 위에 gap default(back, #1)가 안 그려짐']);
  });

  it('belowAnims면 그 anim만 보고, 없으면 실패로 알린다', () => {
    const m = meta(
      [
        { key: 'magpie', ids: ['magpie'], layer: 'front' },
        { key: 'shutter', ids: ['shutter'], layer: 'back' },
      ],
      { 'magpie.fly_out': { object: 'magpie', layer: 'back', frames: [0], ms: [80] } },
    );
    expect(violations(m, { below: 'magpie', above: 'shutter', belowAnims: ['fly_out'], why: '' })).toEqual([]);
    expect(violations(m, { below: 'magpie', above: 'shutter', belowAnims: ['fly_in'], why: '' })).toEqual(['anim 없음: magpie.fly_in']);
  });

  it('장식 물건은 key로, 대상은 ids로 찾는다', () => {
    const m = meta([
      { key: 'nest', ids: [], layer: 'back' },
      { key: 'bird', ids: ['magpie'], layer: 'back' },
    ]);
    expect(violations(m, { below: 'nest', above: 'magpie', why: '' })).toEqual([]);
    expect(violations(m, { below: 'nest', above: 'crow', why: '' })).toEqual(['시트에 없음: crow']);
  });
});
