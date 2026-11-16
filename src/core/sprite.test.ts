import { describe, expect, it } from 'vitest';
import { WALK_SPEED } from './config';
import jjukJson from '../../public/sprites/jjuk-base.json';
import { cueMs, frameSourceX, parseSpriteMeta, POLE_WIDTH, spriteBox, spriteFacing, spriteFrame, spritePole, type Pose, type SpriteMeta } from './sprite';

const JJUK = parseSpriteMeta(jjukJson);
const still: Pose = { walkedPx: null, holding: false, event: null, clockMs: 0 };

describe('parseSpriteMeta', () => {
  it('커밋된 쭉이 시트 메타를 받아들인다', () => {
    expect(JJUK.character).toBe('jjuk');
    expect(JJUK.cell).toEqual([48, 64]);
  });

  it.each([
    ['cell 없음', { cell: undefined }],
    ['anchor 소수', { anchor: [25.5, 64] }],
    ['walkCycle 0', { walkCycle: 0 }],
    ['ms 길이가 frames와 다름', { anims: { idle: { frames: [0, 1], ms: [700] } } }],
    ['by가 distance가 아님', { anims: { walk: { frames: [2], by: 'time' } } }],
    ['frames 비었음', { anims: { idle: { frames: [], ms: [] } } }],
    ['facing이 1·-1이 아님', { anims: { hold: { frames: [0], ms: [450], facing: 0 } } }],
    ['tip 길이가 frames와 다름', { anims: { r: { frames: [0, 1], ms: [50, 50], tip: [[34, 0]], claw: [0, 1] } } }],
    ['tip이 있는데 claw 번호 없음', { anims: { r: { frames: [0], ms: [50], tip: [[34, 0]] } } }],
    ['tip이 있는데 시트 claw 없음', { claw: undefined, anims: { r: { frames: [0], ms: [50], tip: [[34, 0]], claw: [0] } } }],
    ['시트 claw anchor 형식', { claw: { image: 'x.png', cell: [8, 8], anchor: [4] } }],
    ['cue가 칸 수 밖', { anims: { r: { frames: [0, 1], ms: [50, 50], cue: 2 } } }],
    ['cue가 음수', { anims: { r: { frames: [0, 1], ms: [50, 50], cue: -1 } } }],
    ['cue가 거리 넘김 자세에', { anims: { walk: { frames: [2, 3], by: 'distance', cue: 0 } } }],
  ])('%s → 던진다(그 캐릭터는 실루엣으로 남는다)', (_, patch) => {
    expect(() => parseSpriteMeta({ ...JJUK, ...patch })).toThrow(/스프라이트 메타 오류/);
  });
});

describe('cueMs (칸 신호, #199)', () => {
  const meta = parseSpriteMeta({ ...JJUK, anims: { ...JJUK.anims, r: { frames: [0, 1, 2], ms: [200, 350, 450], cue: 1 } } });
  it('신호 칸 앞 칸들의 ms 합이다', () => {
    expect(cueMs(meta, 'r')).toBe(200);
    expect(cueMs(parseSpriteMeta({ ...JJUK, anims: { ...JJUK.anims, r: { frames: [0, 1], ms: [50, 50], cue: 0 } } }), 'r')).toBe(0);
  });
  it('신호 없는 자세, 시트에 없는 자세, 시트 없음 → null', () => {
    expect(cueMs(meta, 'idle')).toBeNull();
    expect(cueMs(meta, 'common.nope')).toBeNull();
    expect(cueMs(undefined, 'r')).toBeNull();
  });
});

