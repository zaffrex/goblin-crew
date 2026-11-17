import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// #280: docs/design/ja-text.md 2절 "줄 길이 규칙" 중 validate.ts(textFits, 14자×2줄)가 보지 않는 것을 검사한다.
// 이 테스트가 "예외 2에 해당하는 줄" 목록의 원본이다. 규칙을 바꾸면 ja-text.md 2절도 같이 고친다.

const texts = JSON.parse(
  readFileSync(new URL("../../content/text/ja.json", import.meta.url), "utf8"),
) as Record<string, string>;

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

  it("게이지 이름표는 8자 이하, 클리어 카드는 줄당 12자 이하", () => {
    expect(len(texts["ui.hud.gauge"]!)).toBeLessThanOrEqual(8);
    for (const line of texts["ui.clear"]!.split("\n"))
      expect(len(line), line).toBeLessThanOrEqual(12);
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
