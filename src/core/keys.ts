// 키 입력 분류(순수 로직). 지금은 시작 카드 닫기(설계 6-2-1절)에서 쓰고, 나중에 대사 넘기기 같은 "아무 키" 입력도 같은 규칙을 쓴다.

/** 혼자서는 탭이 아닌 키. 누르기만 해도 오는 수정·잠금 키와 포커스 이동(Tab), IME 처리 중 키다. */
const PASSIVE_KEYS: ReadonlySet<string> = new Set([
  "Shift",
  "Control",
  "Alt",
  "AltGraph",
  "Meta",
  "OS",
  "CapsLock",
  "NumLock",
  "ScrollLock",
  "Fn",
  "FnLock",
  "Tab",
  "Dead",
  "Process",
  "Unidentified",
]);

/** `KeyboardEvent`에서 필요한 것만. 테스트에서 가짜 이벤트를 쉽게 만든다. */
export interface KeyLike {
  key: string;
  repeat: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  isComposing?: boolean;
}

/**
 * 이 키 입력을 "아무 키 = 탭"으로 셀까(PR #306 Ben 리뷰 우려 1).
 * 누른 채 들어오는 반복(`repeat`), 수정·잠금 키 단독, Ctrl/Cmd/Alt 조합(새로고침 같은 브라우저 단축키),
 * IME 조합 중 입력은 세지 않는다. Shift+글자는 그냥 글자라 센다.
 */
export function isTapKey(e: KeyLike): boolean {
  if (e.repeat || e.isComposing === true) return false;
  if (e.ctrlKey || e.metaKey || e.altKey) return false;
  return !PASSIVE_KEYS.has(e.key);
}
