// QA 동작 목록 파싱 (#603). `--actions` 파일 또는 `--steps` 문자열을 같은 규칙으로 읽는다.
// QA 실행에서 Write 도구 권한이 안 맞아 actions 파일을 못 만들 때도 `--steps`로 플레이할 수 있게 한다.
// 구분자: 줄바꿈 또는 `;`. `#`로 시작하는 항목은 메모.
export type Step = { cmd: 'click'; x: number; y: number } | { cmd: 'wait'; ms: number };

export function parseSteps(text: string): Step[] {
  return text
    .split(/[\n;]/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => {
      const [cmd, a, b, extra] = l.split(/\s+/);
      if (cmd === 'click' && b !== undefined && extra === undefined) {
        const x = Number(a);
        const y = Number(b);
        if (Number.isFinite(x) && Number.isFinite(y)) return { cmd, x, y };
      }
      if (cmd === 'wait' && a !== undefined && b === undefined) {
        const ms = Number(a);
        if (Number.isFinite(ms) && ms >= 0) return { cmd, ms: Math.min(ms, 5000) };
      }
      throw new Error(`모르는 동작: ${l}`);
    });
}
