import { describe, expect, it } from 'vitest';
import screenJson from '../../content/screens/magpie_nest.json';
import texts from '../../content/text/ja.json';
import { characterDef, characterFaceBox, characterHitBox, CHARACTERS, type CharacterId } from './characters';
import type { HitBox } from './hit';
import { CHAR_SLOTS, HUD_AREA } from './hud';
import { hitTest } from './hit';
import { hotspotNameId, hudTargets, labelText, resolveTap, tap, targetIntent, worldTargets, type TapContext, type UiState } from './interact';
import { initialState, step } from './puzzle/step';
import type { PuzzleState, ScreenData } from './puzzle/types';
import { HUD_BOX } from './puzzle/validate';
import type { Point } from './viewport';

const screen = screenJson as unknown as ScreenData;
const FLOOR_AT: Record<CharacterId, Point> = { jjuk: { x: 360, y: 244 }, mukjik: { x: 400, y: 244 }, ppik: { x: 440, y: 244 } };

/** 퍼즐 상태대로 몸 박스를 만든다. 바닥 캐릭터는 시작 좌표(magpie_nest.md 1-2). */
function ctxFor(puzzle: PuzzleState, s: ScreenData = screen): TapContext {
  const bodies = {} as Record<CharacterId, HitBox>;
  const faces = {} as Record<CharacterId, HitBox>;
  for (const c of CHARACTERS) {
    const spot = s.spots[puzzle.at[c.id]];
    const at = spot && !spot.free ? { x: spot.x, y: spot.y } : FLOOR_AT[c.id];
    bodies[c.id] = characterHitBox(characterDef(c.id), at.x, at.y, 1);
    faces[c.id] = characterFaceBox(characterDef(c.id), at.x, at.y, 1);
  }
  return { screen: s, puzzle, bodies, faces };
}

function puzzleWith(at: Partial<PuzzleState['at']>, flags: Record<string, boolean> = {}, items: string[] = []): PuzzleState {
  const p = initialState(screen);
  return { ...p, at: { ...p.at, ...at }, flags: { ...p.flags, ...flags }, items };
}

const ui = (active: CharacterId): UiState => ({ active, selected: null });
const center = (b: HitBox): Point => ({ x: b.left + b.width / 2, y: b.top + b.height / 2 });

