import { describe, expect, it } from 'vitest';
import { saveOnCard } from './progress';
import { RESTART_ARM_MS } from './restart';
import type { SaveData } from './save/schema';
import { FLOW_TIMING, flowTick, flowView, type Flow } from './flow';
import { centerIn, createTitle, entryFadeCover, ENTRY_FADE_TICKS, loadingTextShown, titleFadeCover, TITLE_FADE_OUT_MS, mapCards, mapPress, skipsTitle, titleArmed, titleButtonBox, titleCrew, titleMenu, titlePress, titleTextReady, TITLE_LAYOUT, TITLE_SECOND_PRESS_MIN_MS, withoutMap } from './title';
import { CHARACTERS } from './characters';

const ORDER = ['laundromat', 'magpie_nest', 'park_fountain'];
const mk = (screenId: string, solved: string[]): SaveData => ({
  version: 1, contentVersion: 'c1', updatedAt: '2026-11-22T00:00:00.000Z',
  progress: { solvedScreens: solved }, checkpoint: { screenId, gauge: 5, activeCharacter: 'zuk', carriedItems: [] },
});

describe('titleMenu (2-1절 버튼 조건과 순서)', () => {
  it('세이브 없음 → はじめ 하나, 확인 없음', () => {
    expect(titleMenu(null, ORDER)).toMatchObject({ buttons: ['new'], prev: null, newNeedsConfirm: false });
  });
  it('첫 판 진행 중(깬 판 0) → つづき / はじめ, 맵 없음', () => {
    expect(titleMenu(mk('laundromat', []), ORDER).buttons).toEqual(['continue', 'new']);
  });
  it('깬 판 1개 이상 → つづき / はじめ / マップ', () => {
    const m = titleMenu(mk('magpie_nest', ['laundromat']), ORDER);
    expect(m.buttons).toEqual(['continue', 'new', 'map']);
    expect(m.newNeedsConfirm).toBe(true);
  });
  it('다 깸 → マップ가 주 버튼, つづき 없음', () => {
    expect(titleMenu(mk('park_fountain', ORDER), ORDER).buttons).toEqual(['map', 'new']);
  });
  it('다 깬 뒤 화면이 늘면 つづき가 다시 나온다', () => {
    expect(titleMenu(mk('park_fountain', ORDER), [...ORDER, 'extra']).buttons).toEqual(['continue', 'new', 'map']);
  });
  it('checkpoint 화면이 배포 순서에 없는 옛 세이브 → 세이브 없음과 같다', () => {
    expect(titleMenu(mk('gone', ['laundromat']), ORDER)).toMatchObject({ buttons: ['new'], prev: null, newNeedsConfirm: false });
  });
  it('순서 밖 id만 깼으면 맵 버튼이 없다', () => {
    expect(titleMenu(mk('laundromat', ['gone']), ORDER).buttons).toEqual(['continue', 'new']);
  });
});

describe('titlePress', () => {
  it('つづき → resume 화면에서 prev 이어 씀', () => {
    const save = mk('magpie_nest', ['laundromat']);
    const t = createTitle(titleMenu(save, ORDER));
    expect(titlePress(t, 'continue', 0)).toEqual({ kind: 'start', index: 1, prev: save, activeCharacter: 'zuk' });
  });
  it('세이브 없으면 はじめ 한 번에 시작', () => {
    const t = createTitle(titleMenu(null, ORDER));
    expect(titlePress(t, 'new', 0)).toEqual({ kind: 'start', index: 0, prev: null, activeCharacter: null });
  });
  it('세이브 있으면 はじめ 첫 누름은 arm, 3초 안 두 번째에 prev = null로 처음부터', () => {
    const t = createTitle(titleMenu(mk('magpie_nest', ['laundromat']), ORDER));
    expect(titlePress(t, 'new', 1000)).toEqual({ kind: 'arm' });
    expect(titleArmed(t, 1000 + RESTART_ARM_MS - 1)).toBe(true);
    expect(titlePress(t, 'new', 1000 + RESTART_ARM_MS - 1)).toEqual({ kind: 'start', index: 0, prev: null, activeCharacter: null });
  });
  it('두 번째 누름이 400ms 안이면 버리고 arm을 그대로 둔다(더블 탭)', () => {
    const t = createTitle(titleMenu(mk('magpie_nest', ['laundromat']), ORDER));
    titlePress(t, 'new', 1000);
    expect(titlePress(t, 'new', 1000 + TITLE_SECOND_PRESS_MIN_MS - 1)).toBeNull();
    expect(titleArmed(t, 1000 + TITLE_SECOND_PRESS_MIN_MS - 1)).toBe(true);
    // 버린 누름은 3초를 다시 세지 않는다: 첫 누름 기준 그대로.
    expect(titlePress(t, 'new', 1000 + TITLE_SECOND_PRESS_MIN_MS)).toEqual({ kind: 'start', index: 0, prev: null, activeCharacter: null });
  });
  it('3초가 지나면 다시 첫 누름', () => {
    const t = createTitle(titleMenu(mk('magpie_nest', ['laundromat']), ORDER));
    titlePress(t, 'new', 0);
    expect(titleArmed(t, RESTART_ARM_MS)).toBe(false);
    expect(titlePress(t, 'new', RESTART_ARM_MS)).toEqual({ kind: 'arm' });
  });
  it('다른 버튼을 누르면 풀린다', () => {
    const t = createTitle(titleMenu(mk('magpie_nest', ['laundromat']), ORDER));
    titlePress(t, 'new', 0);
    expect(titlePress(t, 'map', 100)).toEqual({ kind: 'map' });
    expect(titleArmed(t, 200)).toBe(false);
    expect(titlePress(t, 'new', 200)).toEqual({ kind: 'arm' });
  });
  it('메뉴에 없는 버튼은 null', () => {
    const t = createTitle(titleMenu(null, ORDER));
    expect(titlePress(t, 'continue', 0)).toBeNull();
    expect(titlePress(t, 'map', 0)).toBeNull();
  });
});

