import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CHARACTERS } from "../../src/core/characters";
import { selectLabelText } from "../../src/core/firstNotes";
import { firstSwitchText, hudHoverText, switchText } from "../../src/core/hud";
import { labelText, type Label, type LabelVerb } from "../../src/core/interact";

// #280: docs/design/ja-text.md 2절 "줄 길이 규칙" 중 validate.ts(textFits, 14자×2줄)가 보지 않는 것을 검사한다.
// 이 테스트가 "예외 2에 해당하는 줄" 목록의 원본이다. 규칙을 바꾸면 ja-text.md 2절도 같이 고친다.

const raw = readFileSync(
  new URL("../../content/text/ja.json", import.meta.url),
  "utf8",
);
const texts = JSON.parse(raw) as Record<string, string>;

/** 눈에 안 보이는 글자. 글 파일에는 `\u200b`처럼 이스케이프로만 쓴다 (#367 뒤 `ui.intro` 사고). */
const INVISIBLE = /[\u00ad\u200b-\u200f\u2028\u2029\u2060\ufeff]/u;

/** 줄 머리 금칙 글자 (ja-text.md 2절): 、。！？…ー・〜 + 작은 가나 + 닫는 괄호. */
const NO_LINE_HEAD = new Set([
  ..."、。！？…ー・〜",
  ..."ぁぃぅぇぉっゃゅょゎゕゖ",
  ..."ァィゥェォッャュョヮヵヶ",
  ..."」』）】〕〉》］｝",
]);
/** 예외 2: 앞 줄이 이 글자로 끝나면 줄 머리 `…`를 허용한다 ("한 박자 쉬고 반전"). */
const TWIST_END = new Set([..."！？。"]);

const len = (s: string): number => [...s].length;

/** 둘째 줄 이후 줄 머리 금칙 위반을 찾는다. 첫 줄 머리 `…`(예외 1)는 보지 않는다. */
function kinsokuViolations(text: string): string[] {
  const lines = text.split("\n");
  const bad: string[] = [];
  for (let i = 1; i < lines.length; i++) {
    const head = [...lines[i]!][0];
    if (head === undefined || !NO_LINE_HEAD.has(head)) continue;
    const prevEnd = [...lines[i - 1]!].at(-1);
    if (head === "…" && prevEnd !== undefined && TWIST_END.has(prevEnd))
      continue;
    bad.push(`line ${i + 1}: ${JSON.stringify(lines[i])}`);
  }
  return bad;
}

describe("ja.json 원문 (#367)", () => {
  it("눈에 안 보이는 글자가 날 글자로 들어 있지 않다 (이스케이프로만 쓴다)", () => {
    const hits = raw
      .split("\n")
      .flatMap((line, i) => (INVISIBLE.test(line) ? [`line ${i + 1}`] : []));
    expect(hits).toEqual([]);
  });

  it("줄바꿈 자리 U+200B는 파싱 뒤에는 그대로 남아 있다", () => {
    expect(texts["ui.intro"]).toContain("\u200b");
  });
});

