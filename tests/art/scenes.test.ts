// 화면 그림 빌드 검사 (형식 기록 docs/decisions/2026-11-16-scene-art-format-v1.md 8절, #157 10절 1단계).
// 진짜 화면(magpie_nest)은 아직 물건이 비어 있어서, 검사 하나하나는 가짜 장면으로 "어기면 잡힌다"를 확인한다.
// 히트 박스·플래그·ID는 진짜 화면 JSON(content/screens/magpie_nest.json)을 쓴다. 그림이 그 좌표를 따르는지가 검사의 목적이라서다.

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildScene, type Img, type SceneSrc } from '../../art/scene-build.mjs';

const ROOT = join(import.meta.dirname, '..', '..');
const screen = JSON.parse(readFileSync(join(ROOT, 'content', 'screens', 'magpie_nest.json'), 'utf8'));

const INK = 0, LINT = 4, WOOD = 11, YEL = 15, HINT = 31;
const plainBg = (img: Img) => img.rect(0, 0, img.w, img.h, LINT);
/** 화면 좌표 [x, y, w, h]에 색 상자를 그리는 draw */
const box = (x: number, y: number, w: number, h: number, col = WOOD) => (img: Img) => img.rect(x, y, w, h, col);

/** 형식 기록 3절 예시를 줄인 정상 장면. 모든 필드를 한 번씩 쓴다. */
function goodScene(): SceneSrc {
  return {
    id: 'magpie_nest',
    bg: plainBg,
    objects: {
      nest: {
        draw: box(130, 34, 30, 16),
        loop: { ms: [1600, 120, 120], frames: [box(130, 34, 30, 16), box(130, 34, 30, 16, YEL), box(130, 34, 30, 16)] },
        states: [{ when: { flags: { 'nest.key_taken': true } }, draw: box(130, 36, 30, 14) }],
      },
      magpie: {
        draw: box(138, 10, 16, 18, INK),
        states: [{ when: { flags: { 'magpie.on_ground': true } }, layer: 'front', draw: box(92, 220, 16, 14, INK) }],
      },
      seesaw: { ids: ['seesaw_left', 'seesaw_right'], draw: box(208, 210, 80, 4) },
      basket: { draw: box(146, 214, 28, 22), overlay: { sortY: 236, draw: box(146, 226, 28, 10, LINT) } },
    },
    anims: {
      'seesaw_right.plank_bounce': { ms: 80, frames: [box(208, 206, 80, 6), box(208, 204, 80, 10), box(208, 206, 80, 6)] },
      'magpie.fly_down': { ms: 100, frames: [box(120, 60, 16, 16), box(100, 150, 16, 16)], layer: 'front' },
    },
  };
}

function problemsOf(edit: (s: SceneSrc) => void): string[] {
  const s = goodScene();
  edit(s);
  return buildScene(s, screen).problems;
}