describe('spriteFrame', () => {
  it('서 있기: anims.idle.ms대로 돌고 반복한다(700 + 500)', () => {
    expect(spriteFrame(JJUK, { ...still, clockMs: 0 })).toBe(0);
    expect(spriteFrame(JJUK, { ...still, clockMs: 699 })).toBe(0);
    expect(spriteFrame(JJUK, { ...still, clockMs: 700 })).toBe(1);
    expect(spriteFrame(JJUK, { ...still, clockMs: 1199 })).toBe(1);
    expect(spriteFrame(JJUK, { ...still, clockMs: 1200 })).toBe(0);
  });

  it('걷기: 시간이 아니라 걸은 거리로 넘긴다(walkCycle 36px / 6장 = 6px마다 1장)', () => {
    const at = (px: number) => spriteFrame(JJUK, { ...still, walkedPx: px });
    expect([0, 5.9, 6, 12, 30, 35.9, 36, 42].map(at)).toEqual([2, 2, 3, 4, 7, 7, 2, 3]);
  });

  it('걷기 한 주기(36px)를 걷는 틱 수 = 36 / WALK_SPEED, 그동안 6장을 정확히 한 번씩 보인다', () => {
    const ticks = JJUK.walkCycle / WALK_SPEED;
    const seen = new Set<number | null>();
    for (let t = 0; t < ticks; t++) seen.add(spriteFrame(JJUK, { ...still, walkedPx: t * WALK_SPEED }));
    expect([...seen]).toEqual([2, 3, 4, 5, 6, 7]);
  });

  it('시트에 없는 자세는 null(실루엣): 매달림, 아직 안 그린 연출', () => {
    const noHold = Object.fromEntries(Object.entries(JJUK.anims).filter(([name]) => name !== 'hold'));
    expect(spriteFrame({ ...JJUK, anims: noHold }, { ...still, holding: true })).toBeNull();
    expect(spriteFrame(JJUK, { ...still, event: { name: 'common.bump_bottom', ms: 0 } })).toBeNull();
  });

  it('쭉이 시트의 화면 1 자세(#142): 매달림은 반복, 찌릿은 500ms 안에 끝나고 마지막 장에 머문다', () => {
    const hold = JJUK.anims.hold!;
    const zap = JJUK.anims['common.zap']!;
    expect(spriteFrame(JJUK, { ...still, holding: true, clockMs: 0 })).toBe(hold.frames[0]);
    expect(spriteFrame(JJUK, { ...still, holding: true, clockMs: 450 })).toBe(hold.frames[1]);
    expect(spriteFrame(JJUK, { ...still, holding: true, clockMs: 900 })).toBe(hold.frames[0]);
    expect('ms' in zap && zap.ms.reduce((a, b) => a + b, 0)).toBe(500); // 지금 캐릭터 anim busy(TIMING.anim 30틱)와 같다
    expect(spriteFrame(JJUK, { ...still, event: { name: 'common.zap', ms: 499 } })).toBe(zap.frames[2]);
    expect(spriteFrame(JJUK, { ...still, event: { name: 'common.zap', ms: 2000 } })).toBe(zap.frames[2]);
  });

  it('연출이 매달림·걷기보다 앞선다. 연출은 반복하지 않고 마지막 장에 머문다', () => {
    const meta: SpriteMeta = {
      ...JJUK,
      anims: { ...JJUK.anims, 'common.bump_bottom': { frames: [8, 9], ms: [100, 100] }, hold: { frames: [10], ms: [500] } },
    };
    const ev = (ms: number): Pose => ({ ...still, holding: true, walkedPx: 6, event: { name: 'common.bump_bottom', ms } });
    expect(spriteFrame(meta, ev(0))).toBe(8);
    expect(spriteFrame(meta, ev(100))).toBe(9);
    expect(spriteFrame(meta, ev(5000))).toBe(9);
    expect(spriteFrame(meta, { ...still, holding: true, walkedPx: 6 })).toBe(10);
  });

  it('다른 캐릭터 시트도 json만으로 붙는다(쭉이 전용 분기 없음)', () => {
    const muk: SpriteMeta = { ...JJUK, character: 'mukjik', image: 'mukjik-base.png' };
    expect(spriteFrame(muk, { ...still, walkedPx: 6 })).toBe(3);
  });
});

describe('spriteBox', () => {
  it('오른쪽: 기준점(25, 64)이 발 위치에 온다', () => {
    expect(spriteBox(JJUK, 100, 200, 1)).toEqual({ left: 75, top: 136, width: 48, height: 64 });
  });

  it('왼쪽: 기준점 ax 경계를 축으로 뒤집는다(오른쪽 칸과 발 위치 기준 좌우 대칭)', () => {
    const r = spriteBox(JJUK, 100, 200, 1);
    const l = spriteBox(JJUK, 100, 200, -1);
    expect(l).toEqual({ left: 100 - (48 - 25), top: 136, width: 48, height: 64 });
    expect(100 - l.left).toBe(r.left + r.width - 100);
  });

  it('발 위치는 반올림한다(걷기 중 소수 좌표에서 1px 떨림 방지)', () => {
    expect(spriteBox(JJUK, 100.4, 199.6, 1).left).toBe(75);
    expect(spriteBox(JJUK, 100.4, 199.6, 1).top).toBe(136);
  });

  it('프레임 n은 가로 한 줄의 n번째 칸', () => {
    expect(frameSourceX(JJUK, 0)).toBe(0);
    expect(frameSourceX(JJUK, 7)).toBe(7 * 48);
  });
});

