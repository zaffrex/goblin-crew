import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// #802 PR #838 리뷰 제안: 대상만 다르고 반응은 글자 그대로 같아야 하는 규칙 짝.
// 한쪽만 고치면 같은 행동(예: 재킷 밑 흙길 쿵 / 비둘기 쿵)이 다른 반응을 내므로 여기서 막는다.
// 짝을 일부러 갈라야 하면 이 목록에서 빼고 PR에 이유를 적는다.

type Rule = {
  id: string;
  target: string;
  verb: string;
  when?: unknown;
  do?: unknown;
  show?: unknown;
};

/** [화면, 원본 규칙 id, 거울 규칙 id] */
const MIRRORS: [screen: string, source: string, mirror: string][] = [
  ["park_fountain", "jacket_ground_stomp", "pigeons_stomp_wet"],
  ["park_fountain", "pigeons_perch", "pigeons_stomp_perch"],
];

const rulesOf = (screen: string): Rule[] =>
  (
    JSON.parse(
      readFileSync(
        new URL(`../../content/screens/${screen}.json`, import.meta.url),
        "utf8",
      ),
    ) as { rules: Rule[] }
  ).rules;

/** 대상·id·메모를 뺀, 플레이어가 보는 반응 전부. */
const behaviour = (r: Rule) => ({
  verb: r.verb,
  when: r.when ?? null,
  do: r.do ?? null,
  show: r.show ?? null,
});

describe("rule mirrors: same reaction, different target", () => {
  for (const [screen, source, mirror] of MIRRORS) {
    it(`${screen}: ${mirror} mirrors ${source}`, () => {
      const rules = rulesOf(screen);
      const a = rules.find((r) => r.id === source);
      const b = rules.find((r) => r.id === mirror);
      expect(a, `${source} missing`).toBeDefined();
      expect(b, `${mirror} missing`).toBeDefined();
      expect(b!.target).not.toBe(a!.target);
      expect(behaviour(b!)).toEqual(behaviour(a!));
    });
  }
});