describe("ja.json 줄 규칙 (ja-text.md 2절, #280)", () => {
  it("둘째 줄 이후가 금칙 글자로 시작하지 않는다 (예외 2 제외)", () => {
    const hits = Object.entries(texts).flatMap(([k, v]) =>
      kinsokuViolations(v).map((x) => `${k} ${x}`),
    );
    expect(hits).toEqual([]);
  });

  it("HUD 동사 이름표는 3자 이하 (버튼 폭 약 46px)", () => {
    const keys = ["stretch", "stomp", "squeak", "hand", "look"].map(
      (v) => `ui.verb.${v}`,
    );
    for (const k of keys) {
      expect(texts[k], k).toBeDefined();
      expect(len(texts[k]!), `${k} ${texts[k]}`).toBeLessThanOrEqual(3);
    }
  });

  it("HUD 얼굴 이름표(캐릭터 이름)는 4자 이하 (칸 간격 37, #676)", () => {
    const keys = ["jjuk", "mukjik", "ppik"].map((id) => `char.${id}.name`);
    for (const k of keys) {
      expect(texts[k], k).toBeDefined();
      expect(len(texts[k]!), `${k} ${texts[k]}`).toBeLessThanOrEqual(4);
    }
  });

  it("게이지 이름표는 8자 이하, 클리어 카드는 줄당 12자 이하", () => {
    expect(len(texts["ui.hud.gauge"]!)).toBeLessThanOrEqual(8);
    // 화면별 결과 줄(`<id>.clear_card`)과 끝 카드(`ui.end`)도 같은 카드 글자(#802).
    const cardKeys = ["ui.clear", "ui.end", ...Object.keys(texts).filter((k) => k.endsWith(".clear_card"))];
    expect(cardKeys.length).toBeGreaterThanOrEqual(5);
    for (const k of cardKeys)
      for (const line of texts[k]!.split("\n"))
        expect(len(line), `${k} ${line}`).toBeLessThanOrEqual(12);
  });

  it("타이틀·맵 글은 예산 안 (title-and-map.md 4절, #792)", () => {
    const budget: Record<string, number> = {
      "ui.title.continue": 6,
      "ui.title.new": 6,
      "ui.title.map": 6,
      "ui.title.new_confirm": 20,
      "ui.map.back": 4,
      "ui.map.locked": 20,
      "ui.map.return": 12,
      "ui.map.return_click": 12,
    };
    for (const [k, max] of Object.entries(budget)) {
      expect(texts[k], k).toBeTruthy();
      expect(len(texts[k]!), `${k} ${texts[k]}`).toBeLessThanOrEqual(max);
    }
    const order = JSON.parse(
      readFileSync(new URL("../../content/screens/order.json", import.meta.url), "utf8"),
    ) as string[];
    for (const id of order) {
      const name = texts[`${id}.map.name`];
      expect(name, `${id}.map.name`).toBeTruthy();
      expect(len(name!), `${id}.map.name ${name}`).toBeLessThanOrEqual(8);
    }
  });

  it("타이틀 버튼 셋은 첫 글자가 다르고, 게임 안 처음부터 버튼과 같은 말이 아니다 (#792)", () => {
    const buttons = ["ui.title.continue", "ui.title.new", "ui.title.map"].map((k) => texts[k]!);
    expect(new Set(buttons.map((b) => [...b][0])).size).toBe(3);
    expect(texts["ui.title.new"]).not.toBe(texts["ui.restart"]);
    // 게임 안 버튼의 호버·확인 글은 "이 화면만"이라는 걸 말한다 (ui-interaction 6-7-4).
    for (const k of ["ui.restart_hover", "ui.restart_confirm"])
      expect(texts[k], k).toContain("このステージ");
  });

  it("검사기 자체: 예외 1·2는 넘기고 문장 중간 줄 머리 금칙은 잡는다", () => {
    expect(kinsokuViolations("…痛い。")).toEqual([]); // 예외 1
    expect(kinsokuViolations("やった！\n…あれ？")).toEqual([]); // 예외 2
    expect(kinsokuViolations("お、ハイタッチ？\n…じゃないか")).toEqual([]);
    expect(kinsokuViolations("これは\n…ちがう")).toHaveLength(1); // 문장 중간
    expect(kinsokuViolations("やった！\n。あれ")).toHaveLength(1); // … 외 금칙은 예외 없음
    expect(kinsokuViolations("ちょ\nっと")).toHaveLength(1);
    expect(kinsokuViolations("うわ\nぁぁ！")).toHaveLength(1); // 비명의 작은 가나
    expect(kinsokuViolations("あ\n〜あ")).toHaveLength(1);
    expect(kinsokuViolations("動かす\n・拾う")).toHaveLength(1);
    expect(kinsokuViolations("「えっ\n」")).toHaveLength(1);
  });
});

// #707: 대상 라벨 자리(`#label`)에 뜨는 글을 ja.json 패턴·이름으로 실제로 채워서 폭을 잰다.
// 셈 기준(ja-text.md 2절, PR #705 실측과 같음): 14px × 글자 수 + 좌우 여백 0.6em×2(16.8px) ≤ 게임 폭 480px.
// `#label` 글자 크기는 내부 7px × 배율(최소 14), 게임 폭은 내부 240 × 배율이라 비율이 같다. 1.0배만 보면 된다.
// 반각 글자도 14px로 세서 실제보다 넓게 잡는다(안전 쪽). 10자·5자 이름 상한은 작가용 안내로 ja-text.md에만 둔다.

