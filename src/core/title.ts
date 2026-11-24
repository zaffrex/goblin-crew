// 타이틀과 깬 판 맵의 순수 판단(#792, 설계 `docs/design/title-and-map.md`). DOM·저장소를 모른다.
// main.ts가 타이틀·맵 DOM을 그릴 때 어떤 버튼을 어떤 순서로 둘지, 버튼을 누르면 어느 화면에서 어떤 세이브로 시작할지를 여기서 고른다.
// 세이브 규칙은 `progress.ts` 그대로다(`startFromSave`, `saveOnCard`의 다시 하기 경로). 스키마는 안 바꾼다.

import { CHARACTERS, type CharacterId } from './characters';
import { isAllCleared, startFromSave, type Resume } from './progress';
import { RESTART_ARM_MS } from './restart';
import type { SaveData } from './save/schema';

/** 타이틀 버튼(문서 1절 자리 이름). 실제 글은 `ui.title.continue|new|map`(Kai). */
export type TitleButton = 'continue' | 'new' | 'map';

export interface TitleMenu {
  /** 위 → 아래. 맨 위가 주 버튼이고 y 132에 고정한다(2-1절). */
  buttons: TitleButton[];
  /** `つづき`가 갈 곳. 버튼이 없으면 `new`. */
  resume: Resume;
  /** 이번 판 클리어 카드가 이어 쓸 세이브(`startFromSave`). `はじめ`는 이걸 버리고 null로 시작한다. */
  prev: SaveData | null;
  /** `はじめ`를 두 번 눌러야 하나(지울 세이브가 있을 때만, 2-3절). */
  newNeedsConfirm: boolean;
}

/**
 * 2-1절 표. 세이브는 `startFromSave`를 거친 `prev`로 본다. checkpoint 화면이 배포 순서에 없는 옛 세이브는 이미 버리기로
 * 했으니(결정 기록 2026-11-22 save-start) 타이틀에서도 "세이브 없음"과 같다. `はじめ` 한 번에 시작하고, 첫 카드가 덮어쓴다.
 * - 없음 → `はじめ`
 * - 다 깸 → `マップ` / `はじめ` (다 깬 사람이 `はじめ`를 잘못 누를 길을 줄인다)
 * - 그 밖 → `つづき` / `はじめ` / `マップ`(배포 순서 안의 깬 판이 1개 이상일 때만)
 */
export function titleMenu(loaded: SaveData | null, order: readonly string[]): TitleMenu {
  const { resume, prev } = startFromSave(loaded, order);
  if (!prev) return { buttons: ['new'], resume, prev, newNeedsConfirm: false };
  if (isAllCleared(prev, order)) return { buttons: ['map', 'new'], resume, prev, newNeedsConfirm: true };
  const buttons: TitleButton[] = [];
  if (resume.kind === 'continue') buttons.push('continue');
  buttons.push('new');
  if (mapCards(prev, order).some((c) => c.state === 'cleared')) buttons.push('map');
  return { buttons, resume, prev, newNeedsConfirm: true };
}

/** 버튼을 누른 결과. `start`면 main.ts가 `order[index]`부터 `prev`로 판을 시작한다. */
export type TitleAction =
  | { kind: 'start'; index: number; prev: SaveData | null; activeCharacter: string | null }
  | { kind: 'arm' }
  | { kind: 'map' };

/**
 * `はじめ` 두 번 누르기 상태(2-3절). 처음부터 버튼(`restart.ts`)과 같은 3초(`RESTART_ARM_MS`).
 * 다른 버튼을 누르거나 3초가 지나면 풀린다.
 */
export interface TitleState {
  menu: TitleMenu;
  armedAt: number | null;
}

/** `はじめ` 두 번째 누름은 첫 누름 뒤 이만큼 지나야 먹는다(ms, #876 Luna 리뷰). 휴대폰 더블 탭 간격(약 300ms)보다 길다. */
export const TITLE_SECOND_PRESS_MIN_MS = 400;

