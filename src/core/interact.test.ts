import { describe, expect, it } from 'vitest';
import screenJson from '../../content/screens/magpie_nest.json';
import texts from '../../content/text/ja.json';
import { characterDef, characterFaceBox, characterHitBox, CHARACTERS, type CharacterId } from './characters';
import type { HitBox } from './hit';
import { CHAR_SLOTS, HUD_AREA } from './hud';
import { hudTargets, labelText, resolveTap, tap, worldTargets, type TapContext, type UiState } from './interact';
import { initialState } from './puzzle/step';
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
    const r0 = resolveTap(ctxFor(p0), ui('mukjik'), { x: 269, y: 208 }, 0);
    expect(r0).toMatchObject({ kind: 'act', action: { char: 'mukjik', verb: 'move', target: 'seesaw_right' }, label: { verb: 'climb' } });

    const p1 = puzzleWith({ mukjik: 'seesaw_right' });
    const r1 = resolveTap(ctxFor(p1), ui('mukjik'), { x: 269, y: 208 }, 0);
    expect(r1).toMatchObject({ kind: 'act', action: { char: 'mukjik', verb: 'stomp', target: 'seesaw_right' }, label: { verb: 'stomp' } });
  });

  it('지금 캐릭터 몸은 히트 대상에서 빠진다: 시소 끝을 가린 내 몸을 눌러도 쿵', () => {
    const ctx = ctxFor(puzzleWith({ mukjik: 'seesaw_right' }));
    const p = { x: 280, y: 205 }; // 묵직이 몸(273~303) 안 + 오른쪽 끝(250~288) 안
    expect(ctx.bodies.mukjik.left).toBeLessThanOrEqual(p.x);
    expect(resolveTap(ctx, ui('mukjik'), p, 0)).toMatchObject({ kind: 'act', action: { verb: 'stomp', target: 'seesaw_right' } });
    expect(worldTargets(ctx, ui('mukjik')).some((t) => t.id === 'char:mukjik')).toBe(false);
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
      ['jjuk', 'stretch', 'のばす: 柱のフック'],
      ['mukjik', 'stomp', 'ドスン: 柱のフック'],
      ['ppik', 'squeak', 'プピッ: 柱のフック'],
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

describe('바닥에 선 동료는 얼굴로 고른다 (설계 2-1절, #427)', () => {
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

  it('화면 1 정답 3번: 오른쪽 끝 = 올라섬, 올라선 뒤 같은 끝 한 번 더 = 쿵(6-4-1절)', () => {
    const before = resolveTap(ctxFor(puzzleWith({ jjuk: 'seesaw_left' })), ui('mukjik'), seesaw, 0);
    expect(before).toMatchObject({ kind: 'act', action: { char: 'mukjik', verb: 'move', target: 'seesaw_right' }, label: { verb: 'climb' } });
    const after = resolveTap(ctxFor(puzzleWith({ jjuk: 'seesaw_left', mukjik: 'seesaw_right' })), ui('mukjik'), seesaw, 0);
    expect(after).toMatchObject({ kind: 'act', action: { char: 'mukjik', verb: 'stomp', target: 'seesaw_right' }, label: { verb: 'stomp' } });
  });

  it('남이 선 끝: 몸을 누르면 전환, 몸 밖은 올라서기뿐(능력은 못 고른다, 6-4-4절)', () => {
    const ctx = ctxFor(puzzleWith({ jjuk: 'seesaw_left' }));
    expect(resolveTap(ctx, ui('mukjik'), { x: 225, y: 205 }, 0)).toMatchObject({ kind: 'switch', char: 'jjuk' });
    for (let x = 200; x < 250; x += 3) {
      const r = resolveTap(ctx, ui('mukjik'), { x, y: 208 }, 0);
      if (r.kind === 'act' && r.action.target === 'seesaw_left') expect(r.action.verb).toBe('move');
    }
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
    const a = tap(ctx, ui('mukjik'), seesaw, 8, true);
    expect(a.intent).toMatchObject({ kind: 'select', label: { verb: 'climb', target: 'seesaw_right' } });
    const b = tap(ctx, a.ui, seesaw, 8, true);
    expect(b.intent).toMatchObject({ kind: 'act', action: { verb: 'move', target: 'seesaw_right' } });
    expect(b.ui.selected).toBeNull();
    expect(tap(ctx, ui('mukjik'), seesaw, 0, false).intent.kind).toBe('act');
  });

  it('다른 대상을 탭하면 선택이 옮겨 가고, 바닥 걷기는 선택을 푼다', () => {
    const a = tap(ctx, ui('mukjik'), seesaw, 8, true);
    const b = tap(ctx, a.ui, { x: 227, y: 208 }, 8, true);
    expect(b.intent).toMatchObject({ kind: 'select', label: { target: 'seesaw_left' } });
    const c = tap(ctx, b.ui, { x: 300, y: 240 }, 8, true);
    expect(c.intent.kind).toBe('walk');
    expect(c.ui.selected).toBeNull();
  });

  it('올라선 뒤 같은 끝은 다른 행동(쿵)이라 다시 선택부터: 정답 3번은 터치 4번(6-4-1절)', () => {
    const a = tap(ctx, ui('mukjik'), seesaw, 8, true);
    const b = tap(ctx, a.ui, seesaw, 8, true);
    expect(b.intent).toMatchObject({ kind: 'act', action: { verb: 'move' } });
    const on = ctxFor(puzzleWith({ mukjik: 'seesaw_right' }));
    const c = tap(on, b.ui, seesaw, 8, true);
    expect(c.intent).toMatchObject({ kind: 'select', label: { verb: 'stomp' } });
    expect(tap(on, c.ui, seesaw, 8, true).intent).toMatchObject({ kind: 'act', action: { verb: 'stomp', target: 'seesaw_right' } });
  });

  it('매달린 캐릭터의 손 놓기는 터치에서 2번, 전환·걷기는 1번', () => {
    const hang = ctxFor(puzzleWith({ jjuk: 'hook' }));
    const a = tap(hang, ui('jjuk'), { x: 300, y: 240 }, 8, true);
    expect(a.intent).toMatchObject({ kind: 'select', label: { verb: 'release' } });
    expect(tap(hang, a.ui, { x: 310, y: 250 }, 8, true).intent).toMatchObject({ kind: 'act', action: { verb: 'move', target: 'floor' } });
    expect(tap(hang, ui('jjuk'), center(CHAR_SLOTS.ppik), 8, true).intent.kind).toBe('switch');
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
    expect(labelText({ verb: 'climb', target: 'seesaw_right' }, 'magpie_nest', t)).toBe('のる: シーソーの右端');
    expect(labelText({ verb: 'stretch', target: 'nest' }, 'magpie_nest', t)).toBe('のばす: カササギの巣');
    expect(labelText({ verb: null, target: 'mukjik' }, 'magpie_nest', t)).toBe('ズッシー');
    expect(labelText({ verb: 'release', target: null }, 'magpie_nest', t)).toBe('手をはなす');
    expect(labelText({ verb: 'item', target: 'basket', item: 'item.shop_key' }, 'magpie_nest', t)).toBe('店のカギを使う: 洗濯かご');
  });

  it('화면 1의 모든 대상에 이름이 있다', () => {
    for (const id of [...Object.keys(screen.hotspots), ...Object.entries(screen.spots).filter(([, s]) => s.box).map(([id]) => id)]) {
      expect(texts, id).toHaveProperty([`magpie_nest.name.${id}`]);
    }
  });
});
