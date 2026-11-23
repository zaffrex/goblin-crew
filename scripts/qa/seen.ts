// QA 화면 글 기록 (#601 7회차). 말풍선은 2~4초만 떠 있어서 스크린샷 사이에 지나가면 QA는 "아무 반응 없음"으로 적는다.
// 사람은 화면을 계속 보니 다 읽는다. 그래서 재생 내내 화면에 뜬 글(말풍선·클리어 줄·기절 줄·첫 게이지 안내)만 시간과 함께 모아 끝에 알려 준다.
// 읽는 건 사람 눈에 보이는 DOM 글자뿐이다. 게임 상태·규칙 ID·대사 키·숨은 요소는 읽지 않는다.
import { readFileSync } from 'node:fs';

/** 기록할 화면 글 종류. */
export type SeenId = 'bubble' | 'clear' | 'faint' | 'gaugeNote';

/**
 * 첫 게이지 감소 안내(`ui.hud.gauge_first_drop`, 설계 6-2-5절). 대상 라벨 자리(`#label`)에 2.5초 뜨고, 다음 클릭이 지운다.
 * 묶음 1-3(#601 P1-e): 다치는 실패(#2) 직후 뜬 이 안내가 기록에 없어서, 다음 클릭(#3) 스크린샷에서야 줄어든 게이지를 보고
 * "걷기만 했는데 말풍선 없이 게이지 −1"로 적혔다. UI 글 하나라 정답 정보는 없다.
 */
export const GAUGE_NOTE_TEXT = (JSON.parse(readFileSync(new URL('../../content/text/ja.json', import.meta.url), 'utf8')) as Record<string, string>)[
  'ui.hud.gauge_first_drop'
]!;

/**
 * 어디서 읽나. 잠깐 떴다 사라지는 것만. `#label`은 마우스를 올린 동안 계속 보이는 대상 라벨이라 스크린샷으로 충분해서
 * 통째로는 안 읽고, 같은 자리에 잠깐 뜨는 첫 게이지 안내 글자일 때만 적는다(`only`).
 */
export const SEEN_SOURCES: readonly { id: SeenId; el: string; only?: string }[] = [
  { id: 'bubble', el: 'bubble' },
  { id: 'clear', el: 'clear' },
  { id: 'faint', el: 'faint' },
  { id: 'gaugeNote', el: 'label', only: GAUGE_NOTE_TEXT },
];

export interface Seen {
  id: SeenId;
  text: string;
  /** 페이지 시계(`performance.now()`, ms). */
  start: number;
  /** 사라진 시각. 끝날 때까지 떠 있었으면 null. */
  end: number | null;
}

/** 페이지에 먼저 넣는 기록기(`Page.addInitScript`). 50ms마다 보이는 글이 바뀌었는지만 본다. */
export const SEEN_RECORDER = `(() => {
  const sources = ${JSON.stringify(SEEN_SOURCES)};
  const log = [];
  const open = {};
  Object.defineProperty(window, '__qaSeen', { value: log });
  setInterval(() => {
    const now = performance.now();
    for (const { id, el: elId, only } of sources) {
      const el = document.getElementById(elId);
      let text = el && !el.hidden ? (el.textContent || '').trim() : '';
      if (only !== undefined && text !== only) text = '';
      const cur = open[id];
      if (cur && cur.text !== text) { cur.end = now; open[id] = null; }
      if (text && !open[id]) { const e = { id, text, start: now, end: null }; log.push(e); open[id] = e; }
    }
  }, 50);
})();`;

const NAME: Record<SeenId, string> = { bubble: '말풍선', clear: '클리어 줄', faint: '기절 줄', gaugeNote: '게이지 안내' };

const sec = (ms: number): string => `${(ms / 1000).toFixed(1)}초`;

/**
 * 한 클릭의 글이 그 클릭 뒤 얼마까지 늦게 뜰 수 있나(ms). 캐릭터는 대상까지 걸어간 뒤에 반응한다.
 * 걷기 1.5px/틱 × 60틱 = 90px/초라 화면 폭 480px을 다 걸으면 약 5.3초, 반응 anim(쿵·젖기)이 말풍선 앞에 2~3초 더 붙는다.
 * 8회차(#601): 대상까지 걸어가는 동안 다음 클릭을 보냈더니 앞 클릭의 대사가 뒤 클릭 밑으로 적혀, 앞 대상이 "반응 없음"으로 읽혔다.
 */
export const LATE_REACTION_MS = 8_000;