describe('scene build (format v1)', () => {
  it('진짜 화면 magpie_nest가 검사를 통과한다', async () => {
    // 그림 원본은 타입이 없는 .mjs라 경로를 변수로 둬서 동적으로 읽는다(build.mjs --check도 같은 검사를 돈다)
    const src = '../../art/scenes/magpie_nest.mjs';
    const { SCENE } = (await import(src)) as { SCENE: SceneSrc };
    expect(buildScene(SCENE, screen).problems).toEqual([]);
  });

  it('정상 가짜 장면은 문제가 없고, 시트와 메타를 만든다', () => {
    const r = buildScene(goodScene(), screen);
    expect(r.problems).toEqual([]);
    const meta = r.meta!;
    expect(meta.image).toBe('magpie_nest-objects.png');
    expect(meta.objects.map((o) => o.key)).toEqual(['nest', 'magpie', 'seesaw', 'basket']); // 적은 순서 = 뒤 → 앞
    // nest: 기본 1 + loop 3 + state 1, magpie 2, seesaw 1, basket 1 + overlay 1, anims 3 + 2 = 15
    expect(meta.frames).toHaveLength(15);
    // at은 그린 자리(화면 좌표), src는 시트 안 잘린 크기
    expect(meta.frames[0]).toEqual({ src: [0, 0, 30, 16], at: [130, 34] });
    const nest = meta.objects[0]!;
    expect(nest.default.loop).toEqual({ frames: [1, 2, 3], ms: [1600, 120, 120] });
    expect(nest.states![0]!.when).toEqual({ flags: { 'nest.key_taken': true } });
    expect(meta.objects[1]!.states![0]!.layer).toBe('front');
    expect(meta.objects[1]!.default.layer).toBe('back');
    expect(meta.objects[2]!.ids).toEqual(['seesaw_left', 'seesaw_right']);
    expect(meta.objects[3]!.overlay!.sortY).toBe(236);
    // anim: ms 숫자 하나는 프레임별 배열로, 대상 ID → 물건 키
    expect(meta.anims['seesaw_right.plank_bounce']).toMatchObject({ object: 'seesaw', ms: [80, 80, 80], layer: 'back' });
    expect(meta.anims['magpie.fly_down']).toMatchObject({ object: 'magpie', layer: 'front' });
    // 모든 프레임이 시트 안에 있다
    for (const f of meta.frames) {
      expect(f.src[0] + f.src[2]).toBeLessThanOrEqual(r.sheet!.w);
      expect(f.src[1] + f.src[3]).toBeLessThanOrEqual(r.sheet!.h);
    }
  });

  it('같은 원본이면 같은 시트(결정적)', () => {
    const a = buildScene(goodScene(), screen);
    const b = buildScene(goodScene(), screen);
    expect(JSON.stringify(a.meta)).toBe(JSON.stringify(b.meta));
    expect(Buffer.from(a.sheet!.c.buffer).equals(Buffer.from(b.sheet!.c.buffer))).toBe(true);
  });

  describe('배경', () => {
    it('ink(0)를 잡는다', () => {
      expect(problemsOf((s) => (s.bg = (img) => { plainBg(img); img.set(5, 5, INK); }))).toEqual([expect.stringContaining('0번 ink')]);
    });
    it('hint(31)를 잡는다', () => {
      expect(problemsOf((s) => (s.bg = (img) => { plainBg(img); img.set(5, 5, HINT); }))).toEqual([expect.stringContaining('31번 hint')]);
    });
    it('투명 칸을 잡는다', () => {
      expect(problemsOf((s) => (s.bg = (img) => img.rect(0, 0, 479, 270, LINT)))).toEqual([expect.stringContaining('투명')]);
    });
    it('PNG 크기 상한을 잡는다', () => {
      // 32색 인덱스 PNG는 480×270에서 약 80KB(픽셀당 5비트)를 넘기 어려워 상한을 낮춰서 확인한다
      expect(buildScene(goodScene(), screen, { bgMaxBytes: 100 }).problems).toEqual([expect.stringContaining('배경 PNG')]);
      expect(buildScene(goodScene(), screen).problems).toEqual([]);
    });
  });

  describe('ID와 플래그', () => {
    it('화면 JSON에 없는 ID', () => {
      expect(problemsOf((s) => (s.objects!.laundry_bag = { draw: box(0, 0, 4, 4) }))).toEqual([expect.stringContaining("'laundry_bag'는 화면 JSON")]);
    });
    it('한 ID를 두 물건이 맡음', () => {
      expect(problemsOf((s) => (s.objects!.plank = { ids: ['seesaw_left'], draw: box(208, 210, 30, 4) }))).toEqual([expect.stringContaining("'seesaw'도 맡는다")]);
    });
    it('when의 플래그가 화면 JSON에 없음', () => {
      expect(problemsOf((s) => s.objects!.nest!.states!.push({ when: { flags: { 'nest.burnt': true } }, draw: box(130, 34, 30, 16) }))).toEqual([
        expect.stringContaining("'nest.burnt'"),
      ]);
    });
    it('when이 flags 말고 다른 것을 씀', () => {
      expect(problemsOf((s) => s.objects!.nest!.states!.push({ when: { gauge: 0 } as never, draw: box(130, 34, 30, 16) }))).toEqual([
        expect.stringContaining('when은 { flags'),
      ]);
    });
    it('anim 대상을 맡은 물건이 없음', () => {
      expect(problemsOf((s) => (s.anims!['hook.wobble'] = { ms: 100, frames: [box(150, 84, 4, 4)] }))).toEqual([expect.stringContaining("대상 'hook'")]);
    });
    it('anim 키가 대상.이름 모양이 아님', () => {
      expect(problemsOf((s) => (s.anims!.wobble = { ms: 100, frames: [box(150, 84, 4, 4)] }))).toEqual([expect.stringContaining("'대상.이름'")]);
    });
    it('필드 이름 오타', () => {
      expect(problemsOf((s) => ((s.objects!.nest as Record<string, unknown>).layers = 'front'))).toEqual([expect.stringContaining("모르는 필드 'layers'")]);
    });
  });

  describe('그림과 히트 박스', () => {
    it('기본 그림이 히트 박스와 안 겹침', () => {
      expect(problemsOf((s) => (s.objects!.basket!.draw = box(300, 214, 20, 20)))).toEqual([expect.stringContaining('objects.basket.draw')]);
    });
    it('state 그림은 그 상태의 variants 박스로 본다(바닥 까치 [88,212,24,24])', () => {
      // 둥지 위 자리에 그린 바닥 까치 → variants 박스와 안 겹친다
      expect(problemsOf((s) => (s.objects!.magpie!.states![0]!.draw = box(138, 10, 16, 18)))).toEqual([expect.stringContaining('[88,212,24,24]')]);
    });
    it('loop 프레임도 본다', () => {
      expect(problemsOf((s) => (s.objects!.nest!.loop!.frames[1] = box(0, 0, 4, 4)))).toEqual([expect.stringContaining('objects.nest.loop[1]')]);
    });
    it('ids 물건은 상자 중 하나와 겹치면 된다', () => {
      expect(problemsOf((s) => (s.objects!.seesaw!.draw = box(252, 210, 30, 4)))).toEqual([]);
    });
    it('빈 그림', () => {
      expect(problemsOf((s) => (s.objects!.basket!.draw = () => {}))).toEqual([expect.stringContaining('아무것도 그리지 않았다')]);
    });
    it('물건에 hint(31)', () => {
      expect(problemsOf((s) => (s.objects!.basket!.draw = box(146, 214, 28, 22, HINT)))).toEqual([expect.stringContaining('31번 hint')]);
    });
    it('anim은 움직이므로 히트 박스 밖이어도 된다', () => {
      expect(problemsOf((s) => (s.anims!['magpie.fly_down']!.frames = [box(10, 10, 4, 4)]))).toEqual([]);
    });
  });

  describe('시간·앞뒤', () => {
    it('ms 0·소수·음수', () => {
      for (const ms of [0, 12.5, -80]) expect(problemsOf((s) => (s.anims!['seesaw_right.plank_bounce']!.ms = ms))).toEqual([expect.stringContaining('양의 정수')]);
    });
    it('ms 배열 길이 ≠ frames', () => {
      expect(problemsOf((s) => (s.objects!.nest!.loop!.ms = [1600, 120]))).toEqual([expect.stringContaining('ms 배열 길이 2 ≠ frames 3')]);
    });
    it('anim ms 합 1500 초과', () => {
      expect(problemsOf((s) => (s.anims!['magpie.fly_down']!.ms = [800, 701]))).toEqual([expect.stringContaining('ms 합 1501')]);
    });
    it('anim ms 합 1500은 통과', () => {
      expect(problemsOf((s) => (s.anims!['magpie.fly_down']!.ms = [800, 700]))).toEqual([]);
    });
    it('sortY가 히트 박스 세로 범위(212~236) 밖', () => {
      expect(problemsOf((s) => (s.objects!.basket!.overlay!.sortY = 244))).toEqual([expect.stringContaining('212~236')]);
    });
    it('layer는 back/front만', () => {
      expect(problemsOf((s) => (s.objects!.magpie!.layer = 'top' as never))).toEqual([expect.stringContaining("layer 'top'")]);
    });
  });
});
