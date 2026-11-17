/**
 * 말풍선 글 고르기(#286). 한 폴백을 세 사람 말투로 나눌 때 쓴다.
 * `<id>.<화자>` 키가 있으면 그 글, 없으면 `<id>`, 그것도 없으면 ID 그대로.
 * 예: 대상별 みる(`magpie_nest.look.hook`)는 데이터에 화자 `self` 한 줄만 두고,
 * 글 파일의 `magpie_nest.look.hook.mukjik` 같은 변형으로 말투를 나눈다. 코어(`step`)는 이걸 모른다.
 */
export function sayText(texts: Readonly<Record<string, string>>, id: string, speaker: string): string {
  return texts[`${id}.${speaker}`] ?? texts[id] ?? id;
}
