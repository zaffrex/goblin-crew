// 시작 카드(설계 ui-interaction.md 6-2-1절, #285). 게임을 열면 목표·세 사람 특기·게이지 뜻을 한 장에 보여 준다.
// 카드가 떠 있는 동안 장면은 멈추고(진입 연출 포함) 입력은 카드만 받는다. UI 상태라 세이브·BFS와 무관하다.
// M1은 세이브가 없어서 매번 띄운다(새로고침마다 한 장).

import { CHARACTERS, type CharacterId } from './characters';
import { TICK_HZ } from './config';

/** 카드가 뜨고 이만큼 지나야 탭이 먹는다(1.0초, 말풍선 처음 보는 대사와 같은 값). 연타로 읽기 전에 닫히는 걸 막는다. */
export const CARD_LOCK_TICKS = TICK_HZ;

export interface StartCard {
  open: boolean;
  /** 카드가 뜬 뒤 지난 틱. */
  ticks: number;
}

export function createStartCard(): StartCard {
  return { open: true, ticks: 0 };
}

/** 고정 틱마다 부른다. 카드가 떠 있으면 시간을 센다. */
export function cardTick(c: StartCard): void {
  if (c.open) c.ticks++;
}

/** 탭(클릭·키)으로 닫을 수 있나. */
export function cardReady(c: StartCard): boolean {
  return c.open && c.ticks >= CARD_LOCK_TICKS;
}

/**
 * 탭(클릭·아무 키)이 왔다. 카드가 떠 있으면 이 입력은 카드 몫이라 true(게임으로 넘기지 않는다).
 * 잠금이 풀렸으면 카드를 닫는다. 닫는 입력도 true다(그 탭으로 걷지 않는다).
 */
export function cardInput(c: StartCard): boolean {
  if (!c.open) return false;
  if (c.ticks >= CARD_LOCK_TICKS) c.open = false;
  return true;
}

/** 얼굴 head 한 변(시트 px). HUD 캐릭터 칸과 같은 그림. */
export const CARD_FACE_PX = 24;

/** 이 화면 배율(CSS) 미만이면 카드를 압축한다(667×375 @2 = 1.0배 등, #335). HUD 이름표 압축(6-4-2절)과 같은 경계. */
export const CARD_TIGHT_BELOW = 1.2;

export function cardTight(scale: number): boolean {
  return scale < CARD_TIGHT_BELOW;
}

/**
 * 카드 얼굴 CSS 크기. 그림 24px을 **장치 px 정수배 k**로 키운다(메인 캔버스처럼, #310). CSS = 24·k/dpr.
 * - 보통: k = max(ceil(2·dpr), floor(배율·dpr)). 글자가 내부 8px × 배율로 커지니 얼굴도 같이 커져 줄마다 약 3em(6-2-1절, PR #306 리뷰).
 *   dpr 1에서 1280×720(2)은 48, 1600×900(3.33)은 72, 1920×1080(4)은 96. 휴대폰 가로 844×390 @3은 48.
 * - 압축(배율 1.2 미만, #335): k = max(1, floor(1.5·dpr)). 667×375 @2는 36(장치 72 = 3배). 48이면 카드가 높이 상한을 넘어
 *   `タップではじめる`가 스크롤 아래로 숨는다. 32는 장치 64 = 2.67배라 픽셀이 고르지 않아서 쓰지 않는다.
 */
export function cardFacePx(scale: number, dpr = 1): number {
  const d = dpr > 0 ? dpr : 1;
  // 배율·dpr 곱은 장치 px 정수 배율이라 3.9999 같은 부동소수 오차만 흡수한다.
  const k = cardTight(scale) ? Math.max(1, Math.floor(1.5 * d + 1e-6)) : Math.max(Math.ceil(2 * d - 1e-6), Math.floor(scale * d + 1e-6));
  return (CARD_FACE_PX * k) / d;
}

export interface CardRow {
  id: CharacterId;
  name: string;
  /** `ui.verb.<능력>: ui.ability.<능력>` */
  ability: string;
}

export interface CardText {
  goal: string;
  why: string;
  rows: CardRow[];
  gauge: string;
  start: string;
}

/** 카드 글(6-2-6절 키). 특기 줄은 캐릭터 정의 순서(HUD 칸 순서와 같다). */
export function cardText(t: (id: string) => string): CardText {
  return {
    goal: t('ui.card.goal'),
    why: t('ui.card.why'),
    rows: CHARACTERS.map((c) => ({ id: c.id, name: t(`char.${c.id}.name`), ability: `${t(`ui.verb.${c.ability}`)}: ${t(`ui.ability.${c.ability}`)}` })),
    gauge: t('ui.card.gauge'),
    start: t('ui.card.start'),
  };
}