describe('mapCards / mapPress (3-1, 3-4절)', () => {
  it('배포 순서대로, 깬 판만 cleared', () => {
    expect(mapCards(mk('park_fountain', ['laundromat', 'magpie_nest']), ORDER).map((c) => c.state)).toEqual(['cleared', 'cleared', 'locked']);
  });
  it('잠긴 카드는 안 열린다', () => {
    const save = mk('magpie_nest', ['laundromat']);
    expect(mapPress(mapCards(save, ORDER)[1]!, save)).toBeNull();
  });
  it('맵에서 다시 깨도 checkpoint가 그대로다(#792 완료 조건)', () => {
    const save = mk('park_fountain', ['laundromat', 'magpie_nest']);
    const a = mapPress(mapCards(save, ORDER)[0]!, save);
    expect(a).toEqual({ kind: 'start', index: 0, prev: save, activeCharacter: null });
    if (a?.kind !== 'start') throw new Error('start 아님');
    const after = saveOnCard({ prev: a.prev, order: ORDER, index: a.index, activeCharacter: 'muk', contentVersion: 'c1', now: new Date('2026-11-24T00:00:00Z') });
    expect(after.checkpoint).toEqual(save.checkpoint);
    expect(after.progress.solvedScreens).toEqual(save.progress.solvedScreens);
  });
});

describe('skipsTitle (1절)', () => {
  // core는 DOM lib 없이 타입체크한다(tsconfig.core.json). URLSearchParams 대신 작은 파서.
  const q = (s: string) => (k: string): string | null => {
    for (const pair of s.replace(/^\?/, '').split('&')) {
      if (!pair) continue;
      const [key, value = ''] = pair.split('=');
      if (key === k) return value;
    }
    return null;
  };
  it('기본 링크는 타이틀부터', () => expect(skipsTitle(q(''))).toBe(false));
  it('팀 도구 쿼리는 건너뛴다', () => {
    expect(skipsTitle(q('?screen=magpie_nest'))).toBe(true);
    expect(skipsTitle(q('?playtest=1'))).toBe(true);
    expect(skipsTitle(q('?playtest=1&order=magpie_nest,park_fountain'))).toBe(true);
  });
  it('모르는 쿼리는 타이틀을 막지 않는다', () => expect(skipsTitle(q('?utm_source=x'))).toBe(false));
  it('재생 도구 `?playtest=1&title=1`만 타이틀을 띄운다(--via-map)', () => {
    expect(skipsTitle(q('?playtest=1&title=1'))).toBe(false);
    expect(skipsTitle(q('?title=1&playtest=1'))).toBe(false);
    expect(skipsTitle(q('?playtest=1&title=0'))).toBe(true);
    expect(skipsTitle(q('?playtest=0&title=1'))).toBe(true);
    expect(skipsTitle(q('?screen=magpie_nest&title=1'))).toBe(true);
  });
});