/**
 * 글이 사라지기 전 이만큼 안에 클릭이 있었으면 "그 클릭이 닫았을 수 있음"으로 적는다(ms).
 * 행동 뒤 말풍선은 뜬 뒤 1.0초(본 글 0.4초)부터, 시작 연출 말풍선은 바로 월드 클릭으로 닫힌다(#700). 그 전 클릭도 맡아 뒀다가 1.0초에 실행하며 닫는다(#832).
 * 그래서 1.0초 + 기록기 주기 50ms + 여유. 묶음 1(#601): 「1.0초만 떠서 읽을 틈이 없었다」 두 건이 Mia 자기 클릭이 닫은 것이었다.
 */
export const CLOSE_BY_CLICK_MS = 1_100;

/** 클릭 뒤에 닫힌 글이 있을 때 끝에 붙이는 안내. 도구·조작 안내만이고 정답 정보는 없다. */
export const CLOSED_NOTE =
  '※ "click N 뒤 닫힘"이 붙은 글은 그 클릭이 말풍선을 넘겼을 수 있어요(게임이 짧게 띄운 게 아닐 수 있어요). 말풍선은 클릭하면 닫혀요(행동 뒤 말풍선은 뜬 지 1.0초부터, 시작 대사는 바로). 게이지 안내는 아무 클릭에나 바로 닫혀요. 끝까지 읽으려면 그 클릭 앞에 `wait 3000`을 더 띄우세요.';

/** 같은 글의 원인 후보로 같이 적는 앞 클릭 수 상한. */
const MAX_EARLIER = 1;

/** 클릭 후보가 둘 이상인 글이 있을 때 끝에 붙이는 안내. 정답 정보는 없고 도구 사용법만. */
export const MIXED_NOTE =
  '※ 클릭이 둘 이상 적힌 글은 그중 어느 클릭의 결과인지 화면 글만으로는 몰라요. 캐릭터는 걸어간 뒤에 반응해서 글이 클릭 뒤 최대 약 8초에 떠요. 행동 하나마다 `wait 5000; wait 3000`을 띄우면 안 섞여요.';

/**
 * 기록을 사람이 읽는 줄로. `clicks`는 각 클릭(탭)을 보낸 페이지 시각이다.
 * 예: `click 5 뒤 +2.3초, 3.9초 동안 말풍선: 「…いい石だ。 / 落ち着く。」`
 * 글이 뜨기 전 `LATE_REACTION_MS` 안에 클릭이 더 있었으면 그 클릭도 같이 적는다(바로 앞 하나 더):
 * `click 16 뒤 +3.6초 / click 15 뒤 +4.0초, …`. 그런 줄이 하나라도 있으면 끝에 `MIXED_NOTE`를 붙인다.
 * 떠 있는 동안 누른 클릭 뒤 `CLOSE_BY_CLICK_MS` 안에 사라진 글은 `1.0초 동안(click 6 뒤 닫힘)`처럼 적고 끝에 `CLOSED_NOTE`를 붙인다.
 */
export function formatSeen(seen: readonly Seen[], clicks: readonly number[]): string[] {
  let mixed = false;
  let closed = false;
  const lines = seen.map((s) => {
    let k = -1;
    for (let i = 0; i < clicks.length; i++) if (clicks[i]! <= s.start) k = i;
    const parts = k < 0 ? [`첫 클릭 전`] : [`click ${k + 1} 뒤 +${sec(s.start - clicks[k]!)}`];
    for (let i = k - 1; i >= 0 && parts.length <= MAX_EARLIER && s.start - clicks[i]! <= LATE_REACTION_MS; i--) {
      parts.push(`click ${i + 1} 뒤 +${sec(s.start - clicks[i]!)}`);
    }
    if (parts.length > 1) mixed = true;
    let dur = s.end === null ? '끝까지' : `${sec(s.end - s.start)} 동안`;
    const c = s.end === null ? -1 : closingClick(clicks, s.start, s.end);
    if (c >= 0) {
      closed = true;
      dur += `(click ${c + 1} 뒤 닫힘)`;
    }
    return `${parts.join(' / ')}, ${dur} ${NAME[s.id]}: 「${s.text.replace(/\s*\n\s*/g, ' / ')}」`;
  });
  return [...lines, ...(mixed ? [MIXED_NOTE] : []), ...(closed ? [CLOSED_NOTE] : [])];
}

/** 글이 떠 있는 동안(`start` 뒤 ~ `end`) 누른 클릭 중 `end` 전 `CLOSE_BY_CLICK_MS` 안의 마지막 것. 없으면 -1. */
function closingClick(clicks: readonly number[], start: number, end: number): number {
  for (let i = clicks.length - 1; i >= 0; i--) {
    const c = clicks[i]!;
    if (c > end) continue;
    return c > start && end - c <= CLOSE_BY_CLICK_MS ? i : -1;
  }
  return -1;
}
