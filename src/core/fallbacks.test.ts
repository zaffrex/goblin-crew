import { describe, expect, it } from 'vitest';
import { frameFallbacks, poseKey, type FrameArt } from './fallbacks';
import type { Pose } from './sprite';

const still: Pose = { walkedPx: null, holding: false, event: null, clockMs: 0 };
const done: FrameArt = { bg: 'ready', objects: 'ready', boxes: [], chars: [{ id: 'jjuk', sheet: 'ready', drawn: true, pose: still }] };

describe('poseKey', () => {
  it('연출 > 매달림 > 걷기 > 서 있기 순서로 고른다(spriteFrame과 같은 순서)', () => {
    expect(poseKey(still)).toBe('idle');
    expect(poseKey({ ...still, walkedPx: 3 })).toBe('walk');
    expect(poseKey({ ...still, walkedPx: 0 })).toBe('walk');
    expect(poseKey({ ...still, walkedPx: 3, holding: true })).toBe('hold');
    expect(poseKey({ ...still, holding: true, event: { name: 'common.bump_bottom', ms: 10 } })).toBe('common.bump_bottom');
  });
});

describe('frameFallbacks', () => {
  it('전부 실제 그림이면 빈 목록', () => {
    expect(frameFallbacks(done)).toEqual([]);
  });

  it('배경 draft(none)는 bg, 읽히는 중이면 세지 않는다', () => {
    expect(frameFallbacks({ ...done, bg: 'none' })).toEqual(['bg']);
    expect(frameFallbacks({ ...done, bg: 'loading' })).toEqual([]);
  });

  it('임시 상자: 물건 시트가 읽히는 중이면 세지 않고, 없거나 읽혔으면 남은 대상을 센다', () => {
    expect(frameFallbacks({ ...done, objects: 'loading', boxes: ['hook', 'nest'] })).toEqual([]);
    expect(frameFallbacks({ ...done, objects: 'none', boxes: ['hook'] })).toEqual(['box:hook']);
    expect(frameFallbacks({ ...done, objects: 'ready', boxes: ['ground_left'] })).toEqual(['box:ground_left']);
  });

  it('캐릭터: 시트가 없거나 그 자세가 없어 실루엣으로 그렸으면 캐릭터:자세', () => {
    const chars: FrameArt['chars'] = [
      { id: 'jjuk', sheet: 'ready', drawn: false, pose: { ...still, holding: true } },
      { id: 'mukjik', sheet: 'ready', drawn: true, pose: still },
      { id: 'ppik', sheet: 'none', drawn: false, pose: { ...still, walkedPx: 12 } },
    ];
    expect(frameFallbacks({ ...done, chars })).toEqual(['char:jjuk:hold', 'char:ppik:walk']);
  });

  it('시트가 읽히는 중인 캐릭터는 세지 않는다(첫 프레임 거짓 경고 방지)', () => {
    expect(frameFallbacks({ ...done, chars: [{ id: 'ppik', sheet: 'loading', drawn: false, pose: still }] })).toEqual([]);
  });
  it('소리 글자: 시트가 읽히는 중이면 세지 않고, 시트가 없거나 칸이 없어 임시 별로 그렸으면 fx:이름', () => {
    expect(frameFallbacks({ ...done, fx: [{ effect: 'stomp_text', sheet: 'loading', drawn: false }] })).toEqual([]);
    expect(frameFallbacks({ ...done, fx: [{ effect: 'stomp_text', sheet: 'ready', drawn: true }] })).toEqual([]);
    expect(
      frameFallbacks({
        ...done,
        fx: [
          { effect: 'stomp_text', sheet: 'none', drawn: false },
          { effect: 'ting_text', sheet: 'ready', drawn: false },
        ],
      }),
    ).toEqual(['fx:stomp_text', 'fx:ting_text']);
  });
});