const LABEL_FONT_PX = 14;
const LABEL_PAD_PX = 16.8;
const GAME_W_PX = 480;

const labelPx = (s: string): number =>
  LABEL_FONT_PX * len(s) + LABEL_PAD_PX;

type PickScreen = { rules: { target: string; do?: { pick?: boolean } }[]; hotspots: Record<string, { variants?: { name?: string }[] }> };

/** 한 화면의 `pick` 대상 ID + 그 대상의 상태별 이름 ID(`variants[].name`). */
function pickNames(screen: PickScreen): string[] {
  return [...new Set(screen.rules.filter((r) => r.do?.pick === true).map((r) => r.target))].flatMap((target) => [
    target,
    ...(screen.hotspots[target]?.variants ?? []).flatMap((v) => (v.name === undefined ? [] : [v.name])),
  ]);
}

/**
 * 화면마다 쭉이가 들 수 있는 물건의 이름 ID(`pick` 규칙 대상, ADR-1031). 화면 JSON이 없으면 빈 목록.
 * 상태별 이름(`variants[].name`, #1031 `ぬれたタオル`)도 든 채로 라벨에 뜨니 같이 넣는다.
 */
function screenPicks(): Map<string, string[]> {
  const out = new Map<string, string[]>();
  const order = JSON.parse(
    readFileSync(new URL("../../content/screens/order.json", import.meta.url), "utf8"),
  ) as string[];
  for (const id of order) {
    const screen = JSON.parse(
      readFileSync(new URL(`../../content/screens/${id}.json`, import.meta.url), "utf8"),
    ) as PickScreen;
    out.set(id, pickNames(screen));
  }
  return out;
}
const PICKS = screenPicks();

/**
 * 대상 라벨 자리에 뜰 수 있는 모든 글(넉넉한 합집합: 모든 동사 × 같은 화면의 모든 대상).
 * 든 물건(#1060): 물건 이름이 아이템 키(5자)가 아니라 화면 이름 키라서 `{target}に{item}を使う`가 더 길어진다.
 * 그래서 `pick` 대상 × 같은 화면의 모든 대상, 그리고 `{item}をおろす`를 같이 채운다.
 */
function labelLines(tx: Record<string, string>, picks: Map<string, string[]> = PICKS): string[] {
  const t = (id: string): string => tx[id] ?? id;
  const keys = Object.keys(tx);
  const tail = t("ui.touch.tap_again");
  const out: string[] = [];
  const both = (s: string): void => {
    out.push(s, selectLabelText(s, tail));
  };

  const screens = new Map<string, string[]>();
  for (const k of keys) {
    const m = /^([a-z0-9_]+)\.name\.([a-z0-9_]+)$/.exec(k);
    if (m) screens.set(m[1]!, [...(screens.get(m[1]!) ?? []), m[2]!]);
  }
  const verbs = keys.flatMap((k) => {
    const m = /^ui\.label\.([a-z0-9_]+)$/.exec(k);
    return m && m[1] !== "item" ? [m[1] as LabelVerb] : [];
  });
  const items = keys.flatMap((k) => {
    const m = /^(item\.[a-z0-9_]+)\.name$/.exec(k);
    return m ? [m[1]!] : [];
  });
  const chars = CHARACTERS.map((c) => c.id);

  for (const [screen, ids] of screens) {
    const lt = (l: Label): string => labelText(l, screen, t);
    for (const target of [...ids, ...chars]) {
      both(lt({ verb: null, target }));
      for (const verb of verbs) both(lt({ verb, target }));
      for (const item of items) both(lt({ verb: "item", target, item }));
    }
    for (const held of picks.get(screen) ?? []) {
      both(lt({ verb: "put", target: null, item: held, held: true }));
      for (const target of ids)
        if (target !== held) both(lt({ verb: "item", target, item: held, held: true }));
    }
    for (const verb of ["walk", "release"] as const)
      both(lt({ verb, target: null }));
  }
  // 전환 알림·데스크톱 호버도 같은 자리에 뜬다(#692, 설계 6-4-3절). 터치 꼬리는 안 붙는다.
  for (const c of chars) {
    out.push(switchText(c, t), firstSwitchText(c, t), hudHoverText(`char.${c}`, t));
  }
  out.push(hudHoverText("gauge", t));
  // 처음부터 버튼 호버·확인 글과 첫 게이지 감소 안내도 같은 자리에 뜬다(`main.ts` labelString, PR #720 Luna 리뷰).
  // 셋 다 대상 라벨보다 먼저 보이고 터치 꼬리는 안 붙는다.
  out.push(t("ui.restart_hover"), t("ui.restart_confirm"), t("ui.hud.gauge_first_drop"));
  return out;
}

