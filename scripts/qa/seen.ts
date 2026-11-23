// QA 화면 글 기록 (#601 7회차). 말풍선은 2~4초만 떠 있어서 스크린샷 사이에 지나가면 QA는 "아무 반응 없음"으로 적는다.
// 사람은 화면을 계속 보니 다 읽는다. 그래서 재생 내내 화면에 뜬 글(말풍선·클리어 줄·기절 줄)만 시간과 함께 모아 끝에 알려 준다.
// 읽는 건 사람 눈에 보이는 DOM 글자뿐이다. 게임 상태·규칙 ID·대사 키·숨은 요소는 읽지 않는다.

/** 기록할 화면 글. 잠깐 떴다 사라지는 것만. 대상 라벨(`#label`)은 마우스를 올린 동안 계속 보여서 스크린샷으로 충분하다. */
export const SEEN_IDS = ['bubble', 'clear', 'faint'] as const;
export type SeenId = (typeof SEEN_IDS)[number];

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
  const ids = ${JSON.stringify(SEEN_IDS)};
  const log = [];
  const open = {};
  Object.defineProperty(window, '__qaSeen', { value: log });
  setInterval(() => {
    const now = performance.now();
    for (const id of ids) {
      const el = document.getElementById(id);
      const text = el && !el.hidden ? (el.textContent || '').trim() : '';
      const cur = open[id];
      if (cur && cur.text !== text) { cur.end = now; open[id] = null; }
      if (text && !open[id]) { const e = { id, text, start: now, end: null }; log.push(e); open[id] = e; }
    }
  }, 50);
})();`;

const NAME: Record<SeenId, string> = { bubble: '말풍선', clear: '클리어 줄', faint: '기절 줄' };

const sec = (ms: number): string => `${(ms / 1000).toFixed(1)}초`;

/**
 * 기록을 사람이 읽는 줄로. `clicks`는 각 클릭(탭)을 보낸 페이지 시각이다.
 * 예: `click 5 뒤 +2.3초, 3.9초 동안 말풍선: 「…いい石だ。 / 落ち着く。」`
 */
export function formatSeen(seen: readonly Seen[], clicks: readonly number[]): string[] {
  return seen.map((s) => {
    let k = -1;
    for (let i = 0; i < clicks.length; i++) if (clicks[i]! <= s.start) k = i;
    const when = k < 0 ? `첫 클릭 전` : `click ${k + 1} 뒤 +${sec(s.start - clicks[k]!)}`;
    const dur = s.end === null ? '끝까지' : `${sec(s.end - s.start)} 동안`;
    return `${when}, ${dur} ${NAME[s.id]}: 「${s.text.replace(/\s*\n\s*/g, ' / ')}」`;
  });
}
