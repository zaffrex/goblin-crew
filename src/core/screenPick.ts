// 시작 화면 고르기(#466). 배포본 기본은 화면 1이고, `?screen=<id>`로 다른 화면을 연다(재생·프레임 도구, 화면 2 확인용).
// 화면 사이 넘어가기(쿼리 없는 배포본은 `order.json` 순서)는 `flow.ts` `startOrder`가 한다(#766). `?screen=`이 있으면 그 화면 하나다.

/** 파라미터가 없거나 모르는 ID일 때 여는 화면. 배포본 동작 그대로다. */
export const DEFAULT_SCREEN = 'magpie_nest';

export interface ScreenPick {
  id: string;
  /** `?screen=`에 모르는 ID가 왔으면 그 값(기본 화면으로 열고 콘솔에 알린다). */
  unknown?: string;
}

/** `?screen=` 값(없으면 null)과 번들에 든 화면 ID 목록으로 시작 화면을 고른다. URL 읽기는 main.ts가 한다(코어는 DOM을 모른다). */
export function pickScreen(want: string | null, ids: readonly string[]): ScreenPick {
  if (!want || want === DEFAULT_SCREEN) return { id: DEFAULT_SCREEN };
  if (ids.includes(want)) return { id: want };
  return { id: DEFAULT_SCREEN, unknown: want };
}

/**
 * 화면마다 다른 공용 글(`ui.*`). 화면 ID 아래 같은 이름 키(`<화면 ID>.card.goal` 등)가 있으면 그 글을 쓰고, 없으면 공용 키 그대로다.
 * 공용 값은 화면 1 글이다(`ui.card.goal` = 店のカギ…). 화면 1이 아닌 화면은 이 키를 전부 자기 글로 가져야 한다(`tests/content/screen-text.test.ts`, #380).
 * `ui.clear`(클리어 카드)는 넣지 않는다. 카드는 `<id>.clear_card` + `ui.next`로 바뀔 예정이라(screen-transition-ui 결정) 그때 따로 한다.
 */
export const SCREEN_TEXT: Readonly<Record<string, string>> = {
  'ui.intro': 'intro',
  'ui.card.goal': 'card.goal',
  'ui.card.why': 'card.why',
};

/** 글 ID를 이 화면에서 실제로 읽을 키로 바꾼다. */
export function screenTextKey(texts: Readonly<Record<string, string>>, screenId: string, id: string): string {
  const own = SCREEN_TEXT[id];
  if (!own) return id;
  const key = `${screenId}.${own}`;
  return key in texts ? key : id;
}
