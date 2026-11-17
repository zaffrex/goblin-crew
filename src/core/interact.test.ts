import { describe, expect, it } from 'vitest';
import screenJson from '../../content/screens/magpie_nest.json';
import texts from '../../content/text/ja.json';
import { characterDef, characterHitBox, CHARACTERS, type CharacterId } from './characters';
import type { HitBox } from './hit';
import { CHAR_SLOTS, HUD_AREA, ITEM_SLOT, VERB_SLOTS } from './hud';
import { labelText, resolveTap, tap, worldTargets, type TapContext, type UiState } from './interact';
import { initialState } from './puzzle/step';
import type { PuzzleState, ScreenData } from './puzzle/types';
import { HUD_BOX } from './puzzle/validate';
import type { Point } from './viewport';

const screen = screenJson as unknown as ScreenData;
const FLOOR_AT: Record<CharacterId, Point> = { jjuk: { x: 360, y: 244 }, mukjik: { x: 400, y: 244 }, ppik: { x: 440, y: 244 } };

/** 퍼즐 상태대로 몸 박스를 만든다. 바닥 캐릭터는 시작 좌표(magpie_nest.md 1-2). */
function ctxFor(puzzle: PuzzleState, s: ScreenData = screen): TapContext {
  const bodies = {} as Record<CharacterId, HitBox>;
  for (const c of CHARACTERS) {
    const spot = s.spots[puzzle.at[c.id]];
    const at = spot && !spot.free ? { x: spot.x, y: spot.y } : FLOOR_AT[c.id];
    bodies[c.id] = characterHitBox(characterDef(c.id), at.x, at.y, 1);
  }
  return { screen: s, puzzle, bodies };
}

function puzzleWith(at: Partial<PuzzleState['at']>, flags: Record<string, boolean> = {}, items: string[] = []): PuzzleState {
  const p = initialState(screen);
  return { ...p, at: { ...p.at, ...at }, flags: { ...p.flags, ...flags }, items };
}

const ui = (active: CharacterId, armed: UiState['armed'] = null): UiState => ({ active, armed, selected: null });
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
      ['jjuk', 'stretch', 'のばす: 物干しフック'],
      ['mukjik', 'stomp', 'ドスン: 物干しフック'],
      ['ppik', 'squeak', 'プピッ: 物干しフック'],
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

describe('무장 (설계 3절)', () => {
  it('무장하면 서는 자리에도 그 동사. 다른 사람이 선 시소 끝에도 쓴다(캐릭터 건너뛰기)', () => {
    const ctx = ctxFor(puzzleWith({ jjuk: 'seesaw_left' }));
    expect(resolveTap(ctx, ui('mukjik', { verb: 'ability' }), { x: 225, y: 205 }, 0)).toMatchObject({
      kind: 'act',
      action: { char: 'mukjik', verb: 'stomp', target: 'seesaw_left' },
    });
    expect(resolveTap(ctx, ui('mukjik', { verb: 'hand' }), { x: 225, y: 205 }, 0)).toMatchObject({
      action: { verb: 'hand', target: 'seesaw_left' },
      label: { verb: 'hand', target: 'seesaw_left' },
    });
  });

  it('무장 중 캐릭터 뒤에 아무것도 없으면 전환 + 무장 해제', () => {
    const r = tap(ctxFor(puzzleWith({})), ui('jjuk', { verb: 'look' }), { x: 440, y: 230 }, 0, false);
    expect(r.intent).toMatchObject({ kind: 'switch', char: 'ppik' });
    expect(r.ui).toEqual({ active: 'ppik', armed: null, selected: null });
  });

  it('무장 중 바닥을 누르면 무장을 풀고 걷는다', () => {
    const r = tap(ctxFor(puzzleWith({})), ui('jjuk', { verb: 'hand' }), { x: 300, y: 240 }, 0, false);
    expect(r.intent.kind).toBe('walk');
    expect(r.ui.armed).toBeNull();
  });

  it('실행하면 무장이 풀린다', () => {
    const r = tap(ctxFor(puzzleWith({})), ui('jjuk', { verb: 'look' }), { x: 146, y: 42 }, 0, false);
    expect(r.intent).toMatchObject({ kind: 'act', action: { verb: 'look', target: 'nest' } });
    expect(r.ui.armed).toBeNull();
  });
});

