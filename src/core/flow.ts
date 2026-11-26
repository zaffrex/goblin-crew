// 여러 화면 연결의 순수 로직(M2, #230). 설계 `docs/design/ui-interaction.md` 11절,
// L1 기록 `docs/decisions/2026-11-17-screen-transition-ui.md`.
// 이 파일은 DOM·저장소를 모른다. main.ts의 `enterScreen()` 세션 객체(연결 PR)가 틱마다 부르고,
// 결과(덮개 투명도, 카드 글 보이기, 화면 바꾸기)를 그린다. 시간은 틱(60Hz)으로만 센다(ADR-0004 결정 2).
//
// 플레이 순서는 id 목록이고 같은 id가 두 번 나올 수 있다(playtest `order=magpie_nest,magpie_nest`, 11-6절).
// 그래서 "다음 화면"은 id가 아니라 순서 안의 위치(index)로 찾는다.

import { DEFAULT_SCREEN } from "./screenPick";

/** 11-1절 표. 단위는 틱(60Hz). */
export const FLOW_TIMING = {
  /** 카드가 뜬 뒤 탭을 무시하는 시간(0.6초). 끝나면 `ui.next`가 보인다. */
  cardIgnore: 36,
  /** 어두워짐(0.3초). */
  fadeOut: 18,
  /** 다음 화면 그림을 기다리는 동안 이만큼 지나면 가운데 `…`를 띄운다(0.5초). */
  waitDots: 30,
  /** 밝아짐(0.3초). */
  fadeIn: 18,
} as const;

const ID_RE = /^[A-Za-z0-9_.-]{1,64}$/;

export type OrderResult =
  { ok: true; order: string[] } | { ok: false; error: string };

/**
 * `content/screens/order.json`을 검사한다(ADR-0065 8절). 빈 목록·모르는 id·중복은 실패다.
 * 중복을 막는 이유: "다 깸 = solvedScreens ⊇ order"(11-4절)는 같은 id를 한 번만 세서, 배포 순서에 중복이 있으면 일찍 참이 된다.
 */
export function parseOrder(
  raw: unknown,
  known: ReadonlySet<string>,
): OrderResult {
  if (!Array.isArray(raw) || raw.length === 0)
    return { ok: false, error: "order는 비어 있지 않은 id 배열이어야 한다" };
  const seen = new Set<string>();
  for (const [i, id] of raw.entries()) {
    if (typeof id !== "string" || !known.has(id))
      return {
        ok: false,
        error: `order[${i}]: 모르는 화면 id ${JSON.stringify(id)}`,
      };
    if (seen.has(id)) return { ok: false, error: `order[${i}]: 중복 id ${id}` };
    seen.add(id);
  }
  return { ok: true, order: [...seen] };
}

/**
 * `?playtest=1&order=a,b`(11-6절). playtest가 아니거나 `order`가 없으면 null(배포 순서를 쓴다).
 * `query`는 쿼리 값 읽기(브라우저에서는 `(k) => new URLSearchParams(location.search).get(k)`). core는 DOM을 모른다.
 * 같은 id 반복은 허용한다. 모르는 id가 하나라도 있으면 null: 반쯤 맞는 순서로 몰래 도는 것보다 배포 순서가 낫다.
 * 이 덮어쓰기를 쓰는 동안은 세이브를 읽지도 쓰지도 않는다(11-4절 Ben 덧붙임). 그 판단은 `usesSave`로 한다.
 */
export function playtestOrder(
  query: (key: string) => string | null,
  known: ReadonlySet<string>,
): string[] | null {
  if (query("playtest") !== "1") return null;
  const raw = query("order");
  if (raw === null) return null;
  const ids = raw.split(",").map((s) => s.trim());
  if (ids.length === 0 || ids.some((id) => !ID_RE.test(id) || !known.has(id)))
    return null;
  return ids;
}

/**
 * 이번 판의 플레이 순서(#766). null이면 화면 하나로 연다(연결 경로를 아예 타지 않는다).
 * 1. `?playtest=1&order=`가 맞으면 그 순서(`playtestOrder`)
 * 2. `?screen=`이 있으면 null: 그 화면 하나만 본다(재생·프레임 도구 `solve.ts --screen`·`frames.ts`가 쓴다. 값이 틀려 기본 화면으로 떨어져도 하나)
 * 3. 아니면 배포 순서 `content/screens/order.json`. 그 파일이 틀렸으면 null(테스트가 막지만, 판이 안 열리는 것보다 화면 하나가 낫다)
 */
export function startOrder(
  query: (key: string) => string | null,
  known: ReadonlySet<string>,
  deployed: OrderResult,
): string[] | null {
  const override = playtestOrder(query, known);
  if (override) return override;
  if (query("screen") !== null) return null;
  return deployed.ok ? deployed.order : null;
}

