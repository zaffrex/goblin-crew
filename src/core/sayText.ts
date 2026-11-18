import { CHARACTERS } from './characters';

/**
 * 말풍선 글 고르기(#286). 한 폴백을 세 사람 말투로 나눌 때 쓴다.
 * `<id>.<화자>` 키가 있으면 그 글, 없으면 `<id>`, 그것도 없으면 ID 그대로.
 * 예: 대상별 みる(`magpie_nest.look.hook`)는 데이터에 화자 `self` 한 줄만 두고,
 * 글 파일의 `magpie_nest.look.hook.mukjik` 같은 변형으로 말투를 나눈다. 코어(`step`)는 이걸 모른다.
 */
export function sayText(texts: Readonly<Record<string, string>>, id: string, speaker: string): string {
  return texts[`${id}.${speaker}`] ?? texts[id] ?? id;
}

/**
 * 이 글 ID가 화면에 뜰 수 있는 모든 글(#304). 기본 글(없으면 ID) + 캐릭터별 `<id>.<캐릭터>` 변형.
 * 재생 검사(`checkStep`)가 누가 말했는지 몰라도 변형 글을 맞게 치려고 쓴다.
 */
export function sayTextVariants(texts: Readonly<Record<string, string>>, id: string): string[] {
  const out = [texts[id] ?? id];
  for (const c of CHARACTERS) {
    const v = texts[`${id}.${c.id}`];
    if (v !== undefined && !out.includes(v)) out.push(v);
  }
  return out;
}

/** 본 대사 표(`seenSay`) 키(#304). 같은 ID라도 화자가 다르면 화면 글이 다를 수 있어 따로 센다. */
export function seenSayKey(speaker: string, id: string): string {
  return `${speaker}:${id}`;
}
