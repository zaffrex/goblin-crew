import { describe, expect, it } from "vitest";
import {
  FLOW_TIMING,
  PLAYING,
  AFTER_MENU,
  cardLines,
  soloCardKey,
  enterCharacter,
  flowTap,
  flowTick,
  flowView,
  nextIndex,
  parseOrder,
  playtestOrder,
  showCard,
  startOrder,
  usesSave,
  type Flow,
} from "./flow";

const known = new Set(["laundromat", "magpie_nest", "park_fountain"]);
const CHARS = ["jjuk", "mukjik", "ppik"];
// core 타입 설정에는 DOM이 없어서 테스트도 작은 쿼리 파서를 쓴다.
const q = (search: string) => (k: string) => {
  for (const pair of search.replace(/^\?/, "").split("&")) {
    const [key, value = ""] = pair.split("=");
    if (key === k) return decodeURIComponent(value);
  }
  return null;
};

function run(
  f: Flow,
  ticks: number,
  ready = true,
): { flow: Flow; swaps: number } {
  let swaps = 0;
  for (let i = 0; i < ticks; i++) {
    const r = flowTick(f, ready);
    f = r.flow;
    if (r.swap) swaps++;
  }
  return { flow: f, swaps };
}

describe("parseOrder", () => {
  it("아는 id 목록이면 통과", () => {
    expect(parseOrder(["laundromat", "magpie_nest"], known)).toEqual({
      ok: true,
      order: ["laundromat", "magpie_nest"],
    });
  });
  it("빈 목록, 배열 아님, 모르는 id, 중복은 실패", () => {
    expect(parseOrder([], known).ok).toBe(false);
    expect(parseOrder({ 0: "laundromat" }, known).ok).toBe(false);
    expect(parseOrder(["laundromat", "rooftop_gap"], known)).toEqual({
      ok: false,
      error: 'order[1]: 모르는 화면 id "rooftop_gap"',
    });
    expect(parseOrder(["magpie_nest", "magpie_nest"], known)).toEqual({
      ok: false,
      error: "order[1]: 중복 id magpie_nest",
    });
    expect(parseOrder([3], known).ok).toBe(false);
  });
});

describe("playtestOrder / usesSave", () => {
  it("playtest=1 + order면 같은 id 반복도 허용", () => {
    expect(
      playtestOrder(q("?playtest=1&order=magpie_nest,magpie_nest"), known),
    ).toEqual(["magpie_nest", "magpie_nest"]);
  });
  it("playtest가 아니거나 order가 없거나 모르는 id가 있으면 null(배포 순서)", () => {
    expect(playtestOrder(q("?order=magpie_nest"), known)).toBeNull();
    expect(playtestOrder(q("?playtest=1"), known)).toBeNull();
    expect(
      playtestOrder(q("?playtest=1&order=magpie_nest,nope"), known),
    ).toBeNull();
    expect(playtestOrder(q("?playtest=1&order="), known)).toBeNull();
    expect(playtestOrder(q("?playtest=1&order=__proto__"), known)).toBeNull();
  });
  it("순서를 덮어쓴 판은 세이브를 끈다(11-4절)", () => {
    expect(usesSave(null)).toBe(true);
    expect(usesSave(["magpie_nest", "magpie_nest"])).toBe(false);
  });
});

describe("startOrder (#766 쿼리 없는 배포본도 이어 간다)", () => {
  const deployed = parseOrder(["magpie_nest", "park_fountain", "laundromat"], known);
  it("쿼리가 없으면 배포 order.json 순서", () => {
    expect(startOrder(q(""), known, deployed)).toEqual([
      "magpie_nest",
      "park_fountain",
      "laundromat",
    ]);
  });
  it("playtest=1만 있어도 배포 순서(M1 replay.ts는 ?playtest=1로 연다)", () => {
    expect(startOrder(q("?playtest=1"), known, deployed)).toEqual([
      "magpie_nest",
      "park_fountain",
      "laundromat",
    ]);
  });
  it("playtest order 덮어쓰기가 배포 순서보다 먼저", () => {
    expect(
      startOrder(q("?playtest=1&order=magpie_nest,magpie_nest"), known, deployed),
    ).toEqual(["magpie_nest", "magpie_nest"]);
  });
  it("?screen=이 있으면 화면 하나(도구용). 모르는 id여도 하나", () => {
    expect(startOrder(q("?screen=park_fountain"), known, deployed)).toBeNull();
    expect(startOrder(q("?screen=magpie_nest&playtest=1"), known, deployed)).toBeNull();
    expect(startOrder(q("?screen=nope"), known, deployed)).toBeNull();
  });
  it("order가 맞으면 ?screen=보다 order", () => {
    expect(
      startOrder(q("?playtest=1&order=park_fountain&screen=magpie_nest"), known, deployed),
    ).toEqual(["park_fountain"]);
  });
  it("배포 order.json이 틀렸으면 화면 하나로 연다", () => {
    expect(startOrder(q(""), known, parseOrder([], known))).toBeNull();
  });
});