describe('HUD (설계 6절)', () => {
  const ctx = ctxFor(puzzleWith({}));

  it('캐릭터 칸 = 전환(무장 해제), 지금 캐릭터 칸 = 아무 일 없음', () => {
    const r = tap(ctx, ui('jjuk', { verb: 'hand' }), center(CHAR_SLOTS.mukjik), 0, false);
    expect(r.intent).toMatchObject({ kind: 'switch', char: 'mukjik' });
    expect(r.ui.armed).toBeNull();
    expect(resolveTap(ctx, ui('jjuk'), center(CHAR_SLOTS.jjuk), 0).kind).toBe('none');
  });

  it('동사 버튼: 누르면 무장, 같은 버튼 다시 = 해제, 다른 버튼 = 바꿈', () => {
    let u = ui('jjuk');
    u = tap(ctx, u, center(VERB_SLOTS.hand), 0, true).ui;
    expect(u.armed).toEqual({ verb: 'hand' });
    u = tap(ctx, u, center(VERB_SLOTS.look), 0, true).ui;
    expect(u.armed).toEqual({ verb: 'look' });
    u = tap(ctx, u, center(VERB_SLOTS.look), 0, true).ui;
    expect(u.armed).toBeNull();
  });

  it('빈 아이템 칸·버튼 사이 틈은 아무 일 없음(바닥 걷기로 새지 않는다)', () => {
    expect(resolveTap(ctx, ui('jjuk'), center(ITEM_SLOT), 0)).toEqual({ kind: 'none', label: null });
    expect(resolveTap(ctx, ui('jjuk'), { x: 330, y: 20 }, 0)).toEqual({ kind: 'none', label: null });
  });

  it('아이템이 있으면 아이템 칸 = item 무장, 대상에 item 행동', () => {
    const c = ctxFor(puzzleWith({}, {}, ['item.shop_key']));
    const u = tap(c, ui('jjuk'), center(ITEM_SLOT), 0, false).ui;
    expect(u.armed).toEqual({ verb: 'item', item: 'item.shop_key' });
    expect(resolveTap(c, u, { x: 160, y: 224 }, 0)).toMatchObject({
      action: { char: 'jjuk', verb: 'item', target: 'basket', item: 'item.shop_key' },
      label: { verb: 'item', item: 'item.shop_key' },
    });
  });

  it('버튼 아래 이름표 띠(y 65–75)를 눌러도 걷지 않는다(설계 6-1-4절, #255)', () => {
    const c = ctxFor(puzzleWith({}));
    for (const y of [65, 70, 75]) {
      const r = resolveTap(c, ui('jjuk'), { x: VERB_SLOTS.hand.left + 14, y }, 0);
      expect(r.kind).toBe('none');
    }
  });

  it('HUD 영역은 validate.ts의 HUD_BOX와 같다', () => {
    expect([HUD_AREA.left, HUD_AREA.top, HUD_AREA.width, HUD_AREA.height]).toEqual([...HUD_BOX]);
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

  it('선택 뒤 무장하면 같은 자리라도 다른 행동이라 다시 선택부터', () => {
    const a = tap(ctx, ui('mukjik'), seesaw, 8, true);
    const b = tap(ctx, a.ui, center(VERB_SLOTS.ability), 8, true);
    expect(b.ui.selected).toBeNull();
    expect(tap(ctx, b.ui, seesaw, 8, true).intent).toMatchObject({ kind: 'select', label: { verb: 'stomp' } });
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
      for (const armed of [null, { verb: 'ability' as const }, { verb: 'item' as const, item: 'item.shop_key' }]) {
        for (const pt of points) {
          expect(resolveTap(ctxFor(p, guarded), ui(c.id, armed), pt, 8)).toEqual(resolveTap(ctxFor(p), ui(c.id, armed), pt, 8));
        }
      }
    }
  });
});

describe('라벨 문구 (설계 7절)', () => {
  const t = (id: string): string => (texts as Record<string, string>)[id] ?? id;
  it('동사: 대상 / 이름만 / 대상 없는 동사', () => {
    expect(labelText({ verb: 'climb', target: 'seesaw_right' }, 'magpie_nest', t)).toBe('のる: シーソー（物干し側）');
    expect(labelText({ verb: 'stretch', target: 'nest' }, 'magpie_nest', t)).toBe('のばす: カササギの巣');
    expect(labelText({ verb: null, target: 'mukjik' }, 'magpie_nest', t)).toBe('ズッシー');
    expect(labelText({ verb: 'release', target: null }, 'magpie_nest', t)).toBe('手をはなす');
    expect(labelText({ verb: 'item', target: 'basket', item: 'item.shop_key' }, 'magpie_nest', t)).toBe('店のカギを使う: 洗たくかご');
  });

  it('화면 1의 모든 대상에 이름이 있다', () => {
    for (const id of [...Object.keys(screen.hotspots), ...Object.entries(screen.spots).filter(([, s]) => s.box).map(([id]) => id)]) {
      expect(texts, id).toHaveProperty([`magpie_nest.name.${id}`]);
    }
  });
});
