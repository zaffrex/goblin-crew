// 바닥에 선 동료는 보이는 그림 칸(여유 0)이나 얼굴 상자를 누르면 전환된다 (설계 `ui-interaction.md` 2-1절, #736).
// 커밋된 시트 PNG 알파를 엔진처럼 `SceneData.alpha`로 넘기고, 엔진과 같은 판정 경로(`tapContext` → `resolveTap`)를 돈다.
// 번호는 2-1-3절 "테스트로 고정할 것"이다.

import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import charactersJson from '../../content/characters.json';
import magpieJson from '../../content/screens/magpie_nest.json';
import magpieArtJson from '../../public/scenes/magpie_nest-objects.json';
import fountainJson from '../../content/screens/park_fountain.json';
import fountainArtJson from '../../public/scenes/park_fountain-objects.json';
import jjukJson from '../../public/sprites/jjuk-base.json';
import mukjikJson from '../../public/sprites/mukjik-base.json';
import ppikJson from '../../public/sprites/ppik-base.json';
import { opaqueAt, type AlphaMask } from '../../src/core/alpha';
import { CHARACTERS, type CharacterId } from '../../src/core/characters';
import { CHAR_SLOTS } from '../../src/core/hud';
import { resolveTap, tap, type UiState } from '../../src/core/interact';
import { frameOpaqueAt, parseSceneArt } from '../../src/core/sceneArt';
import { charFacing, charPose, createScene, isBusy, runAction, sceneTap, sceneTick, tapContext, type SceneData, type SceneState } from '../../src/core/scene';
import { parseSpriteMeta, spriteFrame, spriteOpaqueAt, type SpriteMeta } from '../../src/core/sprite';
import type { CharactersData, ScreenData } from '../../src/core/puzzle/types';
import type { Point } from '../../src/core/viewport';
import { pngAlpha } from './png';

const ROOT = join(import.meta.dirname, '..', '..', 'public');
const sprites: Record<CharacterId, SpriteMeta> = { jjuk: parseSpriteMeta(jjukJson), mukjik: parseSpriteMeta(mukjikJson), ppik: parseSpriteMeta(ppikJson) };
const masks: Record<string, AlphaMask> = Object.fromEntries(CHARACTERS.map((c) => [c.id, pngAlpha(join(ROOT, 'sprites', sprites[c.id].image))]));
const art = parseSceneArt(magpieArtJson);
const objects = pngAlpha(join(ROOT, 'scenes', art.image));

const base: SceneData = { screen: magpieJson as unknown as ScreenData, characters: charactersJson as CharactersData, art, sprites };
/** 엔진과 같은 데이터: 시트 알파가 읽힌 뒤. */
const data: SceneData = { ...base, alpha: { sprite: (id) => masks[id] ?? null, objects: () => objects } };

const IDS = CHARACTERS.map((c) => c.id);
const SLOPS = [0, 8] as const;
const ui = (active: CharacterId): UiState => ({ active, selected: null });
const others = (me: CharacterId): CharacterId[] => IDS.filter((id) => id !== me);
const center = (b: { left: number; top: number; width: number; height: number }): Point => ({ x: b.left + b.width / 2, y: b.top + b.height / 2 });

/** 화면 1 시작 배치(시작 연출을 끝낸 뒤). 발 y 244, ノビー 360 · ズッシー 400 · プピ 440, 오른쪽 봄. */
function ready(d: SceneData = data): SceneState {
  const s = createScene(d);
  for (let i = 0; i < 5000 && isBusy(s); i++) sceneTick(d, s);
  expect(isBusy(s)).toBe(false);
  return s;
}

/** 이번 프레임에 그 사람 칸이 (x, y)에서 불투명인가(덮개는 안 봄). 그리기와 같은 칸 번호·자리·방향. */
function drawnOpaque(s: SceneState, id: CharacterId, p: Point, d: SceneData = data): boolean {
  const meta = sprites[id];
  const frame = spriteFrame(meta, charPose(d, s, id))!;
  const w = s.walkers[id];
  return spriteOpaqueAt(meta, masks[id]!, frame, w.x, w.y, charFacing(d, s, id), p.x, p.y);
}