describe("enterCharacter (11-3절)", () => {
  const all = { jjuk: "floor", mukjik: "floor", ppik: "floor" };
  it("이전 캐릭터가 start.at에 있으면 유지", () => {
    expect(enterCharacter("ppik", all, CHARS)).toBe("ppik");
  });
  it("없으면 characters 순서상 start.at의 첫 사람", () => {
    expect(enterCharacter("jjuk", { ppik: "a", mukjik: "b" }, CHARS)).toBe(
      "mukjik",
    );
    expect(enterCharacter(null, all, CHARS)).toBe("jjuk");
  });
  it('세이브의 이상한 이름도 안전하게 대체(프로토타입 키를 "있다"로 보지 않음)', () => {
    expect(enterCharacter("toString", all, CHARS)).toBe("jjuk");
  });
  it("아는 캐릭터가 아무도 없으면 오류(validate가 막아야 할 데이터)", () => {
    expect(() => enterCharacter("jjuk", {}, CHARS)).toThrow();
  });
});

describe("cardLines (11-2절)", () => {
  const has = (k: string) => k === "magpie_nest.clear_card";
  it("결과 줄 + ui.next", () => {
    expect(cardLines("magpie_nest", false, has)).toEqual({
      body: "magpie_nest.clear_card",
      next: "ui.next",
    });
  });
  it("결과 줄 키가 없으면 숨기고 ui.next만", () => {
    expect(cardLines("laundromat", false, has)).toEqual({
      body: null,
      next: "ui.next",
    });
  });
  it("마지막 화면은 끝 카드, clear_card를 요구하지 않는다", () => {
    expect(cardLines("park_fountain", true, has)).toEqual({
      body: "ui.end",
      next: null,
    });
  });
});

describe("soloCardKey (#597, 순서 없이 화면 하나)", () => {
  const has = (k: string) => k === "magpie_nest.clear_card" || k === "laundromat.clear_card";
  it("배포 첫 화면은 지금 배포본 그대로 ui.clear", () => {
    expect(soloCardKey("magpie_nest", has)).toBe("ui.clear");
  });
  it("결과 줄이 없는 화면(park_fountain, 1장 마지막)은 끝 카드 ui.end", () => {
    expect(soloCardKey("park_fountain", has)).toBe("ui.end");
  });
  it("결과 줄이 있는 화면은 그 줄(다음 화면이 없으니 ui.next는 안 붙는다)", () => {
    expect(soloCardKey("laundromat", has)).toBe("laundromat.clear_card");
  });
});

describe("클리어 카드 → 어두워짐 → 바꾸기 → 밝아짐", () => {
  it("처음 0.6초(36틱)는 탭 무시, ui.next도 그때 보인다", () => {
    let f = showCard(false);
    expect(flowView(f, false)).toMatchObject({
      card: true,
      next: false,
      input: false,
      cover: 0,
    });
    f = run(f, FLOW_TIMING.cardIgnore - 1).flow;
    expect(flowTap(f, false).action).toBe("none");
    expect(flowView(f, false).next).toBe(false);
    f = run(f, 1).flow;
    expect(flowView(f, false).next).toBe(true);
    expect(flowTap(f, false).action).toBe("next");
  });

  it("카드는 자동으로 넘어가지 않는다", () => {
    const f = run(showCard(false), 60 * 60).flow;
    expect(f.phase).toBe("card");
  });

  it("그림이 준비돼 있으면 탭 뒤 36틱(0.6초) 만에 play, 바꾸기는 정확히 1번이고 덮개가 다 덮인 다음 틱", () => {
    let f = flowTap(
      run(showCard(false), FLOW_TIMING.cardIgnore).flow,
      false,
    ).flow;
    expect(f.phase).toBe("fadeOut");
    const covers: number[] = [flowView(f, false).cover];
    let swapAt = -1;
    for (let i = 1; f.phase !== "play"; i++) {
      const r = flowTick(f, true);
      if (r.swap) {
        expect(swapAt).toBe(-1);
        expect(covers.at(-1)).toBe(1);
        swapAt = i;
      }
      f = r.flow;
      covers.push(flowView(f, false).cover);
    }
    expect(swapAt).toBe(FLOW_TIMING.fadeOut);
    expect(covers.length).toBe(FLOW_TIMING.fadeOut + FLOW_TIMING.fadeIn);
    expect(covers.at(-1)).toBe(0);
    // 어두워짐은 올라가기만, 밝아짐은 내려가기만 한다.
    for (let i = 1; i < covers.length; i++) {
      if (i < swapAt) expect(covers[i]).toBeGreaterThan(covers[i - 1]!);
      else expect(covers[i]).toBeLessThan(covers[i - 1]!);
    }
  });

  it("전환 중에는 탭을 받지 않고 퍼즐 입력도 막는다", () => {
    let f: Flow = { phase: "fadeOut", t: 3 };
    expect(flowTap(f, true)).toEqual({ flow: f, action: "none" });
    expect(flowView(f, true).input).toBe(false);
    f = { phase: "fadeIn", t: 3 };
    expect(flowTap(f, true).action).toBe("none");
    expect(flowView(PLAYING, true).input).toBe(true);
  });

  it("그림이 늦으면 ink 유지, 0.5초 뒤 …, 준비되면 그때 바꾼다", () => {
    let f: Flow = { phase: "fadeOut", t: 0 };
    f = run(f, FLOW_TIMING.fadeOut, false).flow;
    expect(f.phase).toBe("wait");
    expect(flowView(f, false)).toMatchObject({ cover: 1, dots: false });
    const waited = run(f, FLOW_TIMING.waitDots + 100, false);
    expect(waited.swaps).toBe(0);
    expect(flowView(waited.flow, false)).toMatchObject({
      cover: 1,
      dots: true,
    });
    const r = flowTick(waited.flow, true);
    expect(r.swap).toBe(true);
    expect(r.flow.phase).toBe("fadeIn");
  });
});