/** 순서를 덮어쓴 판에서는 세이브를 끈다(같은 id 반복으로 "다 깸"이 일찍 참이 되는 것 방지). */
export function usesSave(override: readonly string[] | null): boolean {
  return override === null;
}

/**
 * 다음 화면에 들어갈 때 지금 캐릭터(11-3절). 이전 캐릭터가 그 화면 `start.at`에 있으면 유지,
 * 없으면 `characterOrder` 순서로 `start.at`에 있는 첫 사람. 세이브에서 이어 할 때 `activeCharacter`에도 같은 함수를 쓴다.
 */
export function enterCharacter(
  prev: string | null,
  startAt: Readonly<Record<string, string>>,
  characterOrder: readonly string[],
): string {
  if (prev !== null && Object.hasOwn(startAt, prev)) return prev;
  const first = characterOrder.find((id) => Object.hasOwn(startAt, id));
  if (first === undefined) throw new Error("start.at에 아는 캐릭터가 없다");
  return first;
}

/**
 * 순서 없이(`ORDER` null) 화면 하나만 연 판의 클리어 카드 글 키(#597).
 * 배포 첫 화면(`DEFAULT_SCREEN`)은 지금 배포본 그대로 `ui.clear`다(진마씨 재플레이 대기 판, 글자 하나 안 바꾼다).
 * 그 밖의 화면(`?screen=<id>`)은 그 판이 거기서 끝나므로 `<id>.clear_card`가 있으면 그것, 없으면 끝 카드 `ui.end`.
 * `ui.clear`는 화면 1 문장이라(店のカギ… ステージ1) 다른 화면에 띄우면 틀린 글이 된다.
 */
export function soloCardKey(screenId: string, hasText: (key: string) => boolean): string {
  if (screenId === DEFAULT_SCREEN) return "ui.clear";
  const key = `${screenId}.clear_card`;
  return hasText(key) ? key : "ui.end";
}

/** 맵에서 다시 하는 판의 카드 다음 줄(#792 `title-and-map.md` 3-4절). 터치 키, 마우스는 `_click`을 붙인다(`ui.next`와 같은 나누기). */
export const MAP_RETURN_KEY = "ui.map.return";

/**
 * 클리어 카드 글 키(11-2절), 위에서부터 줄 순서. 결과 줄 키가 없으면 그 줄을 숨긴다(빈 화면 id 폴백).
 * 마지막 화면은 결과 줄 + 끝 카드(`ui.end`)다(#935 묶음 2 p1 4: 끝 카드만 띄우면 "왜 끝났는지"가 안 남았다).
 * `toMap`(맵에서 다시 하는 판, 3-4절): 결과 줄·끝 카드는 그대로, 다음 줄만 `ui.map.return`. 끝 카드에도 붙는다(탭하면 맵).
 */
export function cardLines(
  screenId: string,
  last: boolean,
  hasText: (key: string) => boolean,
  toMap = false,
): { body: string[]; next: string | null } {
  const key = `${screenId}.clear_card`;
  const result = hasText(key) ? [key] : [];
  const body = last ? [...result, "ui.end"] : result;
  if (toMap) return { body, next: MAP_RETURN_KEY };
  return { body, next: last ? null : "ui.next" };
}

/**
 * 화면 사이 흐름. `play`는 퍼즐을 하는 중(클리어 컷 글까지 포함, 그건 scene.ts가 맡는다).
 * 클리어 컷이 끝나면(`scene.cleared && !busy`) `showCard`로 카드를 띄운다.
 */
export type Flow =
  | { phase: "play" }
  | { phase: "card"; t: number; last: boolean; toMap?: true }
  | { phase: "fadeOut"; t: number; toMap?: true }
  | { phase: "wait"; t: number }
  | { phase: "fadeIn"; t: number }
  /** 게임 루프 밖에서 맵·타이틀이 캔버스를 쓰는 중(#792 3-4절). 호출자가 메뉴를 닫으면 `AFTER_MENU`로 바꾼다. */
  | { phase: "menu" };

export const PLAYING: Flow = { phase: "play" };

/** 메뉴에서 판을 고른 뒤: 다 검은 채로 그 판 그림을 기다렸다가 바꾸고 밝아진다(11-1절 기다림과 같다). */
export const AFTER_MENU: Flow = { phase: "wait", t: 0 };

/** `toMap`: 맵에서 다시 하는 판이라 카드 탭이 다음 판이 아니라 맵으로 간다(3-4절). 마지막 판(끝 카드)도 같다. */
export function showCard(last: boolean, toMap = false): Flow {
  return toMap ? { phase: "card", t: 0, last, toMap } : { phase: "card", t: 0, last };
}

