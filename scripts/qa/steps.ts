// QA 동작 목록 파싱 (#603). `--actions` 파일 또는 `--steps` 문자열을 같은 규칙으로 읽는다.
// QA 실행에서 Write 도구 권한이 안 맞아 actions 파일을 못 만들 때도 `--steps`로 플레이할 수 있게 한다.
// 구분자: 줄바꿈 또는 `;`. `#`로 시작하는 항목은 메모.
// `shot <이름>`(#643): 재생 도중 그 순간을 한 장 더 찍는다. 말풍선·라벨은 몇 초 뒤 사라져서 끝 화면 한 장으로는 못 본다.
export type Step =
  | { cmd: 'click'; x: number; y: number }
  | { cmd: 'wait'; ms: number }
  | { cmd: 'shot'; name: string };

/** 한 실행에서 중간 스크린샷 상한. 이미지 한 장마다 QA 실행이 읽는 양(=구독 사용량)이 는다. */
export const MAX_SHOTS = 8;
// 파일 이름에 그대로 붙으므로 경로 문자(`/`, `.`)는 받지 않는다.
const SHOT_NAME = /^[A-Za-z0-9_-]{1,24}$/;

export function parseSteps(text: string): Step[] {
  const steps = text
    .split(/[\n;]/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l): Step => {
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
      if (cmd === 'shot' && a !== undefined && b === undefined && SHOT_NAME.test(a)) return { cmd, name: a };
      throw new Error(`모르는 동작: ${l}`);
    });
  const names = steps.flatMap((s) => (s.cmd === 'shot' ? [s.name] : []));
  if (names.length > MAX_SHOTS) throw new Error(`shot은 한 실행에 ${MAX_SHOTS}장까지예요 (${names.length}장). 앞에서 이미 본 장면의 shot은 빼고 이어 붙이세요`);
  const dup = names.find((n, i) => names.indexOf(n) !== i);
  if (dup) throw new Error(`shot 이름이 겹쳐요: ${dup}`);
  return steps;
}

/** `qa-work/d5.png` + `peck` → `qa-work/d5-peck.png`. 끝 화면 파일 옆에 나란히 둔다. */
export function midShotPath(finalShot: string, name: string): string {
  const m = /^(.*?)(\.png)?$/i.exec(finalShot)!;
  return `${m[1]}-${name}.png`;
}