describe('타이틀 자리·글 (2절, 4절)', () => {
  it('맨 위 버튼은 y 132, 아래로 8 간격', () => {
    expect([0, 1, 2].map((k) => titleButtonBox(k).top)).toEqual([132, 168, 204]);
    expect(titleButtonBox(0)).toMatchObject({ left: 174, width: 132, height: 28 });
  });
  it('로고 칸은 상자 가운데 정수 px', () => {
    expect(centerIn({ x: 90, y: 46, w: 300, h: 36 }, 250, 36)).toEqual({ x: 115, y: 46 });
    expect(centerIn({ x: 160, y: 88, w: 160, h: 14 }, 110, 11)).toEqual({ x: 185, y: 89 });
  });
  it('캐릭터 셋은 묵직이를 맨 뒤(발 y 249)에 그리고, 몸 상자 왼끝 쭉이 8 · 묵직이 32 · 삑삑이 63', () => {
    expect(titleCrew().map((c) => [c.id, c.x, c.y])).toEqual([['mukjik', 54, 249], ['jjuk', 21, 252], ['ppik', 77, 252]]);
  });
  it('캐릭터 셋 몸 상자 오른끝이 확인 줄 왼끝(x 100)보다 왼쪽, 셋 다 한 번씩', () => {
    const right = Math.max(...titleCrew().map((m) => { const c = CHARACTERS.find((k) => k.id === m.id)!; return m.x + c.hit.dx + c.hit.width; }));
    expect(right).toBe(96);
    expect(right).toBeLessThan((480 - TITLE_LAYOUT.confirm.w) / 2);
    expect(titleCrew().map((c) => c.id).sort()).toEqual(CHARACTERS.map((c) => c.id).sort());
  });
  it('버튼 글이 하나라도 없으면 타이틀을 안 띄운다(키 이름이 찍히지 않게)', () => {
    const all = { 'ui.title.continue': 'a', 'ui.title.new': 'b', 'ui.title.new_confirm': 'c' };
    expect(titleTextReady(all)).toBe(true);
    expect(titleTextReady({ ...all, 'ui.title.new_confirm': '' })).toBe(false);
    expect(titleTextReady({ 'ui.title.new': 'b' })).toBe(false);
  });
  it('맵 전(2/3)에는 マップ를 뺀다. 다 깬 세이브는 はじめ만, 두 번 누르기 그대로', () => {
    expect(withoutMap(titleMenu(mk('magpie_nest', ['laundromat']), ORDER)).buttons).toEqual(['continue', 'new']);
    const done = withoutMap(titleMenu(mk('park_fountain', ORDER), ORDER));
    expect(done).toMatchObject({ buttons: ['new'], newNeedsConfirm: true });
    expect(titlePress(createTitle(done), 'map', 0)).toBeNull();
  });
});

describe('타이틀 → 게임 페이드 (2-4절, 11-1절 같은 0.3초)', () => {
  it('어두워짐은 0.3초에 덮개 1, 그 전은 비례', () => {
    expect(TITLE_FADE_OUT_MS).toBe(300);
    expect(titleFadeCover(0)).toBe(0);
    expect(titleFadeCover(150)).toBeCloseTo(0.5);
    expect(titleFadeCover(300)).toBe(1);
    expect(titleFadeCover(1000)).toBe(1);
    expect(titleFadeCover(-5)).toBe(0);
  });
  it('밝아짐 덮개 줄은 화면 전환 fadeIn과 같다(덮개 > 0 칸 수·값)', () => {
    const flowCovers: number[] = [];
    let f: Flow = { phase: 'fadeIn', t: 0 };
    while (f.phase === 'fadeIn') {
      flowCovers.push(flowView(f, false).cover);
      f = flowTick(f, true).flow;
    }
    const entryCovers: number[] = [];
    for (let left = ENTRY_FADE_TICKS; left > 0; left--) entryCovers.push(entryFadeCover(left));
    expect(entryCovers.length).toBe(flowCovers.length);
    entryCovers.forEach((c, k) => expect(c).toBeCloseTo(flowCovers[k]!));
    expect(entryFadeCover(0)).toBe(0);
    expect(FLOW_TIMING.fadeIn).toBe(18);
  });
  it('타이틀 뒤 로딩 글은 0.5초 뒤에만, 타이틀 없으면 바로', () => {
    expect(loadingTextShown(true, 0)).toBe(false);
    expect(loadingTextShown(true, 499)).toBe(false);
    expect(loadingTextShown(true, 500)).toBe(true);
    expect(loadingTextShown(false, 0)).toBe(true);
  });
});