/** 얼굴 상자에서 여유 slop 안인가. */
function nearFace(s: SceneState, id: CharacterId, p: Point, slop: number, d: SceneData = data): boolean {
  const f = tapContext(d, s).faces[id];
  const dx = Math.max(f.left - p.x, 0, p.x - (f.left + f.width));
  const dy = Math.max(f.top - p.y, 0, p.y - (f.top + f.height));
  return Math.hypot(dx, dy) <= slop;
}

describe('화면 1 시작 배치 (2-1-1·2-1-3절)', () => {
  it('배치가 2-1-1절과 같다', () => {
    const s = ready();
    expect(IDS.map((id) => [s.walkers[id].x, s.walkers[id].y])).toEqual([
      [360, 244],
      [400, 244],
      [440, 244],
    ]);
    expect(s.ui.active).toBe('jjuk');
  });

  it('땅 함정은 11/19 규칙과 한 점도 다르지 않고, 늘어난 전환은 전부 그 사람의 보이는 칸이다 (걷기 영역 1px마다)', () => {
    const s = ready();
    const withArt = tapContext(data, s);
    const faceOnly = tapContext(base, s);
    const traps = [0, 0];
    const oldTraps = [0, 0];
    let drawnPx = 0;
    const switched = [0, 0];
    const oldSwitched = [0, 0];
    for (let y = 200; y <= 252; y++) {
      for (let x = 300; x <= 470; x++) {
        const p = { x, y };
        const owner = others('jjuk').find((id) => drawnOpaque(s, id, p));
        if (owner) drawnPx++;
        SLOPS.forEach((slop, i) => {
          const a = resolveTap(withArt, ui('jjuk'), p, slop);
          const b = resolveTap(faceOnly, ui('jjuk'), p, slop);
          if (a.kind === 'switch' && !drawnOpaque(s, a.char, p)) traps[i]!++;
          if (b.kind === 'switch' && !drawnOpaque(s, b.char, p)) oldTraps[i]!++;
          if (owner && a.kind === 'switch' && a.char === owner) switched[i]!++;
          if (owner && b.kind === 'switch' && b.char === owner) oldSwitched[i]!++;
          if (JSON.stringify(a) === JSON.stringify(b)) return;
          // 달라진 점은 11/19에 전환이 아니었고, 지금은 그 점에 그려진 사람으로 전환이다.
          expect(b.kind, `${x},${y} slop ${slop}`).not.toBe('switch');
          expect(a.kind === 'switch' && drawnOpaque(s, a.char, p), `${x},${y} slop ${slop}`).toBe(true);
        });
      }
    }
    // 2-1-1 표 "채택" 줄: 땅 함정(그 사람 투명 칸인데 전환)은 11/19과 같고, 그림 중 전환은 100% / 100%.
    // 이 셈(시작 연출 뒤 서 있기 칸, 1px마다)으로는 땅 함정 87 / 593, 동료 그림 칸 2236px 중 11/19 규칙으로 전환되던 곳은 588 / 1078(26% / 48%)이다. 2-1-1 표(81 / 580)와 몇 개 다른 것은 칸 번호·셈 범위 차이다.
    expect(traps).toEqual(oldTraps);
    expect(traps).toEqual([87, 593]);
    expect(switched).toEqual([drawnPx, drawnPx]);
    expect([drawnPx, ...oldSwitched]).toEqual([2236, 588, 1078]);
  });

  it('2-1-1 작은 표 그대로 (지금 캐릭터 ノビー, 마우스·터치)', () => {
    const ctx = tapContext(data, ready());
    const walk: Point[] = [
      { x: 414, y: 240 },
      { x: 455, y: 232 },
      { x: 430, y: 246 },
      { x: 423, y: 236 },
      { x: 380, y: 250 },
    ];
    const sw: [Point, CharacterId][] = [
      [{ x: 400, y: 218 }, 'mukjik'],
      [{ x: 440, y: 231 }, 'ppik'],
      [{ x: 400, y: 240 }, 'mukjik'],
      [{ x: 400, y: 200 }, 'mukjik'],
      [{ x: 440, y: 212 }, 'ppik'],
    ];
    for (const slop of SLOPS) {
      for (const p of walk) expect(resolveTap(ctx, ui('jjuk'), p, slop), `${p.x},${p.y} slop ${slop}`).toMatchObject({ kind: 'walk' });
      for (const [p, c] of sw) expect(resolveTap(ctx, ui('jjuk'), p, slop), `${p.x},${p.y} slop ${slop}`).toEqual({ kind: 'switch', char: c, label: { verb: null, target: c } });
    }
  });

  it('① 지금 캐릭터 셋 × 다른 두 사람 × 발 근처 땅(그림 옆·앞 투명 칸) = 걷기', () => {
    for (const me of IDS) {
      const s = ready();
      s.ui.active = me;
      const ctx = tapContext(data, s);
      for (const other of others(me)) {
        const body = ctx.bodies[other];
        const foot = s.walkers[other];
        const ground: Point[] = [
          { x: body.left - 1, y: foot.y - 4 },
          { x: body.left + body.width, y: foot.y - 4 },
          { x: foot.x, y: foot.y + 4 },
        ];
        for (const p of ground) {
          expect(drawnOpaque(s, other, p), `${other} ${p.x},${p.y}`).toBe(false);
          for (const slop of SLOPS) expect(resolveTap(ctx, ui(me), p, slop), `${me}→${other} ${p.x},${p.y} slop ${slop}`).toMatchObject({ kind: 'walk', label: { verb: 'walk', target: null } });
        }
      }
    }
  });

  it('② 다른 두 사람의 얼굴 가운데 = 전환, 마우스·터치 1번(그대로)', () => {
    for (const me of IDS) {
      const s = ready();
      s.ui.active = me;
      const ctx = tapContext(data, s);
      for (const other of others(me)) {
        const p = center(ctx.faces[other]);
        expect(resolveTap(ctx, ui(me), p, 0)).toEqual({ kind: 'switch', char: other, label: { verb: null, target: other } });
        expect(tap(ctx, ui(me), p, 8, true).ui).toEqual({ active: other, selected: null });
      }
    }
  });

  it('③ 다른 두 사람의 몸통(얼굴 아래 끝 + 12)·다리(y 240) = 전환, 라벨 = 이름 (11/19 ③을 뒤집음)', () => {
    const torso: Record<CharacterId, Point> = { jjuk: { x: 360, y: 216 }, mukjik: { x: 400, y: 218 }, ppik: { x: 440, y: 231 } };
    for (const me of IDS) {
      const s = ready();
      s.ui.active = me;
      const ctx = tapContext(data, s);
      for (const other of others(me)) {
        const face = ctx.faces[other];
        expect(torso[other].y).toBe(face.top + face.height + 12);
        for (const p of [torso[other], { x: s.walkers[other].x, y: 240 }]) {
          expect(drawnOpaque(s, other, p), `${other} ${p.x},${p.y}`).toBe(true);
          for (const slop of SLOPS) {
            expect(resolveTap(ctx, ui(me), p, slop), `${me}→${other} ${p.x},${p.y} slop ${slop}`).toEqual({ kind: 'switch', char: other, label: { verb: null, target: other } });
            expect(tap(ctx, ui(me), p, slop, slop > 0).ui.active).toBe(other);
          }
        }
      }
    }
  });

  it('④ 여유 0: 몸통 줄 그림 칸 바로 바깥 1px은 터치 8로도 걷기', () => {
    const s = ready();
    const ctx = tapContext(data, s);
    let checked = 0;
    for (const [other, y] of [['mukjik', 218], ['ppik', 231]] as const) {
      const xs: number[] = [];
      for (let x = 300; x <= 480; x++) if (drawnOpaque(s, other, { x, y })) xs.push(x);
      const outside = [Math.min(...xs) - 1, Math.max(...xs) + 1].map((x) => ({ x, y }));
      for (const p of outside) {
        if (nearFace(s, other, p, 8) || others('jjuk').some((id) => drawnOpaque(s, id, p))) continue;
        checked++;
        expect(resolveTap(ctx, ui('jjuk'), p, 8), `${other} ${p.x},${p.y}`).toMatchObject({ kind: 'walk' });
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('⑤ 그려진 칸을 따른다: 서 있기 0번·1번 칸, 왼쪽을 볼 때 뒤집힌 칸', () => {
    const meta = sprites.mukjik;
    const idle = meta.anims.idle!;
    expect(idle.frames.length).toBe(2);
    const at = (s: SceneState, id: CharacterId): number => spriteFrame(meta, charPose(data, s, id))!;
    const s0 = ready();
    const s1 = ready();
    // 두 판의 시계를 서 있기 0번·1번 칸에 맞춘다.
    while (at(s0, 'mukjik') !== idle.frames[0]) sceneTick(data, s0);
    while (at(s1, 'mukjik') !== idle.frames[1]) sceneTick(data, s1);
    let diff: Point | null = null;
    for (let y = 170; y < 250 && !diff; y++) {
      for (let x = 370; x < 430 && !diff; x++) {
        const p = { x, y };
        if (drawnOpaque(s0, 'mukjik', p) !== drawnOpaque(s1, 'mukjik', p) && !nearFace(s0, 'mukjik', p, 0) && !drawnOpaque(s0, 'ppik', p)) diff = p;
      }
    }
    expect(diff).not.toBeNull();
    for (const s of [s0, s1]) {
      const r = resolveTap(tapContext(data, s), ui('jjuk'), diff!, 0);
      expect(r.kind === 'switch', `칸 ${at(s, 'mukjik')}`).toBe(drawnOpaque(s, 'mukjik', diff!));
    }

    // 왼쪽을 보면 칸이 기준점 축으로 뒤집힌다. 오른쪽 볼 때만 불투명인 점과 왼쪽 볼 때만 불투명인 점이 각각 결과를 따른다.
    const r = ready();
    const l = ready();
    l.walkers.mukjik.facing = -1;
    expect(charFacing(data, l, 'mukjik')).toBe(-1);
    let onlyR: Point | null = null;
    let onlyL: Point | null = null;
    for (let y = 205; y < 244; y++) {
      for (let x = 380; x < 420; x++) {
        const p = { x, y };
        if (nearFace(r, 'mukjik', p, 0) || nearFace(l, 'mukjik', p, 0) || drawnOpaque(r, 'ppik', p)) continue;
        const a = drawnOpaque(r, 'mukjik', p);
        const b = drawnOpaque(l, 'mukjik', p);
        if (a && !b) onlyR ??= p;
        if (b && !a) onlyL ??= p;
      }
    }
    expect(onlyR).not.toBeNull();
    expect(onlyL).not.toBeNull();
    expect(resolveTap(tapContext(data, r), ui('jjuk'), onlyR!, 0)).toMatchObject({ kind: 'switch', char: 'mukjik' });
    expect(resolveTap(tapContext(data, l), ui('jjuk'), onlyR!, 0)).toMatchObject({ kind: 'walk' });
    expect(resolveTap(tapContext(data, l), ui('jjuk'), onlyL!, 0)).toMatchObject({ kind: 'switch', char: 'mukjik' });
    expect(resolveTap(tapContext(data, r), ui('jjuk'), onlyL!, 0)).toMatchObject({ kind: 'walk' });
  });
});

describe('덮인 칸은 그 사람이 아니다 (2-1절 "물건 그림 아래 깔린 칸")', () => {
  it('⑥ 바구니 안 ノビー: 앞판 위 몸통 = 전환, 앞판에 덮인 다리 칸 = 바구니', () => {
    const s = ready();
    s.ui.active = 'mukjik';
    s.walkers.jjuk = { ...s.walkers.jjuk, x: 160, y: 235 };
    const ctx = tapContext(data, s);
    const panel = art.frames[art.objects.find((o) => o.key === 'basket')!.overlay!.frame]!;
    const [bx, by] = data.screen.hotspots.basket!.box!;
    const face = ctx.faces.jjuk;
    let torso = 0;
    let covered = 0;
    for (let y = 170; y < 236; y++) {
      for (let x = 140; x < 180; x++) {
        const p = { x, y };
        if (!drawnOpaque(s, 'jjuk', p)) continue;
        const r = resolveTap(ctx, ui('mukjik'), p, 0);
        const underPanel = frameOpaqueAt(art, objects, 16, x, y);
        if (underPanel) {
          covered++;
          expect(r, `${x},${y}`).toMatchObject({ kind: 'act', action: { target: 'basket' } });
        } else if (y >= face.top + face.height && y < by) {
          torso++;
          expect(r, `${x},${y}`).toMatchObject({ kind: 'switch', char: 'jjuk' });
        }
      }
    }
    expect(panel.at).toEqual([142, 225]);
    expect(bx).toBe(144);
    expect(torso).toBeGreaterThan(0);
    expect(covered).toBeGreaterThan(0);
    // scene.test 바구니 테스트의 (160, 230)은 앞판 아래 칸이라 그대로 바구니다.
    expect(frameOpaqueAt(art, objects, 16, 160, 230)).toBe(true);
    expect(resolveTap(ctx, ui('mukjik'), { x: 160, y: 230 }, 0)).toMatchObject({ kind: 'act', action: { target: 'basket' } });
  });

  it('⑨ 땅의 까치(front 층): 까치 불투명 칸 = 까치, 까치 투명 칸 위 동료 칸 = 전환', () => {
    const s = ready();
    s.puzzle.flags['magpie.on_ground'] = true;
    // ズッシー를 까치 칸(at 90,217, 22×20) 바로 뒤에 세운다.
    s.walkers.mukjik = { ...s.walkers.mukjik, x: 100, y: 238 };
    const ctx = tapContext(data, s);
    let magpie = 0;
    let mate = 0;
    for (let y = 212; y < 238; y++) {
      for (let x = 85; x < 115; x++) {
        const p = { x, y };
        if (!drawnOpaque(s, 'mukjik', p) || nearFace(s, 'mukjik', p, 0)) continue;
        const loopCover = [7, 8, 9].some((f) => frameOpaqueAt(art, objects, f, x, y));
        const r = resolveTap(ctx, ui('jjuk'), p, 0);
        if (loopCover) {
          magpie++;
          expect(r, `${x},${y}`).not.toMatchObject({ kind: 'switch' });
        } else {
          mate++;
          expect(r, `${x},${y}`).toMatchObject({ kind: 'switch', char: 'mukjik' });
        }
      }
    }
    expect(magpie).toBeGreaterThan(0);
    expect(mate).toBeGreaterThan(0);
    // 까치 그림 위(사람 칸 아님)는 까치 핫스팟.
    const [mx, my] = data.screen.hotspots.magpie!.variants![0]!.box!;
    for (let y = my; y < my + 24; y++) {
      for (let x = mx; x < mx + 24; x++) {
        if (!frameOpaqueAt(art, objects, 7, x, y) || drawnOpaque(s, 'mukjik', { x, y }) || nearFace(s, 'mukjik', { x, y }, 0)) continue;
        expect(resolveTap(ctx, ui('jjuk'), { x, y }, 0), `${x},${y}`).toMatchObject({ kind: 'act', action: { target: 'magpie' } });
      }
    }
  });

  it('내 몸 뒤에 깔린 동료 칸은 동료가 아니다(나중에 그린 사람도 덮개, 2-1절)', () => {
    const s = ready();
    // 같은 발 y면 조작 중인 사람이 앞이다(#506). ノビー를 ズッシー와 4px 겹쳐 세운다.
    s.walkers.jjuk = { ...s.walkers.jjuk, x: 396, y: 244 };
    const ctx = tapContext(data, s);
    let both = 0;
    let mateOnly = 0;
    for (let y = 205; y < 244; y++) {
      for (let x = 380; x < 420; x++) {
        const p = { x, y };
        if (!drawnOpaque(s, 'mukjik', p) || nearFace(s, 'mukjik', p, 0) || drawnOpaque(s, 'ppik', p)) continue;
        const r = resolveTap(ctx, ui('jjuk'), p, 0);
        if (drawnOpaque(s, 'jjuk', p)) {
          both++;
          expect(r, `${x},${y}`).toMatchObject({ kind: 'walk' });
        } else {
          mateOnly++;
          expect(r, `${x},${y}`).toMatchObject({ kind: 'switch', char: 'mukjik' });
        }
      }
    }
    expect(both).toBeGreaterThan(0);
    expect(mateOnly).toBeGreaterThan(0);
  });
});

describe('그대로인 것 (2-1-3 ⑦, 2-1-3 추가 ⑩)', () => {
  it('⑦ HUD 얼굴 칸 전환 그대로', () => {
    const s = ready();
    expect(resolveTap(tapContext(data, s), ui('jjuk'), center(CHAR_SLOTS.ppik), 8)).toMatchObject({ kind: 'switch', char: 'ppik' });
  });

  it('⑦ 시소 끝에 선 사람은 몸 전체(시트 hit 상자)가 그대로 전환', () => {
    const s = ready();
    s.puzzle.at.jjuk = 'seesaw_left';
    const ctx = tapContext(data, s);
    expect(ctx.drawn?.jjuk).toBeDefined();
    const b = ctx.bodies.jjuk;
    // 상자 안이지만 그림 칸이 아닌 점도 전환(서는 자리 위 사람은 상자 판정 그대로).
    let p: Point | null = null;
    for (let y = b.top; y < b.top + b.height && !p; y++) for (let x = b.left; x < b.left + b.width && !p; x++) if (!drawnOpaque(s, 'jjuk', { x, y }) && !drawnOpaque(s, 'mukjik', { x, y })) p = { x, y };
    expect(p).not.toBeNull();
    expect(resolveTap(ctx, ui('mukjik'), p!, 0)).toMatchObject({ kind: 'switch', char: 'jjuk' });
  });

  it('⑩ 시트 알파가 없으면(엔진이 아직 못 읽음) 11/19 규칙: 몸통은 걷기, 얼굴은 전환', () => {
    const noPixels: SceneData = { ...base, alpha: { sprite: () => null, objects: () => null } };
    const s = ready(noPixels);
    const ctx = tapContext(noPixels, s);
    expect(ctx.drawn).toEqual({});
    expect(resolveTap(ctx, ui('jjuk'), { x: 400, y: 218 }, 8)).toMatchObject({ kind: 'walk' });
    expect(resolveTap(ctx, ui('jjuk'), { x: 400, y: 200 }, 0)).toMatchObject({ kind: 'switch', char: 'mukjik' });
    // 사람 시트만 있고 물건 시트가 아직이면 덮개 없이 사람 칸만 쓴다(바구니 앞판이 없을 때와 같다).
    const noObjects: SceneData = { ...base, alpha: { sprite: (id) => masks[id] ?? null, objects: () => null } };
    expect(resolveTap(tapContext(noObjects, ready(noObjects)), ui('jjuk'), { x: 400, y: 218 }, 0)).toMatchObject({ kind: 'switch', char: 'mukjik' });
  });

  it('opaqueAt은 시트 밖을 불투명으로 보지 않는다', () => {
    const m = masks.jjuk!;
    expect(opaqueAt(m, -1, 0)).toBe(false);
    expect(opaqueAt(m, m.width, 0)).toBe(false);
    expect(opaqueAt(m, 0, m.height)).toBe(false);
  });
});

describe('화면 2 앉은 ズッシー (2-1-4절)', () => {
  const fArt = parseSceneArt(fountainArtJson);
  const fObjects = pngAlpha(join(ROOT, 'scenes', fArt.image));
  const fData: SceneData = {
    screen: fountainJson as unknown as ScreenData,
    characters: charactersJson as CharactersData,
    art: fArt,
    sprites,
    alpha: { sprite: (id) => masks[id] ?? null, objects: () => fObjects },
  };
  function seated(): SceneState {
    const s = ready(fData);
    runAction(fData, s, { char: 'mukjik', verb: 'stomp', target: 'fountain' }, null);
    for (let i = 0; i < 5000 && isBusy(s); i++) sceneTick(fData, s);
    expect(s.puzzle.at.mukjik).toBe('fountain_seat');
    return s;
  }

  it('테두리 앞면 12점 중 ズッシー 칸 위 6점은 전환, 나머지 6점은 분수 (sceneSeat.test는 알파 없는 경우로 남김)', () => {
    const s = seated();
    const ctx = tapContext(fData, s);
    const onBody = ['210,184', '220,184', '220,192', '230,184', '230,192', '240,184'];
    for (const x of [210, 220, 230, 240]) {
      for (const y of [184, 192, 200]) {
        const r = resolveTap(ctx, ui('ppik'), { x, y }, 0);
        if (onBody.includes(`${x},${y}`)) expect(r, `${x},${y}`).toEqual({ kind: 'switch', char: 'mukjik', label: { verb: null, target: 'mukjik' } });
        else expect(r, `${x},${y}`).toMatchObject({ kind: 'act', action: { target: 'fountain' } });
      }
    }
  });

  it('분수 상자 중 ズッシー로 바뀌는 곳은 그려진 칸뿐이다(2-1-4절 539px, 12%)', () => {
    const s = seated();
    const ctx = tapContext(fData, s);
    const [fx, fy, fw, fh] = fData.screen.hotspots.fountain!.box!;
    let sw = 0;
    for (let y = fy; y < fy + fh; y++) {
      for (let x = fx; x < fx + fw; x++) {
        const r = resolveTap(ctx, ui('ppik'), { x, y }, 0);
        if (r.kind === 'switch') {
          sw++;
          expect(drawnOpaque(s, 'mukjik', { x, y }, fData) || nearFace(s, 'mukjik', { x, y }, 0, fData), `${x},${y}`).toBe(true);
        }
      }
    }
    expect(sw).toBe(539);
  });
  /** 오리 → `high`(물 끈 뒤 재킷에 장대, 못 닿음)까지 마친 배치(#862). */
  function afterHigh(): SceneState {
    const s = ready(fData);
    for (const a of [
      { char: 'ppik', verb: 'squeak', target: 'duck' },
      { char: 'jjuk', verb: 'stretch', target: 'jacket' },
    ] as const) {
      runAction(fData, s, a, null);
      for (let i = 0; i < 5000 && isBusy(s); i++) sceneTick(fData, s);
    }
    expect(s.puzzle.flags['fountain.off']).toBe(true);
    expect(s.puzzle.flags['jacket.on_hand']).toBe(false);
    // 엔진 걷기(비켜 서기)는 busy가 아니라 따로 끝까지 돌린다.
    for (let i = 0; i < 5000 && s.walkers.jjuk.target !== null; i++) sceneTick(fData, s);
    return s;
  }

  /** 땅 비둘기 상자에서 ズッシー가 눌렀을 때 전환으로 바뀌는 px 수(여유 slop). */
  function pigeonSwitches(s: SceneState, slop: number): number {
    const ctx = tapContext(fData, s);
    const [bx, by, bw, bh] = fData.screen.hotspots.pigeons!.box!;
    let n = 0;
    for (let y = by; y < by + bh; y++) for (let x = bx; x < bx + bw; x++) if (resolveTap(ctx, ui('mukjik'), { x, y }, slop).kind === 'switch') n++;
    return n;
  }

  it('오리 → `high` 뒤 ノビー가 땅 비둘기 상자를 덮지 않는다: 전환 0px, 가운데는 비둘기 (#862)', () => {
    const s = afterHigh();
    expect([s.walkers.jjuk.x, s.walkers.jjuk.y]).toEqual([283, 244]);
    // 도착하면 재킷 쪽(왼쪽)으로 돌아선다(#865 Luna). 등지고 서면 "포기하고 간다"로 읽힌다.
    expect(charFacing(fData, s, 'jjuk')).toBe(-1);
    for (const slop of SLOPS) expect(pigeonSwitches(s, slop), `slop ${slop}`).toBe(0);
    const r = resolveTap(tapContext(fData, s), ui('mukjik'), { x: 232, y: 216 }, 8);
    expect(r).toMatchObject({ kind: 'act', action: { char: 'mukjik', target: 'pigeons' } });
  });

  it('오리 → `high` 뒤 비켜 선 ノビー가 화면의 퍼즐 대상(`hintAbility` 있음) 어느 상자도 먹지 않는다 (#862 Noah 우려 1)', () => {
    const s = afterHigh();
    const ctx = tapContext(fData, s);
    const defs = { ...fData.screen.hotspots, ...fData.screen.spots };
    const checked: string[] = [];
    for (const [id, def] of Object.entries(defs)) {
      if (def.hintAbility === undefined || !def.box) continue;
      checked.push(id);
      const [bx, by, bw, bh] = def.box;
      for (const slop of SLOPS) {
        let n = 0;
        for (let y = by; y < by + bh; y++) {
          for (let x = bx; x < bx + bw; x++) {
            const r = resolveTap(ctx, ui('mukjik'), { x, y }, slop);
            if (r.kind === 'switch' && r.char === 'jjuk') n++;
          }
        }
        expect(n, `${id} slop ${slop}`).toBe(0);
      }
    }
    expect(checked).toContain('pigeons');
  });

  it('오리 → `high` → 동상 앉기(길 F) 뒤에도 전환 0px (#862)', () => {
    const s = afterHigh();
    runAction(fData, s, { char: 'mukjik', verb: 'stomp', target: 'statue' }, null);
    for (let i = 0; i < 5000 && isBusy(s); i++) sceneTick(fData, s);
    for (const slop of SLOPS) expect(pigeonSwitches(s, slop), `slop ${slop}`).toBe(0);
  });
  it('이미 본 `high` 대사(잠금 0.4초)를 걷기 중에 닫아도 닫는 탭은 비켜 선 몸으로 판정된다 (#862)', () => {
    const s = afterHigh();
    // 두 번 더 뻗으면 두 문구를 다 봐서 세 번째는 본 대사다.
    for (let k = 0; k < 2; k++) {
      runAction(fData, s, { char: 'jjuk', verb: 'stretch', target: 'jacket' }, null);
      for (let i = 0; i < 5000 && (isBusy(s) || s.walkers.jjuk.target !== null); i++) sceneTick(fData, s);
    }
    runAction(fData, s, { char: 'jjuk', verb: 'stretch', target: 'jacket' }, null);
    for (let i = 0; i < 5000 && s.current?.ev.type !== 'say'; i++) sceneTick(fData, s);
    for (let i = 0; i < 25; i++) sceneTick(fData, s); // 0.42초: 본 대사 잠금(0.4초)은 지났고 걷기(0.66초)는 아직
    expect(s.walkers.jjuk.target).not.toBeNull();
    expect(s.walkers.jjuk.x).toBeLessThan(283);
    s.ui = ui('mukjik');
    const r = sceneTap(fData, s, { x: 232, y: 216 }, 8, true);
    // 터치 첫 탭은 선택(2-2절). 전환이 아니라 비둘기가 골라졌는지 본다.
    expect(r).toMatchObject({ kind: 'intent', intent: { kind: 'select', label: { target: 'pigeons' } } });
    expect([s.walkers.jjuk.x, s.walkers.jjuk.y]).toEqual([283, 244]);
    expect(s.walkers.jjuk.facing).toBe(-1);
  });

  it('비켜 서는 중 다른 곳으로 걸으면 도착해도 재킷 쪽으로 돌지 않는다 (#865)', () => {
    const s = afterHigh();
    runAction(fData, s, { char: 'jjuk', verb: 'stretch', target: 'jacket' }, null);
    for (let i = 0; i < 5000 && s.current?.ev.type !== 'say'; i++) sceneTick(fData, s);
    expect(s.stepOff.jjuk).toBeDefined();
    s.walkers.jjuk.target = { x: 400, y: 244 };
    s.walkers.jjuk.facing = 1;
    for (let i = 0; i < 5000 && s.walkers.jjuk.target !== null; i++) sceneTick(fData, s);
    expect(s.stepOff.jjuk).toBeUndefined();
    expect(s.walkers.jjuk.facing).toBe(1);
  });
});