function overWidth(tx: Record<string, string>, picks?: Map<string, string[]>): string[] {
  return labelLines(tx, picks)
    .filter((s) => labelPx(s) > GAME_W_PX)
    .map((s) => `${labelPx(s).toFixed(1)}px ${s}`);
}

describe("대상 라벨 폭 (셈 기준, #703 #707)", () => {
  it("ja.json 패턴·이름·터치 꼬리를 채운 모든 라벨이 1.0배 게임 폭 480px 안 한 줄", () => {
    const lines = labelLines(texts);
    expect(lines.length).toBeGreaterThan(100);
    // 채우지 못한 자리표시자가 남으면 셈이 틀린다.
    expect(lines.filter((s) => /\{\w+\}/.test(s))).toEqual([]);
    expect(overWidth(texts)).toEqual([]);
  });

  it("셈이 PR #694 실측과 맞다", () => {
    // 가장 긴 첫 전환 줄 23자 → 338.8 (PR #694 헤드리스 Chrome 실측 338px)
    expect(labelPx("ピピに交代（ニワトリを鳴らして相手の気を引く）")).toBeCloseTo(338.8);
  });

  it("검사기 자체: 패턴·꼬리·숫자 들어간 이름이 길어지면 잡는다", () => {
    const longPattern = { ...texts, "ui.label.look": "{target}をじっくりと時間をかけて隅々までみる" };
    expect(overWidth(longPattern).length).toBeGreaterThan(0);
    const longTail = { ...texts, "ui.touch.tap_again": "{label}（もう一度同じ所をタップすると決定します）" };
    expect(overWidth(longTail).length).toBeGreaterThan(0);
    const digitId = { ...texts, "screen_3.name.pole_2": "とてもとても長い物干し竿の先っぽ" };
    expect(overWidth(digitId).length).toBeGreaterThan(0);
    const longItem = { ...texts, "item.key_2.name": "錆びついた古い真鍮のカギ" };
    expect(overWidth(longItem).length).toBeGreaterThan(0);
    // 든 물건: 10자 대상 + 10자 든 물건 = 506.8px. 따로는 둘 다 다른 라벨 안에 들어가서 든 물건 줄만 잡는다.
    const heldPair = { ...texts, "screen_3.name.towel": "長い濡れたバスタオル", "screen_3.name.door": "とても大きな店の入口" };
    expect(overWidth(heldPair)).toEqual([]);
    expect(overWidth(heldPair, new Map([["screen_3", ["towel"]]])).length).toBeGreaterThan(0);
    // 상태별 이름(#1031): 들 물건의 `variants[].name`도 든 물건 이름으로 잰다.
    const shop: PickScreen = {
      rules: [{ target: "towel", do: { pick: true } }, { target: "door", do: {} }],
      hotspots: { towel: { variants: [{ name: "towel_wet" }, {}] }, door: { variants: [{ name: "door_open" }] } },
    };
    expect(pickNames(shop)).toEqual(["towel", "towel_wet"]);
    const wetPair = { ...texts, "screen_3.name.towel": "タオル", "screen_3.name.towel_wet": "長い濡れたバスタオル", "screen_3.name.door": "とても大きな店の入口" };
    expect(overWidth(wetPair, new Map([["screen_3", ["towel"]]]))).toEqual([]);
    expect(overWidth(wetPair, new Map([["screen_3", pickNames(shop)]])).length).toBeGreaterThan(0);
    for (const id of ["ui.restart_hover", "ui.restart_confirm", "ui.hud.gauge_first_drop"]) {
      const longNote = { ...texts, [id]: "ゲージが1マス減った！ゼロになると全員まとめてスタート地点に戻される" };
      expect(overWidth(longNote), id).toHaveLength(1);
    }
  });
});