describe("끝 카드 (11-5절)", () => {
  it("타이틀이 없으면 머물고 ui.next를 숨긴다", () => {
    const f = run(showCard(true), 100).flow;
    expect(flowView(f, false)).toMatchObject({ card: true, next: false });
    expect(flowTap(f, false)).toEqual({ flow: f, action: "none" });
  });
  it("타이틀이 있으면 0.6초 뒤 탭으로 타이틀", () => {
    expect(
      flowTap(run(showCard(true), FLOW_TIMING.cardIgnore - 1).flow, true)
        .action,
    ).toBe("none");
    const f = run(showCard(true), FLOW_TIMING.cardIgnore).flow;
    expect(flowView(f, true).next).toBe(true);
    expect(flowTap(f, true).action).toBe("title");
  });
});

describe("맵에서 다시 하는 판 (#792 title-and-map 3-4절)", () => {
  const has = (k: string) => k === "magpie_nest.clear_card";
  it("카드 결과 줄은 그대로, 다음 줄만 ui.map.return", () => {
    expect(cardLines("magpie_nest", false, has, true)).toEqual({ body: "magpie_nest.clear_card", next: "ui.map.return" });
    expect(cardLines("laundromat", false, has, true)).toEqual({ body: null, next: "ui.map.return" });
  });
  it("마지막 판은 끝 카드 그대로 + ui.map.return(타이틀이 없어도 머물지 않는다)", () => {
    expect(cardLines("park_fountain", true, has, true)).toEqual({ body: "ui.end", next: "ui.map.return" });
    const f = run(showCard(true, true), FLOW_TIMING.cardIgnore).flow;
    expect(flowView(f, false).next).toBe(true);
    expect(flowTap(f, false).action).toBe("map");
  });
  it("0.6초 무시는 같다", () => {
    const f = run(showCard(false, true), FLOW_TIMING.cardIgnore - 1).flow;
    expect(flowView(f, false).next).toBe(false);
    expect(flowTap(f, false).action).toBe("none");
  });
  it("탭 → 0.3초 어두워짐 → 다 검은 틱에 menu, 바꾸기 없음·다음 판 안 기다림", () => {
    let f = flowTap(run(showCard(false, true), FLOW_TIMING.cardIgnore).flow, false).flow;
    expect(f).toEqual({ phase: "fadeOut", t: 0, toMap: true });
    let ticks = 0;
    while (f.phase === "fadeOut") {
      const r = flowTick(f, false);
      expect(r.swap).toBe(false);
      f = r.flow;
      ticks++;
    }
    expect(ticks).toBe(FLOW_TIMING.fadeOut);
    expect(f.phase).toBe("menu");
    expect(flowView(f, false)).toMatchObject({ cover: 1, input: false, card: false });
    // 메뉴가 떠 있는 동안은 그대로(호출자가 AFTER_MENU로 바꾼다)
    expect(run(f, 600).flow).toEqual({ phase: "menu" });
    expect(flowTap(f, true).action).toBe("none");
  });
  it("메뉴에서 고른 판: 다 검은 채 그림을 기다렸다가 바꾸고 밝아진다", () => {
    expect(flowView(AFTER_MENU, false).cover).toBe(1);
    const late = run(AFTER_MENU, 10, false);
    expect(late.swaps).toBe(0);
    const r = flowTick(late.flow, true);
    expect(r.swap).toBe(true);
    expect(r.flow.phase).toBe("fadeIn");
  });
  it("다시 하는 판이 아니면 예전과 같다(카드 모양에 toMap 없음)", () => {
    expect(showCard(false)).toEqual({ phase: "card", t: 0, last: false });
    expect(cardLines("magpie_nest", false, has)).toEqual({ body: "magpie_nest.clear_card", next: "ui.next" });
  });
});

describe("nextIndex", () => {
  it("같은 id가 반복돼도 위치로 센다", () => {
    const order = ["magpie_nest", "magpie_nest"];
    expect(nextIndex(order, 0)).toBe(1);
    expect(nextIndex(order, 1)).toBeNull();
  });
});