describe('기본 탭 동사 (설계 2절)', () => {
  it('서는 자리에 내가 없으면 올라서기(move), 서 있으면 내 능력', () => {
    const p0 = puzzleWith({});
    const r0 = resolveTap(ctxFor(p0), ui('jjuk'), { x: 269, y: 208 }, 0);
    expect(r0).toMatchObject({ kind: 'act', action: { char: 'jjuk', verb: 'move', target: 'seesaw_right' }, label: { verb: 'climb' } });

    const p1 = puzzleWith({ jjuk: 'seesaw_right' });
    const r1 = resolveTap(ctxFor(p1), ui('jjuk'), { x: 269, y: 208 }, 0);
    expect(r1).toMatchObject({ kind: 'act', action: { char: 'jjuk', verb: 'stretch', target: 'seesaw_right' }, label: { verb: 'stretch' } });
  });

  it('특기 자리(6-4-1c, #723): 묵직이 × 시소 끝은 첫 클릭부터 쿵, 쭉이·삑삑이는 올라서기', () => {
    const t = (id: string): string => (texts as Record<string, string>)[id] ?? id;
    const ctx = ctxFor(puzzleWith({}));
    const ends = [
      ['seesaw_left', { x: 227, y: 208 }, 'シーソーの左端をドスン'],
      ['seesaw_right', { x: 269, y: 208 }, 'シーソーの右端をドスン'],
    ] as const;
    for (const [spot, p, text] of ends) {
      const r = resolveTap(ctx, ui('mukjik'), p, 0);
      expect(r).toMatchObject({ kind: 'act', action: { char: 'mukjik', verb: 'stomp', target: spot }, label: { verb: 'stomp', target: spot } });
      if (r.kind !== 'act') throw new Error('unreachable');
      expect(labelText(r.label, 'magpie_nest', t)).toBe(text);
      for (const other of ['jjuk', 'ppik'] as const) {
        expect(resolveTap(ctx, ui(other), p, 0)).toMatchObject({ kind: 'act', action: { char: other, verb: 'move', target: spot }, label: { verb: 'climb' } });
      }
    }
    // 남이 선 끝의 빈 부분도 묵직이면 쿵(규칙 seesaw_end_taken). 몸이 안 가리는 끝 아래쪽 귀퉁이를 누른다.
    const taken = ctxFor(puzzleWith({ jjuk: 'seesaw_right' }));
    const corner = { x: 286, y: 218 };
    expect(hitTest(worldTargets(taken, ui('mukjik')), corner, 0)?.id).toBe('spot:seesaw_right');
    expect(resolveTap(taken, ui('mukjik'), corner, 0)).toMatchObject({ kind: 'act', action: { char: 'mukjik', verb: 'stomp', target: 'seesaw_right' } });
  });

  it('특기 자리 판정은 자리 hintAbility만 본다: 지우면 묵직이도 올라선다', () => {
    const spots = { ...screen.spots, seesaw_right: { ...screen.spots.seesaw_right!, hintAbility: undefined } };
    const s = { ...screen, spots } as ScreenData;
    const r = resolveTap(ctxFor(puzzleWith({}), s), ui('mukjik'), { x: 269, y: 208 }, 0);
    expect(r).toMatchObject({ kind: 'act', action: { char: 'mukjik', verb: 'move', target: 'seesaw_right' } });
  });

  it('시소 끝을 가린 내 몸을 눌러도 쿵(몸 아래쪽 = 끝 상자 안)', () => {
    const ctx = ctxFor(puzzleWith({ mukjik: 'seesaw_right' }));
    const p = { x: 280, y: 205 }; // 묵직이 몸 안 + 오른쪽 끝(250~288) 안
    expect(ctx.bodies.mukjik.left).toBeLessThanOrEqual(p.x);
    expect(resolveTap(ctx, ui('mukjik'), p, 0)).toMatchObject({ kind: 'act', action: { verb: 'stomp', target: 'seesaw_right' } });
  });

  it('바닥에선 지금 캐릭터 몸이 히트 대상에서 빠진다: 내 몸을 누르면 그 점으로 걷기', () => {
    const ctx = ctxFor(puzzleWith({}));
    let checked = 0;
    for (const c of CHARACTERS) {
      expect(worldTargets(ctx, ui(c.id)).some((t) => t.id === `char:${c.id}`)).toBe(false);
      const b = ctx.bodies[c.id];
      const p = { x: b.left + b.width / 2, y: b.top + b.height - 6 }; // 몸 아래쪽(남의 얼굴 상자와 안 겹치는 쪽)
      if (hitTest(worldTargets(ctx, ui(c.id)), p, 0)) continue;
      expect(resolveTap(ctx, ui(c.id), p, 0)).toEqual({ kind: 'walk', to: p, label: { verb: 'walk', target: null } });
      checked++;
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('hold 예외: 매달린 내 몸은 대상으로 남고, 누르면 아무 일 없음(이름 라벨)', () => {
    const ctx = ctxFor(puzzleWith({ jjuk: 'hook' }));
    const r = resolveTap(ctx, ui('jjuk'), { x: 160, y: 140 }, 0);
    expect(r).toEqual({ kind: 'none', label: { verb: null, target: 'jjuk' } });
  });

  it('hold 자리(고리)를 바닥에서 누르면 move가 아니라 내 능력(설계 2절, PR #115)', () => {
    const ctx = ctxFor(puzzleWith({}));
    const hook = { x: 162, y: 96 }; // 고리 box [150, 84, 24, 24] 중심
    const cases = [
      ['jjuk', 'stretch', '柱のフックまでのばす'],
      ['mukjik', 'stomp', '柱のフックをドスン'],
      ['ppik', 'squeak', '柱のフックにプピッ'],
    ] as const;
    for (const [char, verb, text] of cases) {
      const r = resolveTap(ctx, ui(char), hook, 0);
      expect(r).toMatchObject({ kind: 'act', action: { char, verb, target: 'hook' }, label: { verb, target: 'hook' } });
      if (r.kind !== 'act') throw new Error('unreachable');
      expect(labelText(r.label, 'magpie_nest', (id) => (texts as Record<string, string>)[id] ?? id)).toBe(text);
    }
  });

  it('다른 캐릭터 몸은 그 뒤 서는 자리보다 앞: 전환', () => {
    const ctx = ctxFor(puzzleWith({ jjuk: 'seesaw_left' }));
    expect(resolveTap(ctx, ui('mukjik'), { x: 225, y: 205 }, 0)).toMatchObject({ kind: 'switch', char: 'jjuk' });
  });

  it('핫스팟은 내 능력. variants 박스를 따른다', () => {
    const top = puzzleWith({});
    expect(resolveTap(ctxFor(top), ui('ppik'), { x: 146, y: 18 }, 0)).toMatchObject({
      kind: 'act',
      action: { char: 'ppik', verb: 'squeak', target: 'magpie' },
    });
    const ground = puzzleWith({}, { 'magpie.on_ground': true });
    expect(resolveTap(ctxFor(ground), ui('jjuk'), { x: 100, y: 224 }, 0)).toMatchObject({
      action: { verb: 'stretch', target: 'magpie' },
    });
    expect(resolveTap(ctxFor(ground), ui('jjuk'), { x: 146, y: 18 }, 0).kind).toBe('walk');
  });

  it('바닥: 바닥에 있으면 엔진 걷기, 시소 위면 move floor(걷기), 매달렸으면 move floor(손 놓기)', () => {
    const p = { x: 300, y: 240 };
    expect(resolveTap(ctxFor(puzzleWith({})), ui('jjuk'), p, 0)).toEqual({ kind: 'walk', to: p, label: { verb: 'walk', target: null } });
    expect(resolveTap(ctxFor(puzzleWith({ jjuk: 'seesaw_left' })), ui('jjuk'), p, 0)).toMatchObject({
      kind: 'act',
      action: { verb: 'move', target: 'floor' },
      to: p,
      label: { verb: 'walk' },
    });
    expect(resolveTap(ctxFor(puzzleWith({ jjuk: 'hook' })), ui('jjuk'), p, 0)).toMatchObject({
      kind: 'act',
      action: { verb: 'move', target: 'floor' },
      label: { verb: 'release' },
    });
  });
});

// 여기 TapContext에는 그린 칸(`drawn`)이 없다: 시트 알파를 아직 못 읽은 경우(2-1절 #736)라 11/19 규칙 그대로다.
// 알파가 있을 때(몸통·다리 = 전환)는 tests/art/drawn-body.test.ts가 커밋된 PNG로 본다.
describe('바닥에 선 동료는 얼굴로 고른다 (설계 2-1절, #427, 그린 칸 없음)', () => {
  const start = puzzleWith({});
  const others = (me: CharacterId): CharacterId[] => CHARACTERS.map((c) => c.id).filter((id) => id !== me);
  const SLOPS = [0, 8] as const;

  it('얼굴 상자 = 시트 head를 발 위치에 놓은 24×24 (2-1절 표, 발 400,244)', () => {
    const at = (id: CharacterId) => characterFaceBox(characterDef(id), 400, 244, 1);
    expect(at('jjuk')).toEqual({ left: 388, top: 180, width: 24, height: 24 });
    expect(at('mukjik')).toEqual({ left: 385, top: 182, width: 24, height: 24 });
    expect(at('ppik')).toEqual({ left: 387, top: 195, width: 24, height: 24 });
  });

  it('왼쪽을 보면 몸 상자처럼 기준점 축으로 뒤집는다', () => {
    for (const c of CHARACTERS) {
      const r = characterFaceBox(c, 400, 244, 1);
      const l = characterFaceBox(c, 400, 244, -1);
      // 오른쪽 볼 때 기준점에서 왼끝까지 거리 = 왼쪽 볼 때 오른끝까지 거리
      expect(400 - r.left).toBe(l.left + l.width - 400);
      expect(l.top).toBe(r.top);
    }
  });

  it('2-1-1 표의 실제 좌표: 쭉이로 동료 발 옆 땅 = 걷기, 얼굴 = 전환 (마우스·터치)', () => {
    const ctx = ctxFor(start);
    for (const slop of SLOPS) {
      for (const p of [{ x: 414, y: 240 }, { x: 455, y: 232 }, { x: 430, y: 246 }, { x: 423, y: 236 }, { x: 380, y: 250 }]) {
        expect(resolveTap(ctx, ui('jjuk'), p, slop), `${p.x},${p.y} slop ${slop}`).toMatchObject({ kind: 'walk', label: { verb: 'walk' } });
      }
      expect(resolveTap(ctx, ui('jjuk'), { x: 400, y: 200 }, slop)).toMatchObject({ kind: 'switch', char: 'mukjik' });
      expect(resolveTap(ctx, ui('jjuk'), { x: 440, y: 212 }, slop)).toMatchObject({ kind: 'switch', char: 'ppik' });
    }
  });

  it('2-1-3 ①: 지금 캐릭터 셋 × 다른 두 사람 × 발 근처 땅(그림 옆·앞) = 걷기', () => {
    const ctx = ctxFor(start);
    for (const me of CHARACTERS.map((c) => c.id)) {
      for (const other of others(me)) {
        const body = ctx.bodies[other];
        const foot = FLOOR_AT[other];
        const ground: Point[] = [
          { x: body.left - 1, y: foot.y - 4 }, // 그림 왼쪽 옆
          { x: body.left + body.width, y: foot.y - 4 }, // 그림 오른쪽 옆
          { x: foot.x, y: foot.y + 4 }, // 발 앞
          { x: foot.x, y: foot.y - 8 }, // 다리 위(지금이면 몸 안)
        ];
        for (const slop of SLOPS) {
          for (const p of ground) {
            const r = resolveTap(ctx, ui(me), p, slop);
            expect(r, `${me}→${other} ${p.x},${p.y} slop ${slop}`).toMatchObject({ kind: 'walk', to: p, label: { verb: 'walk', target: null } });
          }
        }
      }
    }
  });

  it('2-1-3 ②: 다른 두 사람의 얼굴 가운데 = 전환(라벨 = 이름), 마우스·터치 모두 1번', () => {
    const ctx = ctxFor(start);
    for (const me of CHARACTERS.map((c) => c.id)) {
      for (const other of others(me)) {
        const p = center(ctx.faces[other]);
        expect(resolveTap(ctx, ui(me), p, 0)).toEqual({ kind: 'switch', char: other, label: { verb: null, target: other } });
        const t = tap(ctx, ui(me), p, 8, true);
        expect(t.intent).toMatchObject({ kind: 'switch', char: other });
        expect(t.ui).toEqual({ active: other, selected: null });
      }
    }
  });

  it('2-1-3 ③: 몸통 가운데(얼굴 아래 끝 + 12px) = 전환 아님, 라벨이 결과와 같다', () => {
    const ctx = ctxFor(start);
    for (const me of CHARACTERS.map((c) => c.id)) {
      for (const other of others(me)) {
        const face = ctx.faces[other];
        const p = { x: face.left + face.width / 2, y: face.top + face.height + 12 };
        expect(p.y).toBeLessThan(ctx.bodies[other].top + ctx.bodies[other].height); // 몸 상자 안이다
        for (const slop of SLOPS) {
          const r = resolveTap(ctx, ui(me), p, slop);
          expect(r.kind, `${me}→${other} slop ${slop}`).not.toBe('switch');
          expect(r).toMatchObject({ kind: 'walk', label: { verb: 'walk', target: null } });
        }
      }
    }
  });

  it('2-1-3 ④: 시소 끝에 선 사람·고리에 매달린 사람은 몸 전체가 그대로 전환', () => {
    const onSeesaw = ctxFor(puzzleWith({ jjuk: 'seesaw_left' }));
    const b = onSeesaw.bodies.jjuk;
    const low = { x: b.left + b.width / 2, y: b.top + b.height - 2 }; // 얼굴이 아니라 발 쪽
    expect(resolveTap(onSeesaw, ui('mukjik'), low, 0)).toMatchObject({ kind: 'switch', char: 'jjuk' });
    expect(worldTargets(onSeesaw, ui('mukjik')).find((t) => t.id === 'char:jjuk')?.box).toEqual(b);

    const onHook = ctxFor(puzzleWith({ ppik: 'hook' }));
    expect(worldTargets(onHook, ui('mukjik')).find((t) => t.id === 'char:ppik')?.box).toEqual(onHook.bodies.ppik);
  });

  it('바닥 동료는 얼굴 상자만 대상이다. 지금 캐릭터는 여전히 빠진다', () => {
    const ctx = ctxFor(start);
    const targets = worldTargets(ctx, ui('jjuk'));
    expect(targets.some((t) => t.id === 'char:jjuk')).toBe(false);
    expect(targets.find((t) => t.id === 'char:mukjik')?.box).toEqual(ctx.faces.mukjik);
    expect(targets.find((t) => t.id === 'char:ppik')?.box).toEqual(ctx.faces.ppik);
  });

  it('free 표시 없이 floor만 쓰는 화면에서도 바닥으로 본다(floorIntent와 같은 식)', () => {
    const noFree: ScreenData = { ...screen, spots: Object.fromEntries(Object.entries(screen.spots).filter(([id]) => id !== 'floor')) };
    const ctx = ctxFor(initialState(screen), noFree);
    expect(worldTargets(ctx, ui('jjuk')).find((t) => t.id === 'char:mukjik')?.box).toEqual(ctx.faces.mukjik);
  });
});

describe('고르고 누르기만 (설계 6-4절, #311)', () => {
  const seesaw = { x: 269, y: 208 };

  it('화면 1 정답 3번: 오른쪽 끝 클릭 1번 = 쿵(6-4-1c #723). 서 있어도 쿵', () => {
    const before = resolveTap(ctxFor(puzzleWith({ jjuk: 'seesaw_left' })), ui('mukjik'), seesaw, 0);
    expect(before).toMatchObject({ kind: 'act', action: { char: 'mukjik', verb: 'stomp', target: 'seesaw_right' }, label: { verb: 'stomp' } });
    const after = resolveTap(ctxFor(puzzleWith({ jjuk: 'seesaw_left', mukjik: 'seesaw_right' })), ui('mukjik'), seesaw, 0);
    expect(after).toMatchObject({ kind: 'act', action: { char: 'mukjik', verb: 'stomp', target: 'seesaw_right' }, label: { verb: 'stomp' } });
  });

  it('남이 선 끝: 몸을 누르면 전환, 몸 밖은 올라서기뿐. 특기 자리면 내 특기(6-4-4절, 6-4-1c)', () => {
    const ctx = ctxFor(puzzleWith({ jjuk: 'seesaw_left' }));
    expect(resolveTap(ctx, ui('mukjik'), { x: 225, y: 205 }, 0)).toMatchObject({ kind: 'switch', char: 'jjuk' });
    let seen = 0;
    for (let x = 200; x < 250; x += 3) {
      const ppik = resolveTap(ctx, ui('ppik'), { x, y: 208 }, 0);
      if (ppik.kind === 'act' && ppik.action.target === 'seesaw_left') expect(ppik.action.verb).toBe('move');
      const muk = resolveTap(ctx, ui('mukjik'), { x, y: 208 }, 0);
      if (muk.kind === 'act' && muk.action.target === 'seesaw_left') {
        expect(muk.action.verb).toBe('stomp'); // 규칙 seesaw_end_taken_left(…どいて。)
        seen++;
      }
    }
    expect(seen).toBeGreaterThan(0);
  });

  it('UI로는 hand·look·item 행동이 나오지 않는다(화면 전체 점, 세 캐릭터, 여러 상태)', () => {
    const states = [
      puzzleWith({}),
      puzzleWith({ jjuk: 'seesaw_left' }),
      puzzleWith({ jjuk: 'hook' }, {}, ['item.shop_key']),
      puzzleWith({}, { 'magpie.on_ground': true }),
    ];
    for (const p of states) {
      for (const c of CHARACTERS) {
        for (let x = 0; x < 480; x += 6) {
          for (let y = 0; y < 270; y += 6) {
            const r = resolveTap(ctxFor(p), ui(c.id), { x, y }, 8);
            if (r.kind === 'act') expect(['move', c.ability]).toContain(r.action.verb);
          }
        }
      }
    }
  });
});

describe('HUD (설계 6-4-2절)', () => {
  const ctx = ctxFor(puzzleWith({}));

  it('얼굴 칸 = 전환(선택 풀림), 지금 캐릭터 칸 = 아무 일 없음', () => {
    const r = tap(ctx, { active: 'jjuk', selected: 'jjuk|move|seesaw_left|' }, center(CHAR_SLOTS.mukjik), 0, false);
    expect(r.intent).toMatchObject({ kind: 'switch', char: 'mukjik' });
    expect(r.ui).toEqual({ active: 'mukjik', selected: null });
    expect(resolveTap(ctx, ui('jjuk'), center(CHAR_SLOTS.jjuk), 0).kind).toBe('none');
  });

  it('HUD 대상은 얼굴 3칸뿐(아이템 칸은 M2)', () => {
    expect(hudTargets().map((t) => t.id)).toEqual(['char.jjuk', 'char.mukjik', 'char.ppik']);
  });

  it('칸 사이 틈·얼굴 아래 이름표 띠(y 36–47)를 눌러도 걷지 않는다', () => {
    for (const p of [{ x: 330, y: 20 }, { x: 314, y: 36 }, { x: 346, y: 42 }, { x: 378, y: 47 }]) {
      expect(resolveTap(ctx, ui('jjuk'), p, 0)).toEqual({ kind: 'none', label: null });
    }
  });

  it('옛 버튼 자리(y 48–76)와 오른쪽(x 392–)은 이제 하늘이라 바닥 걷기', () => {
    for (const p of [{ x: 314, y: 50 }, { x: 418, y: 50 }, { x: 440, y: 20 }]) expect(resolveTap(ctx, ui('jjuk'), p, 0).kind).toBe('walk');
  });

  it('HUD 영역은 validate.ts의 HUD_BOX 안에 있다(HUD_BOX는 코어라 넓게 둔다, 6-4-2절)', () => {
    const [hx, hy, hw, hh] = HUD_BOX;
    expect(HUD_AREA.left).toBeGreaterThanOrEqual(hx);
    expect(HUD_AREA.top).toBeGreaterThanOrEqual(hy);
    expect(HUD_AREA.left + HUD_AREA.width).toBeLessThanOrEqual(hx + hw);
    expect(HUD_AREA.top + HUD_AREA.height).toBeLessThanOrEqual(hy + hh);
  });
});

describe('터치 탭 2번 (설계 4절)', () => {
  const ctx = ctxFor(puzzleWith({}));
  const seesaw = { x: 269, y: 208 };

  it('step 행동: 첫 탭 = 선택, 같은 행동 다시 탭 = 실행. 마우스는 1번', () => {
    const a = tap(ctx, ui('jjuk'), seesaw, 8, true);
    expect(a.intent).toMatchObject({ kind: 'select', label: { verb: 'climb', target: 'seesaw_right' } });
    const b = tap(ctx, a.ui, seesaw, 8, true);
    expect(b.intent).toMatchObject({ kind: 'act', action: { verb: 'move', target: 'seesaw_right' } });
    expect(b.ui.selected).toBeNull();
    expect(tap(ctx, ui('jjuk'), seesaw, 0, false).intent.kind).toBe('act');
  });

  it('다른 대상을 탭하면 선택이 옮겨 가고, 바닥 걷기는 선택을 푼다', () => {
    const a = tap(ctx, ui('mukjik'), seesaw, 8, true);
    const b = tap(ctx, a.ui, { x: 227, y: 208 }, 8, true);
    expect(b.intent).toMatchObject({ kind: 'select', label: { target: 'seesaw_left' } });
    const c = tap(ctx, b.ui, { x: 300, y: 240 }, 8, true);
    expect(c.intent.kind).toBe('walk');
    expect(c.ui.selected).toBeNull();
  });

  it('올라선 뒤 같은 끝은 다른 행동이라 다시 선택부터(쭉이: 올라섬 → 뻗기, 6-4-1절)', () => {
    const a = tap(ctx, ui('jjuk'), seesaw, 8, true);
    const b = tap(ctx, a.ui, seesaw, 8, true);
    expect(b.intent).toMatchObject({ kind: 'act', action: { verb: 'move' } });
    const on = ctxFor(puzzleWith({ jjuk: 'seesaw_right' }));
    const c = tap(on, b.ui, seesaw, 8, true);
    expect(c.intent).toMatchObject({ kind: 'select', label: { verb: 'stretch' } });
    expect(tap(on, c.ui, seesaw, 8, true).intent).toMatchObject({ kind: 'act', action: { verb: 'stretch', target: 'seesaw_right' } });
  });

  it('정답 3번 터치 = 2번(선택·쿵, 6-4-1c #723)', () => {
    const a = tap(ctx, ui('mukjik'), seesaw, 8, true);
    expect(a.intent).toMatchObject({ kind: 'select', label: { verb: 'stomp', target: 'seesaw_right' } });
    expect(tap(ctx, a.ui, seesaw, 8, true).intent).toMatchObject({ kind: 'act', action: { char: 'mukjik', verb: 'stomp', target: 'seesaw_right' } });
  });

  it('매달린 캐릭터의 손 놓기는 터치에서 2번, 전환·걷기는 1번', () => {
    const hang = ctxFor(puzzleWith({ jjuk: 'hook' }));
    const a = tap(hang, ui('jjuk'), { x: 300, y: 240 }, 8, true);
    expect(a.intent).toMatchObject({ kind: 'select', label: { verb: 'release' } });
    expect(tap(hang, a.ui, { x: 310, y: 250 }, 8, true).intent).toMatchObject({ kind: 'act', action: { verb: 'move', target: 'floor' } });
    expect(tap(hang, ui('jjuk'), center(CHAR_SLOTS.ppik), 8, true).intent.kind).toBe('switch');
  });
});

describe('서 있는 내 몸 = 내가 선 자리 (설계 6-4-1b절, #630 2단계)', () => {
  const onRight = puzzleWith({ jjuk: 'seesaw_left', mukjik: 'seesaw_right' });

  it('Mia 4회차 7번: 묵직이 오른쪽 끝에 선 뒤 머리 쪽(끝 상자 위)을 누르면 쿵, 걸어 내려오지 않는다', () => {
    const ctx = ctxFor(onRight);
    const b = ctx.bodies.mukjik;
    const head = { x: b.left + b.width / 2, y: b.top + 8 };
    expect(head.y).toBeLessThan(196); // 끝 box(y 196~220) 위: 예전엔 아무것도 안 맞아 move floor였다
    const r = resolveTap(ctx, ui('mukjik'), head, 0);
    expect(r).toEqual(targetIntent(ctx, 'mukjik', { kind: 'spot', ref: 'seesaw_right' }, head));
    expect(r).toMatchObject({ kind: 'act', action: { char: 'mukjik', verb: 'stomp', target: 'seesaw_right' }, label: { verb: 'stomp', target: 'seesaw_right' } });
    // 몸 전체 어디를 눌러도(남에게 안 가린 점) 걷기가 나오지 않는다
    for (let x = b.left; x < b.left + b.width; x += 2) {
      for (let y = b.top; y < b.top + b.height; y += 2) {
        const hit = hitTest(worldTargets(ctx, ui('mukjik')), { x, y }, 0);
        if (hit?.id !== 'char:mukjik') continue;
        expect(resolveTap(ctx, ui('mukjik'), { x, y }, 0), `${x},${y}`).toMatchObject({ kind: 'act', action: { verb: 'stomp' } });
      }
    }
  });

  it('누구든 끝에 서 있으면 내 몸 = 그 끝에 내 능력(쭉이 → stretch, 삑삑이 → squeak)', () => {
    for (const [c, spot] of [['jjuk', 'seesaw_left'], ['ppik', 'seesaw_right'], ['mukjik', 'seesaw_left']] as const) {
      const ctx = ctxFor(puzzleWith({ [c]: spot }));
      const b = ctx.bodies[c];
      const head = { x: b.left + b.width / 2, y: b.top + 4 };
      expect(resolveTap(ctx, ui(c), head, 0)).toMatchObject({ kind: 'act', action: { char: c, verb: characterDef(c).ability, target: spot } });
    }
  });

  it('호버 라벨도 그 자리 라벨 그대로: シーソーの右端をドスン', () => {
    const tt = (id: string): string => (texts as Record<string, string>)[id] ?? id;
    const ctx = ctxFor(onRight);
    const r = resolveTap(ctx, ui('mukjik'), { x: center(ctx.bodies.mukjik).x, y: ctx.bodies.mukjik.top + 8 }, 0);
    expect(r.kind === 'act' && labelText(r.label, 'magpie_nest', tt)).toBe(tt('ui.label.stomp').replace('{target}', tt('magpie_nest.name.seesaw_right')));
  });

  it('남의 몸이 겹치면 남이 이긴다(전환 우선). 그리는 순서와 무관', () => {
    const base = ctxFor(onRight);
    const m = base.bodies.mukjik;
    const overlap = { ...base, bodies: { ...base.bodies, jjuk: { ...m, left: m.left - 10 } } };
    const p = { x: m.left + 4, y: m.top + 10 };
    for (const order of [['jjuk', 'mukjik', 'ppik'], ['mukjik', 'jjuk', 'ppik']] as const) {
      expect(resolveTap({ ...overlap, order }, ui('mukjik'), p, 0)).toMatchObject({ kind: 'switch', char: 'jjuk' });
    }
  });

  it('터치: 몸과 끝은 같은 행동이라 몸 → 끝, 끝 → 몸 어느 순서로 두 번 눌러도 실행', () => {
    const ctx = ctxFor(onRight);
    const head = { x: center(ctx.bodies.mukjik).x, y: ctx.bodies.mukjik.top + 8 };
    const end = { x: 256, y: 208 }; // 오른쪽 끝 상자 안, 묵직이 몸 왼쪽 밖
    expect(hitTest(worldTargets(ctx, ui('mukjik')), end, 8)?.id).toBe('spot:seesaw_right');
    for (const [a, b] of [[head, end], [end, head]] as const) {
      const first = tap(ctx, ui('mukjik'), a, 8, true);
      expect(first.intent.kind).toBe('select');
      expect(tap(ctx, first.ui, b, 8, true).intent).toMatchObject({ kind: 'act', action: { verb: 'stomp', target: 'seesaw_right' } });
    }
  });

  it('매달림(hold)은 그대로 아무 일 없음, box 없는 자리(화면 2 fountain_seat)는 몸을 대상으로 넣지 않는다', () => {
    const hang = ctxFor(puzzleWith({ jjuk: 'hook' }));
    expect(resolveTap(hang, ui('jjuk'), center(hang.bodies.jjuk), 0)).toEqual({ kind: 'none', label: { verb: null, target: 'jjuk' } });
    const seat: ScreenData = { ...screen, spots: { ...screen.spots, seat: { x: 300, y: 200, capacity: 3 } as ScreenData['spots'][string] } };
    const ctx = ctxFor({ ...puzzleWith({}), at: { ...puzzleWith({}).at, mukjik: 'seat' } }, seat);
    expect(worldTargets(ctx, ui('mukjik')).some((t) => t.id === 'char:mukjik')).toBe(false);
  });
});

describe('targetIntent = resolveTap이 히트 뒤에 부르는 판정 (#476 리뷰 후속)', () => {
  it('대상 상자 중심을 누르면 resolveTap과 targetIntent가 같다(그 대상이 맞을 때)', () => {
    const states = [puzzleWith({}), puzzleWith({ mukjik: 'seesaw_right' }), puzzleWith({ jjuk: 'hook' }), puzzleWith({ jjuk: 'seesaw_left' })];
    let checked = 0;
    for (const p of states) {
      const ctx = ctxFor(p);
      for (const c of CHARACTERS) {
        const targets = worldTargets(ctx, ui(c.id));
        for (const t of targets) {
          if (t.kind === 'char') continue;
          const pt = center(t.box);
          if (hitTest(targets, pt, 0)?.id !== t.id) continue; // 다른 대상에 가려진 중심은 입력층 몫
          expect(resolveTap(ctx, ui(c.id), pt, 0)).toEqual(targetIntent(ctx, c.id, { kind: t.kind, ref: t.ref }, pt));
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(20);
  });

  it('바닥(맞는 대상 없음)은 targetIntent(null)과 같다: 걷기 / 내려오기 / 손 놓기', () => {
    const pt = { x: 300, y: 240 };
    for (const p of [puzzleWith({}), puzzleWith({ mukjik: 'seesaw_right' }), puzzleWith({ jjuk: 'hook' })]) {
      const ctx = ctxFor(p);
      for (const c of CHARACTERS) {
        if (hitTest(worldTargets(ctx, ui(c.id)), pt, 0)) continue;
        expect(resolveTap(ctx, ui(c.id), pt, 0)).toEqual(targetIntent(ctx, c.id, null, pt));
      }
    }
    expect(targetIntent(ctxFor(puzzleWith({ jjuk: 'hook' })), 'jjuk', null, pt)).toMatchObject({ kind: 'act', label: { verb: 'release' } });
  });
});

describe('원칙 1: 규칙 데이터를 읽지 않는다', () => {
  it('rules·fallbacks·solution에 손대면 실패하는 화면으로도 같은 판정', () => {
    const guarded = new Proxy(screen, {
      get(target, key, receiver) {
        if (key === 'rules' || key === 'fallbacks' || key === 'solution') throw new Error(`UI가 ${String(key)}를 읽었다`);
        return Reflect.get(target, key, receiver) as unknown;
      },
    });
    const p = puzzleWith({ jjuk: 'seesaw_left' }, {}, ['item.shop_key']);
    const points: Point[] = [];
    for (let x = 0; x < 480; x += 7) for (let y = 0; y < 270; y += 7) points.push({ x, y });
    for (const c of CHARACTERS) {
      for (const pt of points) {
        expect(resolveTap(ctxFor(p, guarded), ui(c.id), pt, 8)).toEqual(resolveTap(ctxFor(p), ui(c.id), pt, 8));
      }
    }
  });
});

describe('라벨 문구 (설계 7절)', () => {
  const t = (id: string): string => (texts as Record<string, string>)[id] ?? id;
  it('동사: 대상 / 이름만 / 대상 없는 동사', () => {
    expect(labelText({ verb: 'climb', target: 'seesaw_right' }, 'magpie_nest', t)).toBe('シーソーの右端にのる');
    expect(labelText({ verb: 'stretch', target: 'nest' }, 'magpie_nest', t)).toBe('カササギの巣までのばす');
    expect(labelText({ verb: null, target: 'mukjik' }, 'magpie_nest', t)).toBe('ズッシー');
    expect(labelText({ verb: 'release', target: null }, 'magpie_nest', t)).toBe('手をはなす');
    expect(labelText({ verb: 'item', target: 'basket', item: 'item.shop_key' }, 'magpie_nest', t)).toBe('洗濯かごに店のカギを使う');
  });

  it('대상이 있는 동사는 전부 `<이름><조사><동사>` 패턴이 있다(#703, `: ` 없음)', () => {
    const tx = texts as Record<string, string>;
    for (const verb of ['climb', 'stretch', 'stomp', 'squeak', 'hand', 'look', 'item'] as const) {
      const p = tx[`ui.label.${verb}`];
      expect(p, verb).toBeDefined();
      expect(p!.startsWith('{target}'), `${verb} ${p}`).toBe(true);
      expect(p!.split('{target}'), verb).toHaveLength(2);
      expect(p!.includes('{item}'), verb).toBe(verb === 'item');
      expect(p, verb).not.toContain(':');
      // 끝말은 동사 이름표와 같다: 선 뒤 のる → ドスン 바뀜이 끝말로 보인다(6-4-1절).
      if (verb !== 'item') expect(p!.endsWith(tx[`ui.verb.${verb}`]!), `${verb} ${p}`).toBe(true);
    }
    expect(labelText({ verb: 'hand', target: 'basket' }, 'magpie_nest', t)).toBe('洗濯かごにさわる');
    expect(labelText({ verb: 'squeak', target: 'magpie' }, 'magpie_nest', t)).toBe('カササギにプピッ');
  });

  it('화면 1의 모든 대상에 이름이 있다', () => {
    for (const id of [...Object.keys(screen.hotspots), ...Object.entries(screen.spots).filter(([, s]) => s.box).map(([id]) => id)]) {
      expect(texts, id).toHaveProperty([`magpie_nest.name.${id}`]);
    }
  });
});

describe('쭉이 손 1칸 입력 (ADR-1031 4절 표)', () => {
  // 작은 화면: 바닥(free) + 상자 있는 서는 자리 + 들 물건 양말 + 장치 건조기. 규칙은 step 확인용이다(판정은 규칙을 안 읽는다).
  const hs: ScreenData = {
    id: 'hands_input',
    spots: {
      floor: { x: 0, y: 240, free: true },
      stool: { x: 300, y: 220, box: [290, 200, 24, 24] },
    },
    hotspots: {
      sock: { box: [100, 220, 24, 16] },
      dryer: { box: [180, 150, 40, 48] },
    },
    flags: { 'dryer.loaded': false },
    start: { at: { jjuk: 'floor', mukjik: 'floor', ppik: 'floor' }, items: [] },
    exitFlag: 'dryer.loaded',
    rules: [
      { id: 'pick_sock', target: 'sock', verb: 'stretch', do: { pick: true } },
      { id: 'put_sock', target: 'sock', verb: 'item', when: { item: 'sock' }, do: { put: true } },
      { id: 'load_dryer', target: 'dryer', verb: 'item', when: { item: 'sock' }, do: { set: { 'dryer.loaded': true }, take: ['sock'] } },
    ],
    solution: [
      { char: 'jjuk', verb: 'stretch', target: 'sock' },
      { char: 'jjuk', verb: 'item', target: 'dryer', item: 'sock' },
    ],
  };
  const empty = initialState(hs);
  const holding = (at: Partial<PuzzleState['at']> = {}): PuzzleState => ({ ...empty, at: { ...empty.at, ...at }, hands: 'sock' });
  const tx = (id: string): string =>
    ({ 'hands_input.name.sock': '靴下', 'hands_input.name.dryer': '乾燥機', 'hands_input.name.stool': '台' } as Record<string, string>)[id] ??
    (texts as Record<string, string>)[id] ??
    id;
  const mid = (b: [number, number, number, number]): Point => ({ x: b[0] + b[2] / 2, y: b[1] + b[3] / 2 });

  it('빈손 쭉이 × 들 물건 = 장대(집기 규칙이 받는다)', () => {
    const r = resolveTap(ctxFor(empty, hs), ui('jjuk'), mid(hs.hotspots.sock!.box), 0);
    expect(r).toMatchObject({ kind: 'act', action: { char: 'jjuk', verb: 'stretch', target: 'sock' } });
    if (r.kind !== 'act') throw new Error('act');
    expect(step(hs, empty, r.action).state.hands).toBe('sock');
  });

  it('든 채로 쭉이 × 장치 = 든 물건 쓰기. 장대는 안 나간다', () => {
    const p = holding();
    const r = resolveTap(ctxFor(p, hs), ui('jjuk'), mid(hs.hotspots.dryer!.box), 0);
    expect(r).toMatchObject({ kind: 'act', action: { char: 'jjuk', verb: 'item', target: 'dryer', item: 'sock' } });
    if (r.kind !== 'act') throw new Error('act');
    expect(step(hs, p, r.action)).toMatchObject({ source: 'rule', ruleId: 'load_dryer' });
    expect(labelText(r.label, hs.id, tx)).toBe('乾燥機に靴下を使う');
  });

  it('든 채로 쭉이 × 서는 자리 = 든 물건 쓰기(올라서기 아님). 바닥은 든 채로 걷기', () => {
    const p = holding();
    expect(resolveTap(ctxFor(p, hs), ui('jjuk'), mid(hs.spots.stool!.box!), 0)).toMatchObject({
      kind: 'act',
      action: { char: 'jjuk', verb: 'item', target: 'stool', item: 'sock' },
    });
    expect(resolveTap(ctxFor(p, hs), ui('jjuk'), { x: 60, y: 246 }, 0).kind).toBe('walk');
  });

  it('든 물건은 화면 대상이 아니다: 제자리를 누르면 바닥 걷기, 라벨도 없다', () => {
    const p = holding();
    expect(worldTargets(ctxFor(p, hs), ui('jjuk')).map((t) => t.id)).not.toContain('hotspot:sock');
    expect(worldTargets(ctxFor(p, hs), ui('mukjik')).map((t) => t.id)).not.toContain('hotspot:sock');
    expect(resolveTap(ctxFor(p, hs), ui('jjuk'), mid(hs.hotspots.sock!.box), 0).kind).toBe('walk');
    expect(targetIntent(ctxFor(p, hs), 'jjuk', { kind: 'hotspot', ref: 'sock' }, { x: 0, y: 0 }).kind).toBe('none');
  });

  it('쭉이가 골라져 있고 free 자리면 쭉이 얼굴 칸 = 내려놓기(코어 내려놓기 모양, 걷지 않음)', () => {
    const p = holding();
    const r = resolveTap(ctxFor(p, hs), ui('jjuk'), center(CHAR_SLOTS.jjuk), 0);
    expect(r).toMatchObject({ kind: 'act', action: { char: 'jjuk', verb: 'item', target: 'sock', item: 'sock' }, to: null });
    if (r.kind !== 'act') throw new Error('act');
    const after = step(hs, p, r.action);
    expect(after.source).toBe('rule');
    expect(after.state.hands).toBeUndefined();
    expect(after.events.some((e) => e.type === 'walk')).toBe(false);
    expect(labelText(r.label, hs.id, tx)).toBe('靴下をおろす');
  });

  it('터치는 내려놓기도 2번(첫 탭 = 선택)', () => {
    const ctx = ctxFor(holding(), hs);
    const first = tap(ctx, ui('jjuk'), center(CHAR_SLOTS.jjuk), 0, true);
    expect(first.intent.kind).toBe('select');
    expect(tap(ctx, first.ui, center(CHAR_SLOTS.jjuk), 0, true).intent).toMatchObject({ kind: 'act', action: { target: 'sock' } });
  });

  it('free가 아닌 자리에 서 있으면 얼굴 칸은 그대로 아무 일 없음. 빈손이어도 그대로', () => {
    expect(resolveTap(ctxFor(holding({ jjuk: 'stool' }), hs), ui('jjuk'), center(CHAR_SLOTS.jjuk), 0).kind).toBe('none');
    expect(resolveTap(ctxFor(empty, hs), ui('jjuk'), center(CHAR_SLOTS.jjuk), 0).kind).toBe('none');
  });

  it('쭉이가 들고 있어도 다른 사람은 제 능력, 쭉이 얼굴 칸은 전환(손은 그대로)', () => {
    const p = holding();
    expect(resolveTap(ctxFor(p, hs), ui('mukjik'), mid(hs.hotspots.dryer!.box), 0)).toMatchObject({
      kind: 'act',
      action: { char: 'mukjik', verb: 'stomp', target: 'dryer' },
    });
    expect(resolveTap(ctxFor(p, hs), ui('mukjik'), center(CHAR_SLOTS.jjuk), 0)).toMatchObject({ kind: 'switch', char: 'jjuk' });
  });

  it('누를 수 있는 행동은 전부 step이 invalid로 버리지 않는 모양이다(화면 전체 점, 세 캐릭터, 빈손·든 손)', () => {
    for (const p of [empty, holding(), holding({ jjuk: 'stool' })]) {
      for (const c of CHARACTERS) {
        for (let x = 0; x < 480; x += 6) {
          for (let y = 0; y < 270; y += 6) {
            const r = resolveTap(ctxFor(p, hs), ui(c.id), { x, y }, 0);
            if (r.kind !== 'act') continue;
            // 바닥 move·장치 위 move처럼 규칙 없는 행동은 기본 이동·폴백이다. invalid만 아니면 된다.
            expect(step(hs, p, r.action).source, JSON.stringify(r.action)).not.toBe('invalid');
          }
        }
      }
    }
  });
});

describe('상태별 라벨 이름 (#1031, variants[].name)', () => {
  // 빨래방 v2 수건 모양: 바닥에 떨어진 뒤 젖으면 `ぬれたタオル`. 상자와 같은 첫 일치 변형에서 이름을 읽는다.
  const shop: Pick<ScreenData, 'hotspots'> = {
    hotspots: {
      towel: {
        box: [116, 40, 32, 36],
        variants: [
          { when: { flags: { 'towel.wet': true } }, box: [156, 236, 16, 12], name: 'towel_wet' },
          { when: { flags: { 'towel.down': true } }, box: [156, 236, 16, 12] },
        ],
      },
      gap: { box: [200, 240, 40, 12] },
    },
  };
  const tx: Record<string, string> = {
    'shop.name.towel': 'かわいたタオル',
    'shop.name.towel_wet': 'ぬれたタオル',
    'shop.name.gap': 'すきま',
    'ui.label.item': '{target}に{item}を使う',
    'ui.label.stretch': '{target}までのばす',
    'ui.verb.put': '{item}をおろす',
  };
  const t = (id: string): string => tx[id] ?? id;
  const state = (flags: Record<string, boolean>): PuzzleState => ({ flags, at: {}, items: [], gauge: 3 }) as unknown as PuzzleState;

  it('첫 일치 변형의 name, 없거나 안 맞으면 핫스팟 ID', () => {
    expect(hotspotNameId(shop, state({}), 'towel')).toBe('towel');
    expect(hotspotNameId(shop, state({ 'towel.down': true }), 'towel')).toBe('towel');
    expect(hotspotNameId(shop, state({ 'towel.down': true, 'towel.wet': true }), 'towel')).toBe('towel_wet');
    // 핫스팟이 아닌 ID(서는 자리·캐릭터)는 그대로.
    expect(hotspotNameId(shop, state({ 'towel.wet': true }), 'floor')).toBe('floor');
  });

  it('labelText는 대상과 든 물건 이름을 둘 다 상태별로 읽는다', () => {
    const wet = state({ 'towel.down': true, 'towel.wet': true });
    const nameOf = (id: string): string => hotspotNameId(shop, wet, id);
    expect(labelText({ verb: 'stretch', target: 'towel' }, 'shop', t, nameOf)).toBe('ぬれたタオルまでのばす');
    expect(labelText({ verb: 'item', target: 'gap', item: 'towel', held: true }, 'shop', t, nameOf)).toBe('すきまにぬれたタオルを使う');
    expect(labelText({ verb: 'put', target: null, item: 'towel', held: true }, 'shop', t, nameOf)).toBe('ぬれたタオルをおろす');
    // 넘기지 않으면 예전처럼 ID 이름(호출 쪽이 안 바뀐 테스트·도구).
    expect(labelText({ verb: 'item', target: 'gap', item: 'towel', held: true }, 'shop', t)).toBe('すきまにかわいたタオルを使う');
    // 캐릭터 이름은 nameOf를 안 탄다.
    expect(labelText({ verb: null, target: 'jjuk' }, 'shop', (id) => (id === 'char.jjuk.name' ? 'ノビー' : id), () => 'x')).toBe('ノビー');
  });
});