/** 1틱 진행. `swap`이 참인 틱에 호출자는 다음 화면을 만든다(덮개가 완전히 검은 동안). */
export function flowTick(
  f: Flow,
  nextReady: boolean,
): { flow: Flow; swap: boolean } {
  switch (f.phase) {
    case "play":
      return { flow: f, swap: false };
    case "card":
      return {
        flow: { ...f, t: Math.min(f.t + 1, FLOW_TIMING.cardIgnore) },
        swap: false,
      };
    case "fadeOut":
      if (f.t + 1 < FLOW_TIMING.fadeOut)
        return { flow: { ...f, t: f.t + 1 }, swap: false };
      // 맵으로 가는 길은 다음 판을 안 기다린다. 다 검은 틱에 메뉴로 넘긴다.
      if (f.toMap) return { flow: { phase: "menu" }, swap: false };
      return enterWait(nextReady, 0);
    case "menu":
      return { flow: f, swap: false };
    case "wait":
      return enterWait(nextReady, f.t + 1);
    case "fadeIn":
      // 덮개 0인 칸은 `play`가 맡는다. 그래서 탭부터 play까지 정확히 fadeOut + fadeIn틱(0.6초)이고, 입력이 막힌 채 다 밝은 칸이 없다.
      if (f.t + 2 < FLOW_TIMING.fadeIn)
        return { flow: { phase: "fadeIn", t: f.t + 1 }, swap: false };
      return { flow: PLAYING, swap: false };
  }
}

function enterWait(
  nextReady: boolean,
  t: number,
): { flow: Flow; swap: boolean } {
  // 그림이 다 오면 바로 바꾸고 밝아진다. 임시 상자는 절대 보이지 않게 한다(11-1절): 준비 전에는 ink를 유지한다.
  if (nextReady) return { flow: { phase: "fadeIn", t: 0 }, swap: true };
  return {
    flow: { phase: "wait", t: Math.min(t, FLOW_TIMING.waitDots) },
    swap: false,
  };
}

export type TapResult = { flow: Flow; action: "none" | "next" | "title" | "map" };

/**
 * 카드 탭(클릭, Enter·Space 포함). 처음 0.6초는 무시한다(11-1절). 클리어 카드는 어두워짐을 시작하고,
 * 끝 카드는 타이틀이 있을 때만 `title`(11-5절: 타이틀이 없으면 끝 카드에 머문다).
 * 맵에서 다시 하는 판(`toMap`)은 클리어 카드·끝 카드 둘 다 어두워진 뒤 `menu`(3-4절).
 */
export function flowTap(f: Flow, hasTitle: boolean): TapResult {
  if (f.phase !== "card" || f.t < FLOW_TIMING.cardIgnore)
    return { flow: f, action: "none" };
  if (f.toMap) return { flow: { phase: "fadeOut", t: 0, toMap: true }, action: "map" };
  if (f.last)
    return hasTitle
      ? { flow: PLAYING, action: "title" }
      : { flow: f, action: "none" };
  return { flow: { phase: "fadeOut", t: 0 }, action: "next" };
}

/** 그릴 것. `cover`는 ink(0번, `#1b1720`) 덮개의 불투명도 0~1. */
export interface FlowView {
  cover: number;
  card: boolean;
  next: boolean;
  dots: boolean;
  /** 퍼즐 입력(캐릭터·대상·HUD)을 받는지. */
  input: boolean;
}

export function flowView(f: Flow, hasTitle: boolean): FlowView {
  switch (f.phase) {
    case "play":
      return { cover: 0, card: false, next: false, dots: false, input: true };
    case "card":
      return {
        cover: 0,
        card: true,
        next: f.t >= FLOW_TIMING.cardIgnore && (!f.last || hasTitle || f.toMap === true),
        dots: false,
        input: false,
      };
    case "fadeOut":
      return {
        cover: (f.t + 1) / FLOW_TIMING.fadeOut,
        card: false,
        next: false,
        dots: false,
        input: false,
      };
    case "wait":
      return {
        cover: 1,
        card: false,
        next: false,
        dots: f.t >= FLOW_TIMING.waitDots,
        input: false,
      };
    case "fadeIn":
      return {
        cover: 1 - (f.t + 1) / FLOW_TIMING.fadeIn,
        card: false,
        next: false,
        dots: false,
        input: false,
      };
    case "menu":
      return { cover: 1, card: false, next: false, dots: false, input: false };
  }
}

/** 순서 안 위치 `index`의 다음 위치. 마지막이면 null. 같은 id가 반복돼도 위치로 센다. */
export function nextIndex(
  order: readonly string[],
  index: number,
): number | null {
  return index + 1 < order.length ? index + 1 : null;
}