describe('spriteFacing', () => {
  const withHold = (facing?: 1 | -1): SpriteMeta => ({
    ...JJUK,
    anims: { ...JJUK.anims, hold: { frames: [0, 1], ms: [450, 450], ...(facing ? { facing } : {}) } },
  });
  const hanging: Pose = { walkedPx: null, holding: true, event: null, clockMs: 0 };

  it('매달린 동안은 시트 hold.facing으로 고정한다: 오른쪽으로 걸어와 발사돼도 고리 쪽을 본다(#182)', () => {
    expect(spriteFacing(withHold(-1), hanging, 1)).toBe(-1);
    expect(spriteFacing(withHold(-1), hanging, -1)).toBe(-1);
  });

  it('매달린 채 연출(찌릿)이 재생돼도 방향은 그대로', () => {
    expect(spriteFacing(withHold(-1), { ...hanging, event: { name: 'common.zap', ms: 0 } }, 1)).toBe(-1);
  });

  it('연출 자세에 facing이 있으면 그 연출 동안 그 방향이다(둥지 뻗기 reach_hang_up, #189)', () => {
    const reachPose: Pose = { ...hanging, event: { name: 'reach_hang_up', ms: 0 } };
    expect(JJUK.anims.reach_hang_up?.facing).toBe(-1);
    expect(spriteFacing(JJUK, reachPose, 1)).toBe(-1);
    expect(spriteFacing(JJUK, { ...reachPose, holding: false }, 1)).toBe(-1);
    // 발사 연출은 방향을 고정하지 않는다(그림 주석 "시소에 어느 쪽에서 왔든").
    expect(spriteFacing(JJUK, { ...still, event: { name: 'launch_to_hook', ms: 0 } }, 1)).toBe(1);
  });

  it('매달리지 않았거나 시트에 hold.facing이 없으면 걷는 방향', () => {
    expect(spriteFacing(withHold(-1), { ...hanging, holding: false }, 1)).toBe(1);
    expect(spriteFacing(withHold(), hanging, 1)).toBe(1);
  });
});

describe('spritePole (5-1절 장대 잇기, #189)', () => {
  const reach = JJUK.anims.reach_hang_up!;
  const HOOK = { x: 160, y: 160 };
  const NEST = { x: 150, y: 34 };
  const pose = (ms: number, extra: Partial<Pose> = {}): Pose => ({ ...still, holding: true, event: { name: 'reach_hang_up', ms }, reach: NEST, ...extra });

  it('고리에서 왼쪽을 보면 tip x 34가 화면 151(장대 150·151열)이고, 칸 위 끝 96에서 둥지 y 34까지 수직으로 잇는다', () => {
    const p = spritePole(JJUK, pose(0), HOOK.x, HOOK.y, -1)!;
    expect(p).not.toBeNull();
    expect(p.left).toBe(149); // 잉크 149, 장대 150·151, 잉크 152
    expect([p.top, p.bottom]).toEqual([34, 96]);
    expect(p.src).toEqual({ x: frameSourceX(JJUK, reach.frames[0]!) + 34 - POLE_WIDTH / 2, y: 0, width: POLE_WIDTH });
    // 집게 8×8, anchor (4,8): 장대 가운데선에 맞추고 아래 끝이 대상 y.
    expect([p.clawLeft, p.clawTop, p.flip]).toEqual([151 - 4, 26, true]);
  });

  it('오른쪽을 보면 뒤집지 않고 칸 왼쪽 + tip x', () => {
    const p = spritePole(JJUK, pose(0), HOOK.x, HOOK.y, 1)!;
    const left = HOOK.x - JJUK.anchor[0];
    expect(p.left).toBe(left + 34 - 2);
    expect([p.clawLeft, p.flip]).toEqual([left + 34 - 4, false]);
  });

  it('집게 칸은 프레임마다(벌림 → 다묾), 연출이 끝난 뒤(마지막 장 유지)에도 마지막 칸', () => {
    const at = (ms: number): number => spritePole(JJUK, pose(ms), HOOK.x, HOOK.y, -1)!.claw;
    expect([at(0), at(349), at(350), at(600), at(5000)]).toEqual([reach.claw![0], reach.claw![0], reach.claw![1], reach.claw![2], reach.claw![2]]);
  });

  it('tip 없는 자세, 대상 점 없음, 대상이 칸 위가 아님 → 잇지 않는다', () => {
    expect(spritePole(JJUK, pose(0, { event: { name: 'common.zap', ms: 0 } }), HOOK.x, HOOK.y, -1)).toBeNull();
    expect(spritePole(JJUK, pose(0, { event: null }), HOOK.x, HOOK.y, -1)).toBeNull();
    expect(spritePole(JJUK, pose(0, { reach: null }), HOOK.x, HOOK.y, -1)).toBeNull();
    expect(spritePole(JJUK, pose(0, { reach: { x: 150, y: 120 } }), HOOK.x, HOOK.y, -1)).toBeNull();
  });
});