export function createTitle(menu: TitleMenu): TitleState {
  return { menu, armedAt: null };
}

/** 지금 `はじめ` 두 번째 누름을 기다리는 중인가(확인 줄·노란 바탕을 그릴지). 시간이 지났으면 풀어 둔다. */
export function titleArmed(t: TitleState, now: number): boolean {
  if (t.armedAt !== null && now - t.armedAt >= RESTART_ARM_MS) t.armedAt = null;
  return t.armedAt !== null;
}

/**
 * 버튼 누름. 메뉴에 없는 버튼은 null(DOM에 없는 버튼이 눌릴 일은 없지만 키보드·재생 도구 대비).
 * - `つづき` → `resume` 화면, `prev` 이어 씀, 캐릭터는 세이브 것(main.ts가 `enterCharacter`로 그 화면에 맞춘다)
 * - `はじめ` → 세이브 있으면 첫 누름은 `arm`, 3초 안 두 번째에 `order[0]`·`prev = null`(맵 기록까지 지움, 2-2절 ①)
 * - `マップ` → 맵
 */
export function titlePress(t: TitleState, button: TitleButton, now: number): TitleAction | null {
  if (!t.menu.buttons.includes(button)) return null;
  const armed = titleArmed(t, now);
  // 더블 탭·키 반복 한 번에 맵 기록까지 날아가지 않게(#876 Luna 리뷰). 너무 이른 두 번째 누름은 버리고 arm을 그대로 둔다.
  if (button === 'new' && armed && now - t.armedAt! < TITLE_SECOND_PRESS_MIN_MS) return null;
  t.armedAt = null;
  if (button === 'map') return { kind: 'map' };
  if (button === 'continue') {
    const r = t.menu.resume;
    // 메뉴에 `continue`가 있으면 resume은 늘 continue다(titleMenu). 타입만 좁힌다.
    if (r.kind !== 'continue') return null;
    return { kind: 'start', index: r.index, prev: t.menu.prev, activeCharacter: r.activeCharacter };
  }
  if (t.menu.newNeedsConfirm && !armed) {
    t.armedAt = now;
    return { kind: 'arm' };
  }
  return { kind: 'start', index: 0, prev: null, activeCharacter: null };
}

/** 맵 카드 하나(3-1절). 배포 순서대로 왼쪽 → 오른쪽. */
export interface MapCard {
  screenId: string;
  index: number;
  state: 'cleared' | 'locked';
}

/** 깬 판만 연다(3-1절). 순서 밖의 `solvedScreens` id는 카드가 없다. */
export function mapCards(save: SaveData | null, order: readonly string[]): MapCard[] {
  const solved = new Set(save?.progress.solvedScreens ?? []);
  return order.map((screenId, index) => ({ screenId, index, state: solved.has(screenId) ? 'cleared' : 'locked' }));
}

/**
 * 깬 카드를 누르면 그 판 처음부터 다시 한다(3-4절). `prev`를 그대로 넘겨서 `saveOnCard`가 "다시 하기"로 읽고
 * `checkpoint`를 안 바꾼다. 잠긴 카드는 null(main.ts가 잠금 안내 줄을 2초 띄운다).
 */
export function mapPress(card: MapCard, prev: SaveData | null): TitleAction | null {
  if (card.state !== 'cleared') return null;
  return { kind: 'start', index: card.index, prev, activeCharacter: null };
}

/**
 * 쿼리가 있으면 타이틀을 건너뛰고 지금처럼 바로 게임이다(1절). 쿼리는 팀 도구용이다
 * (`?screen=`, `?playtest=1&order=`, 재생 훅은 `playtest=1`). 기본 링크(쿼리 없음)는 늘 타이틀부터.
 */
// 도구용 쿼리를 새로 만들면 여기에 같이 넣는다. 빠지면 그 도구만 타이틀에서 멈춘다(#876 Luna 리뷰).
export const TITLE_SKIP_KEYS = ['screen', 'playtest', 'order'] as const;

