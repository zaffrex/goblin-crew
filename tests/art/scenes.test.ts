// 화면 그림 빌드 검사 (형식 기록 docs/decisions/2026-11-16-scene-art-format-v1.md 8절, #157 10절 1단계).
// 진짜 화면(magpie_nest)은 아직 물건이 비어 있어서, 검사 하나하나는 가짜 장면으로 "어기면 잡힌다"를 확인한다.
// 히트 박스·플래그·ID는 진짜 화면 JSON(content/screens/magpie_nest.json)을 쓴다. 그림이 그 좌표를 따르는지가 검사의 목적이라서다.

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ANCHOR_CHARS, ANCHOR_ORIGIN, buildScene, type Img, type SceneSrc } from '../../art/scene-build.mjs';
import { CHARACTERS } from '../../src/core/characters';

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
    // 그중 nest loop 첫·끝 칸(기본과 같음), plank_bounce 끝 칸(첫 칸과 같음)은 같은 그림이라 합친다 → 12
    expect(meta.frames).toHaveLength(12);
    expect(meta.bg).toBe('magpie_nest-bg.png');
    // at은 그린 자리(화면 좌표), src는 시트 안 잘린 크기
    expect(meta.frames[0]).toEqual({ src: [0, 0, 30, 16], at: [130, 34] });
    const nest = meta.objects[0]!;
    expect(nest.default.loop).toEqual({ frames: [0, 1, 0], ms: [1600, 120, 120] });
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
    it('물건 그림의 ink가 화면 가장자리 1px 줄에 닿으면 잡는다(개정 10, #653)', () => {
      /** 까치 그림(히트 박스 안) + 점 하나 */
      const withDot = (x: number, y: number, col = INK) => (s: SceneSrc) => (s.objects!.magpie!.draw = (img: Img) => { box(138, 10, 16, 18, INK)(img); img.set(x, y, col); });
      for (const [x, y] of [[0, 15], [140, 0], [140, 269], [479, 15]] as const) {
        expect(problemsOf(withDot(x, y)), `${x},${y}`).toEqual([expect.stringContaining('가장자리 1px')]);
      }
      // 1px 안이면 통과, 가장자리에 닿아도 ink가 아니면 통과(그 변은 외곽선 없이 끝낸 그림)
      expect(problemsOf(withDot(1, 15))).toEqual([]);
      expect(problemsOf(withDot(478, 268))).toEqual([]);
      expect(problemsOf(withDot(0, 15, WOOD))).toEqual([]);
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

  describe('안 그리는 멈춘 모습 draw: null (개정 9, #551)', () => {
    it('state에서는 받고 메타 frame이 null이다(시트 칸이 늘지 않는다)', () => {
      const base = buildScene(goodScene(), screen).meta!.frames.length;
      const s = goodScene();
      s.objects!.magpie!.states![0]!.draw = null;
      const r = buildScene(s, screen);
      expect(r.problems).toEqual([]);
      expect(r.meta!.objects[1]!.states![0]).toEqual({ when: { flags: { 'magpie.on_ground': true } }, frame: null, layer: 'front' });
      expect(r.meta!.frames).toHaveLength(base - 1); // 바닥 까치 칸이 빠졌다
    });
    it('default·loop가 있는 state·앞판/기울기 물건에서는 막는다', () => {
      expect(problemsOf((s) => ((s.objects!.magpie as Record<string, unknown>).draw = null))).toEqual([expect.stringContaining('objects.magpie.draw: draw가 함수가 아니다')]);
      expect(
        problemsOf((s) => {
          s.objects!.magpie!.states![0]!.draw = null;
          s.objects!.magpie!.states![0]!.loop = { ms: [2200, 150], frames: [box(92, 220, 16, 14, INK), box(92, 221, 16, 13, INK)] };
        }),
      ).toEqual([expect.stringContaining('objects.magpie.states[0]: draw가 null(안 그림)이면 loop')]);
      expect(problemsOf((s) => (s.objects!.basket!.states = [{ when: { flags: { 'nest.key_taken': true } }, draw: null }]))).toEqual([
        expect.stringContaining('objects.basket.states[0]: 앞판(overlay)·기울기(tilt)'),
      ]);
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
    it('반복 첫 칸이 멈춘 모습과 다르면 잡는다(4절 개정 3, #237)', () => {
      expect(problemsOf((s) => (s.objects!.nest!.loop!.frames[0] = box(130, 34, 30, 16, YEL)))).toEqual([expect.stringContaining('objects.nest.loop[0]: 반복 첫 칸')]);
      // state 반복도 본다
      expect(
        problemsOf((s) => (s.objects!.magpie!.states![0]!.loop = { ms: [2200, 150], frames: [box(92, 221, 16, 13, INK), box(92, 220, 16, 14, INK)] })),
      ).toEqual([expect.stringContaining('objects.magpie.states[0].loop[0]: 반복 첫 칸')]);
      // 첫 칸이 같으면 통과
      expect(
        problemsOf((s) => (s.objects!.magpie!.states![0]!.loop = { ms: [2200, 150], frames: [box(92, 220, 16, 14, INK), box(92, 221, 16, 13, INK)] })),
      ).toEqual([]);
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
    it('앞판 그림이 발 위 10px보다 높이 올라옴(위 끝 < sortY − 11)', () => {
      expect(problemsOf((s) => (s.objects!.basket!.overlay!.draw = box(146, 224, 28, 12, LINT)))).toEqual([expect.stringContaining('sortY − 11(225)')]);
      expect(problemsOf((s) => (s.objects!.basket!.overlay!.draw = box(146, 225, 28, 11, LINT)))).toEqual([]);
    });
    it('layer는 back/front만', () => {
      expect(problemsOf((s) => (s.objects!.magpie!.layer = 'top' as never))).toEqual([expect.stringContaining("layer 'top'")]);
    });
  });
  describe('기울기·판 밑 바닥(12절, 개정 5·7)', () => {
    const tilt = { rest: 3, weight: { jjuk: 1, mukjik: 2 }, pivot: 247.5, run: 40, draw: { '-3': box(208, 212, 80, 4), 3: box(208, 208, 80, 4) } };
    const withTilt = (s: SceneSrc) => {
      s.objects!.seesaw!.tilt = { ...tilt, weight: { ...tilt.weight }, draw: { ...tilt.draw } };
      s.objects!.seesaw!.noFloor = { box: [204, 200, 89, 38], y: 240 };
    };
    it('정상: 기울기 칸이 프레임이 되고 메타에 d → 칸 번호로 적힌다', () => {
      const s = goodScene();
      withTilt(s);
      const r = buildScene(s, screen);
      expect(r.problems).toEqual([]);
      const seesaw = r.meta!.objects.find((o) => o.key === 'seesaw')!;
      expect(Object.keys(seesaw.tilt!.frames).sort()).toEqual(['-3', '3']);
      expect(seesaw.tilt).toMatchObject({ rest: 3, pivot: 247.5, run: 40 });
      expect(seesaw.noFloor).toEqual({ box: [204, 200, 89, 38], y: 240 });
    });
    it('키가 −rest·rest가 아니면, 둘 중 하나가 빠지면 막는다(개정 7)', () => {
      expect(problemsOf((s) => { withTilt(s); s.objects!.seesaw!.tilt!.draw['0'] = box(208, 210, 80, 4); })).toEqual([expect.stringContaining("draw['0']")]);
      expect(problemsOf((s) => { withTilt(s); s.objects!.seesaw!.tilt!.draw['6'] = box(208, 210, 80, 4); })).toEqual([expect.stringContaining("draw['6']")]);
      expect(problemsOf((s) => { withTilt(s); delete s.objects!.seesaw!.tilt!.draw['-3']; })).toEqual([expect.stringContaining("'-3' 칸이 없다")]);
    });
    it('기울기 칸이 히트 박스와 안 겹치면 막는다', () => {
      expect(problemsOf((s) => { withTilt(s); s.objects!.seesaw!.tilt!.draw['3'] = box(10, 10, 4, 4); })).toEqual([expect.stringContaining('히트 박스')]);
    });
    it('board 자리가 없는 물건에 기울기를 달면 막는다', () => {
      expect(problemsOf((s) => { s.objects!.nest!.tilt = { ...tilt, draw: { '-3': box(130, 34, 30, 16), 3: box(130, 34, 30, 16) } } as never; })).toEqual([expect.stringContaining('board 자리가 없다')]);
    });
    it('weight가 양의 정수가 아니면, noFloor y가 상자 안이면 막는다', () => {
      expect(problemsOf((s) => { withTilt(s); s.objects!.seesaw!.tilt!.weight = { jjuk: 0 }; })).toEqual([expect.stringContaining('weight')]);
      expect(problemsOf((s) => { withTilt(s); s.objects!.seesaw!.noFloor!.y = 220; })).toEqual([expect.stringContaining('noFloor')]);
    });
    it('anim 칸별 기울기(12-5절, 개정 6): 메타에 그대로 적힌다', () => {
      const s = goodScene();
      withTilt(s);
      s.anims!['seesaw_right.plank_bounce']!.tilt = [4, 7, -2];
      const r = buildScene(s, screen);
      expect(r.problems).toEqual([]);
      expect(r.meta!.anims['seesaw_right.plank_bounce']!.tilt).toEqual([4, 7, -2]);
      expect(r.meta!.anims['magpie.fly_down']!.tilt).toBeUndefined();
    });
    it('anim 칸별 기울기: 칸 수가 다르거나 정수가 아니면, 기울기 없는 물건이면 막는다', () => {
      const bounce = (s: SceneSrc) => s.anims!['seesaw_right.plank_bounce']!;
      expect(problemsOf((s) => { withTilt(s); bounce(s).tilt = [4, 7]; })).toEqual([expect.stringContaining('tilt: frames와 같은 길이(3)')]);
      expect(problemsOf((s) => { withTilt(s); bounce(s).tilt = [4, 7.5, -2]; })).toEqual([expect.stringContaining('.tilt')]);
      expect(problemsOf((s) => { bounce(s).tilt = [4, 7, -2]; })).toEqual([expect.stringContaining('대상 물건에 tilt가 없다')]);
      expect(problemsOf((s) => { s.anims!['magpie.fly_down']!.tilt = [1, 2]; })).toEqual([expect.stringContaining('대상 물건에 tilt가 없다')]);
    });
  });
  describe('장식 물건 `ids: []`와 anim 원본 `object`(15절, 개정 11, #901)', () => {
    /** 까치 대상 anim이 핫스팟 없는 둥지 장식을 바꿔 그린다(laundromat `magpie.key_in`과 같은 모양). */
    const withDecor = (s: SceneSrc) => {
      s.objects!.perch = { ids: [], draw: box(126, 52, 40, 4) };
      s.anims!['magpie.key_in'] = { object: 'perch', ms: 100, frames: [box(126, 50, 40, 6), box(126, 52, 40, 4)] };
    };
    it('정상: 장식 물건은 ids []로 메타에 남고, anim은 원본 object 물건을 바꾼다', () => {
      const s = goodScene();
      withDecor(s);
      const r = buildScene(s, screen);
      expect(r.problems).toEqual([]);
      expect(r.meta!.objects.find((o) => o.key === 'perch')).toMatchObject({ ids: [] });
      expect(r.meta!.anims['magpie.key_in']!.object).toBe('perch');
      expect(r.meta!.anims['magpie.fly_down']!.object).toBe('magpie');
    });
    it('ids를 안 적은 물건은 여전히 키가 ID다(빈 배열은 적어야만 장식)', () => {
      expect(problemsOf((s) => (s.objects!.perch = { draw: box(126, 52, 40, 4) }))).toEqual([expect.stringContaining("'perch'는 화면 JSON")]);
    });
    it('object가 없는 물건·효과 자리·대상을 이미 맡은 물건이면 잡는다', () => {
      expect(problemsOf((s) => {
        withDecor(s);
        s.anims!['magpie.key_in']!.object = 'nope';
      })).toEqual([expect.stringContaining("'nope'는 그림 물건 키가 아니다")]);
      expect(problemsOf((s) => {
        withDecor(s);
        s.objects!.water = { effect: 'fountain_water', area: [152, 8, 144, 172], colors: [26, 25, 6, 24], mode: 'on' };
        s.anims!['magpie.key_in']!.object = 'water';
      })).toEqual([expect.stringContaining("'water'는 그림 물건 키가 아니다")]);
      expect(problemsOf((s) => (s.anims!['magpie.fly_down']!.object = 'magpie'))).toEqual([expect.stringContaining('이미 맡은 물건')]);
    });
    it('object가 있어도 대상은 화면 JSON ID여야 한다', () => {
      expect(problemsOf((s) => {
        withDecor(s);
        s.anims!['crow.key_in'] = s.anims!['magpie.key_in']!;
      })).toEqual([expect.stringContaining("대상 'crow'")]);
    });
    it('장식 물건은 앞판·기울기·판 밑 바닥을 못 둔다', () => {
      expect(problemsOf((s) => {
        withDecor(s);
        s.objects!.perch!.noFloor = { box: [126, 200, 40, 20], y: 240 };
      })).toEqual([expect.stringContaining('장식 물건(ids: [])')]);
    });
  });

  describe('붙드는 anim `hold`(13절, 개정 8, #450)', () => {
    it('정상: 그림 anim·효과 anim 모두 메타에 hold: true, 없으면 필드도 없다', () => {
      const s = goodScene();
      s.anims!['magpie.fly_down']!.hold = true;
      s.objects = { ...s.objects, water: { effect: 'fountain_water', area: [152, 8, 144, 172], colors: [26, 25, 6, 24], mode: 'on' } };
      s.anims!['basket.water_burst'] = { effect: 'water', mode: 'burst', ms: 1200, hold: true } as never;
      const r = buildScene(s, screen);
      expect(r.problems).toEqual([]);
      expect(r.meta!.anims['magpie.fly_down']!.hold).toBe(true);
      expect(r.meta!.anims['basket.water_burst']).toEqual({ object: 'water', frames: [], ms: [1200], layer: 'back', mode: 'burst', hold: true });
      expect('hold' in r.meta!.anims['seesaw_right.plank_bounce']!).toBe(false);
    });
    it('true 말고 다른 값, 갈래에 hold, 기울기 물건 anim에 hold', () => {
      expect(problemsOf((s) => (s.anims!['magpie.fly_down']!.hold = false))).toEqual([expect.stringContaining('hold: true만 쓴다')]);
      expect(problemsOf((s) => (s.anims!['magpie.fly_down']!.variants = [{ when: { flags: { 'magpie.on_ground': true } }, ms: 100, frames: [box(100, 150, 16, 16)], hold: true }]))).toEqual([
        expect.stringContaining("모르는 필드 'hold'"),
      ]);
      expect(problemsOf((s) => {
        s.objects!.seesaw!.tilt = { rest: 3, weight: { jjuk: 1 }, pivot: 247.5, run: 40, draw: { '-3': box(208, 212, 80, 4), 3: box(208, 208, 80, 4) } };
        s.anims!['seesaw_right.plank_bounce']!.hold = true;
      })).toEqual([expect.stringContaining('기울기 물건 anim은 붙들 수 없다')]);
    });
  });
  describe('anim 갈래(4-1절, 개정 1)·배경 이름', () => {
    const withVariant = (s: SceneSrc) => {
      s.anims!['magpie.ruffle'] = {
        ms: [100, 150],
        frames: [box(138, 8, 16, 18, INK), box(138, 10, 16, 18, INK)],
        variants: [{ when: { flags: { 'magpie.on_ground': true } }, ms: 100, frames: [box(92, 218, 16, 16, INK)], layer: 'front' }],
      };
    };
    it('갈래를 메타에 넣고, 갈래 layer는 기본을 물려받지 않는다', () => {
      const s = goodScene();
      withVariant(s);
      s.anims!['magpie.ruffle']!.layer = 'front';
      delete s.anims!['magpie.ruffle']!.variants![0]!.layer;
      const r = buildScene(s, screen);
      expect(r.problems).toEqual([]);
      const a = r.meta!.anims['magpie.ruffle']!;
      expect(a.layer).toBe('front');
      expect(a.variants).toEqual([{ when: { flags: { 'magpie.on_ground': true } }, frames: [expect.any(Number)], ms: [100], layer: 'back' }]);
    });
    it('갈래 플래그가 화면 JSON에 없음', () => {
      expect(problemsOf((s) => { withVariant(s); s.anims!['magpie.ruffle']!.variants![0]!.when = { flags: { 'magpie.asleep': true } }; })).toEqual([expect.stringContaining("'magpie.asleep'")]);
    });
    it('갈래마다 ms 합 1500 검사', () => {
      expect(problemsOf((s) => { withVariant(s); s.anims!['magpie.ruffle']!.variants![0]!.ms = 1501; })).toEqual([expect.stringContaining('variants[0]: ms 합 1501')]);
    });
    it('갈래 필드 오타·빈 배열', () => {
      expect(problemsOf((s) => { withVariant(s); (s.anims!['magpie.ruffle']!.variants![0] as Record<string, unknown>).wehn = 1; })).toEqual([expect.stringContaining("모르는 필드 'wehn'")]);
      expect(problemsOf((s) => { withVariant(s); s.anims!['magpie.ruffle']!.variants = []; })).toEqual([expect.stringContaining('variants는 비어 있지 않은 배열')]);
    });
    it('draft면 메타 bg가 null(엔진이 배경을 요청하지 않는다)', () => {
      const s = goodScene();
      s.draft = true;
      expect(buildScene(s, screen).meta!.bg).toBeNull();
    });
  });

  describe('효과 자리(11절, 개정 4)', () => {
    /** 둥지와 까치 사이에 물줄기 자리를 끼운 정상 장면. 효과 anim은 진짜 대상 ID(basket)로 보낸다. */
    function fxScene(): SceneSrc {
      const s = goodScene();
      const { nest, ...rest } = s.objects!;
      s.objects = {
        nest: nest!,
        water: { effect: 'fountain_water', area: [152, 8, 144, 172], colors: [26, 25, 6, 24], mode: 'on', states: [{ when: { flags: { 'nest.key_taken': true } }, mode: 'off' }] },
        ...rest,
      };
      s.anims!['basket.water_off'] = { effect: 'water', mode: 'stop', ms: 900 } as never;
      s.anims!['basket.water_burst'] = { effect: 'water', mode: 'burst', ms: 1200 } as never;
      return s;
    }
    const fxProblems = (edit: (s: SceneSrc) => void) => {
      const s = fxScene();
      edit(s);
      return buildScene(s, screen).problems;
    };

    it('정상: 적은 순서 자리에 그림 없는 물건, 효과 anim은 효과 자리를 가리킨다', () => {
      const r = buildScene(fxScene(), screen);
      expect(r.problems).toEqual([]);
      const meta = r.meta!;
      expect(meta.objects.map((o) => o.key)).toEqual(['nest', 'water', 'magpie', 'seesaw', 'basket']);
      expect(meta.objects[1]).toEqual({
        key: 'water',
        ids: [],
        effect: 'fountain_water',
        area: [152, 8, 144, 172],
        colors: [26, 25, 6, 24],
        default: { mode: 'on' },
        states: [{ when: { flags: { 'nest.key_taken': true } }, mode: 'off' }],
      });
      expect(meta.anims['basket.water_off']).toEqual({ object: 'water', frames: [], ms: [900], layer: 'back', mode: 'stop' });
      // 그림 수는 그대로(효과 자리는 시트에 아무것도 안 넣는다)
      expect(meta.frames).toHaveLength(buildScene(goodScene(), screen).meta!.frames.length);
    });

    it('엔진 효과 표에 없는 effect', () => {
      expect(fxProblems((s) => (s.objects!.water!.effect = 'washer_foam'))).toEqual([expect.stringContaining("effect 'washer_foam'는 엔진 효과 표에 없다")]);
    });
    it('area가 화면 밖이거나 정수 4개가 아님', () => {
      expect(fxProblems((s) => (s.objects!.water!.area = [400, 8, 144, 172]))).toEqual([expect.stringContaining('480×270 밖')]);
      expect(fxProblems((s) => (s.objects!.water!.area = [152, 8, 144] as never))).toEqual([expect.stringContaining('area는 [x, y, w, h]')]);
    });
    it('colors: 서로 다른 4개, ink·hint 금지', () => {
      expect(fxProblems((s) => (s.objects!.water!.colors = [26, 26, 6, 24]))).toEqual([expect.stringContaining('서로 다른 4개')]);
      expect(fxProblems((s) => (s.objects!.water!.colors = [26, 25, 6, 31]))).toEqual([expect.stringContaining('0번 ink·31번 hint')]);
      expect(fxProblems((s) => (s.objects!.water!.colors = [26, 25, 6, 0]))).toEqual([expect.stringContaining('0번 ink·31번 hint')]);
    });
    it('멈춘 모드 자리에 연출 모드, state 플래그가 화면 JSON에 없음', () => {
      expect(fxProblems((s) => (s.objects!.water!.mode = 'burst'))).toEqual([expect.stringContaining("mode 'burst'는 fountain_water의 멈춘 모드")]);
      expect(fxProblems((s) => (s.objects!.water!.states = [{ when: { flags: { 'fountain.off': true } }, mode: 'off' }]))).toEqual([expect.stringContaining("'fountain.off'")]);
    });
    it('효과 자리에 그림 필드, 그림 물건에 효과 필드', () => {
      expect(fxProblems((s) => (s.objects!.water!.draw = box(152, 8, 4, 4)))).toEqual([expect.stringContaining("모르는 필드 'draw'")]);
      expect(fxProblems((s) => (s.objects!.water!.ids = ['basket']))).toEqual([expect.stringContaining("모르는 필드 'ids'")]);
      expect(fxProblems((s) => (s.objects!.magpie!.mode = 'on'))).toEqual([expect.stringContaining("모르는 필드 'mode'")]);
    });
    it('효과 anim: 연출 모드, 효과 자리 키, 대상 ID, ms 하나·상한', () => {
      expect(fxProblems((s) => (s.anims!['basket.water_off'] = { effect: 'water', mode: 'off', ms: 900 } as never))).toEqual([expect.stringContaining("mode 'off'는 fountain_water의 연출 모드")]);
      expect(fxProblems((s) => (s.anims!['basket.water_off'] = { effect: 'nest', mode: 'stop', ms: 900 } as never))).toEqual([expect.stringContaining("effect 'nest'는 효과 자리 키가 아니다")]);
      expect(fxProblems((s) => (s.anims!['statue.water_off'] = { effect: 'water', mode: 'stop', ms: 900 } as never))).toEqual([expect.stringContaining("'statue'는 화면 JSON")]);
      expect(fxProblems((s) => (s.anims!['basket.water_off'] = { effect: 'water', mode: 'stop', ms: [900] } as never))).toEqual([expect.stringContaining('양의 정수 하나')]);
      expect(fxProblems((s) => (s.anims!['basket.water_off'] = { effect: 'water', mode: 'stop', ms: 1600 } as never))).toEqual([expect.stringContaining('1600 > 1500')]);
      expect(fxProblems((s) => (s.anims!['basket.water_off'] = { effect: 'water', mode: 'stop', ms: 900, layer: 'front' } as never))).toEqual([expect.stringContaining("모르는 필드 'layer'")]);
    });
  });
});

describe('머리 위 anim `anchor`(16절, 개정 12, #901)', () => {
  // 빨래방 ★① 양말처럼: 평소 안 보이는 장식 물건 `sock`을 까치 대상 anim이 ズッシー(mukjik) 머리 위에 그린다.
  const [OX, OY] = ANCHOR_ORIGIN;
  const withHead = (s: SceneSrc) => {
    s.objects!.sock = { ids: [], draw: null };
    s.anims!['magpie.sock_on'] = { object: 'sock', anchor: { char: 'mukjik', point: 'head' }, ms: 80, hold: true, frames: [box(OX - 8, OY - 16, 16, 8), box(OX - 8, OY - 8, 16, 8)] };
  };
  it('정상: 장식 default null, anim에 anchor·front, 칸 at은 얼굴 상자 위 가운데 기준 상대 좌표', () => {
    const s = goodScene();
    withHead(s);
    const r = buildScene(s, screen);
    expect(r.problems).toEqual([]);
    expect(r.meta!.objects.find((o) => o.key === 'sock')).toMatchObject({ ids: [], default: { frame: null, layer: 'back' } });
    const a = r.meta!.anims['magpie.sock_on']!;
    expect(a).toMatchObject({ object: 'sock', anchor: { char: 'mukjik', point: 'head' }, layer: 'front', hold: true });
    expect(a.frames.map((f) => r.meta!.frames[f]!.at)).toEqual([[-8, -16], [-8, -8]]);
    expect(r.meta!.anims['magpie.fly_down']!.anchor).toBeUndefined();
  });
  it('제자리 칸과 픽셀·자리가 같아도 합치지 않는다(at 뜻이 다르다)', () => {
    const s = goodScene();
    s.anims!['magpie.on_head'] = { object: 'nest', anchor: { char: 'jjuk', point: 'head' }, ms: 80, frames: [box(130, 34, 30, 16)] };
    const r = buildScene(s, screen);
    expect(r.problems).toEqual([]);
    const rest = r.meta!.objects.find((o) => o.key === 'nest')!.default.frame!;
    const head = r.meta!.anims['magpie.on_head']!.frames[0]!;
    expect(head).not.toBe(rest);
    expect(r.meta!.frames[head]!.at).toEqual([130 - OX, 34 - OY]);
  });
  it('캐릭터 ID·point·layer·tilt를 잡는다', () => {
    const anchorOf = (s: SceneSrc) => s.anims!['magpie.sock_on']!;
    expect(problemsOf((s) => { withHead(s); anchorOf(s).anchor = { char: 'nobby', point: 'head' }; })).toEqual([expect.stringContaining("'nobby'는 캐릭터 ID가 아니다")]);
    expect(problemsOf((s) => { withHead(s); anchorOf(s).anchor = { char: 'ppik', point: 'foot' }; })).toEqual([expect.stringContaining("'head'만 된다")]);
    expect(problemsOf((s) => { withHead(s); anchorOf(s).layer = 'back'; })).toEqual([expect.stringContaining('front만 된다')]);
    expect(problemsOf((s) => { withHead(s); (anchorOf(s).anchor as Record<string, unknown>).side = 1; })).toEqual([expect.stringContaining("모르는 필드 'side'")]);
  });
  it('draw null default는 장식 물건만, loop는 못 둔다', () => {
    expect(problemsOf((s) => (s.objects!.nest!.draw = null))).toEqual([expect.stringContaining('draw가 함수가 아니다')]);
    expect(problemsOf((s) => { withHead(s); s.objects!.sock!.loop = { ms: 100, frames: [box(10, 10, 4, 4)] }; })).toEqual([expect.stringContaining('loop를 둘 수 없다')]);
  });
  it('빌드의 캐릭터 ID 표가 core CHARACTERS와 같다', () => {
    expect(ANCHOR_CHARS).toEqual(CHARACTERS.map((c) => c.id));
  });
});
