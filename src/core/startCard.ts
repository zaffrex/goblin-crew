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

/**
 * 카드 얼굴 CSS 크기 = head 24 × max(2, floor(화면 배율)). 정수 배율이라 픽셀이 고르게 커진다.
 * 글자는 내부 8px × 배율로 커지므로 얼굴도 같이 커져야 줄마다 약 3em을 지킨다(6-2-1절, PR #306 리뷰).
 * 휴대폰 가로(배율 1.33)·1280×720(2)은 48, 1600×900(3.33)은 72, 1920×1080(4)은 96(HUD 얼굴과 같은 크기).
 */
export function cardFacePx(scale: number): number {
  return CARD_FACE_PX * Math.max(2, Math.floor(scale));
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