export function skipsTitle(query: (key: string) => string | null): boolean {
  return TITLE_SKIP_KEYS.some((k) => query(k) !== null);
}

/**
 * 타이틀 자리(내부 px, 설계 2절 표). 목업 `docs/design/title-map-mock.mjs` `TITLE`과 같은 숫자다.
 * 로고 칸(`public/ui/title-logo.json`, #874)은 `ja`·`en` 상자 가운데에 1배로 놓는다.
 */
export const TITLE_LAYOUT = {
  /** 배포 순서 첫 화면 배경 위 ink 덮개 투명도. */
  dim: 0.55,
  ja: { x: 90, y: 46, w: 300, h: 36 },
  en: { x: 160, y: 88, w: 160, h: 14 },
  buttons: { x: 174, y: 132, w: 132, h: 28, gap: 8 },
  confirm: { y: 240, w: 280, h: 14 },
  /** 캐릭터 셋: 몸 상자 왼끝(키 순서 쭉이 → 묵직이 → 삑삑이, 뒤 → 앞)과 발 y. */
  crew: { lefts: [16, 42, 68], footY: 252 },
} as const;

/** `k`번째 버튼 상자(위 → 아래). 맨 위는 버튼 수와 상관없이 y 132다(2-1절). */
export function titleButtonBox(k: number): { left: number; top: number; width: number; height: number } {
  const b = TITLE_LAYOUT.buttons;
  return { left: b.x, top: b.y + k * (b.h + b.gap), width: b.w, height: b.h };
}

/** 로고 칸(w×h)을 상자 가운데에 놓을 왼쪽 위. 정수 px(1배 픽셀 그림이라 반 px이면 번진다). */
export function centerIn(box: { x: number; y: number; w: number; h: number }, w: number, h: number): { x: number; y: number } {
  return { x: box.x + Math.floor((box.w - w) / 2), y: box.y + Math.floor((box.h - h) / 2) };
}

/** 캐릭터 셋 발 자리. 몸 상자 왼끝이 `crew.lefts`가 되게 `CHARACTERS` 히트 상자(dx)만큼 민다. 그리는 순서 = 배열 순서. */
export function titleCrew(): { id: CharacterId; x: number; y: number }[] {
  const { lefts, footY } = TITLE_LAYOUT.crew;
  return CHARACTERS.map((c, i) => ({ id: c.id, x: lefts[i]! - c.hit.dx, y: footY }));
}

/** 버튼 글 키(일본어는 Kai, 설계 4절). */
export const TITLE_TEXT_KEYS: Readonly<Record<TitleButton, string>> = { continue: 'ui.title.continue', new: 'ui.title.new', map: 'ui.title.map' };
export const TITLE_CONFIRM_KEY = 'ui.title.new_confirm';

/**
 * 1단계 타이틀이 쓰는 글이 글 파일에 다 있나. 없으면 타이틀을 건너뛰고 지금처럼 바로 게임이다.
 * 글 키 이름(`ui.title.new`)이 버튼에 그대로 찍히는 판이 기본 링크로 나가지 않게 한다. Kai 글 PR이 들어오면 코드 수정 없이 켜진다.
 * `マップ`는 맵 PR(#792 3/3)이 붙이므로 여기서 보지 않는다.
 */
export function titleTextReady(text: Readonly<Record<string, string>>): boolean {
  return [TITLE_TEXT_KEYS.continue, TITLE_TEXT_KEYS.new, TITLE_CONFIRM_KEY].every((k) => typeof text[k] === 'string' && text[k] !== '');
}

/** 맵이 붙기 전(#792 2/3) 메뉴: `マップ`를 뺀다. 다 깬 세이브는 `はじめ`만 남는다(두 번 누르기는 그대로). */
export function withoutMap(menu: TitleMenu): TitleMenu {
  return { ...menu, buttons: menu.buttons.filter((b) => b !== 'map') };
}
