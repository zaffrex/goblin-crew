// `park_fountain`(화면 2) 단서 프레임 사례(#466 2부, #468 단서 프레임 대조).
// 설계 문서 `docs/design/screens/park_fountain.md` 0절 단서 표 줄마다 하나 + 9절 진입·대기 + 아하·실패 결과.
// 사례 ID 앞머리: `clue-main-N`(0절 주 아하 단서 N), `clue-aux-N`(보조 아하 단서 N), `enter`·`idle`(9절), `aha-`·`fail-`(그 단서가 가리키는 결과).
// 0절 주 아하 단서 ④(`laundromat` 쿵 먼지)는 앞 화면 반응이라 여기서 찍지 않는다.
import type { FrameCase } from './types.ts';

const CASES: FrameCase[] = [
  // 9절 진입: 물줄기 `シャーッ` 글자 + プピ `enter`.
  { id: 'enter', why: '9절 진입: 물소리 글자, プピ 첫마디. 재킷·관리인·자명종·손님이 처음부터 다 보이는가(X4)' },
  // 9절 대기 동작: 관리인 꾸벅(15000~15400ms), 재킷 소매 움찔(12000~12300ms), 손님 동동. 한 번씩은 나오게 17초 찍는다.
  // 16초였을 때 꾸벅 뒤 여유가 0.6초뿐이라 느린 PC(화면 시계가 늦게 감, #286)에서 빠질 수 있었다. 창·간격은 cases.test.ts가 그림 loop로 잰다(#477).
  { id: 'idle', why: '9절 대기: 관리인 꾸벅 + 고개가 자명종 쪽, 재킷 소매 움찔, 손님 시계·동동', minMs: 17_000, every: 200 }, // 움찔 300ms보다 짧은 간격. 17초/200 = 85칸

  // 0절 주 아하(돌 테두리 쿵 → 재킷이 손으로) 단서.
  { id: 'clue-main-1-tap', action: { char: 'jjuk', verb: 'stretch', target: 'fountain' }, says: 'park_fountain.tap', why: '주 단서 ①(3절 9번): 장대로 테두리 カーン → 재킷 소매가 움찔, 1px 미끄러졌다 멈춤' },
  { id: 'clue-main-2-soft', action: { char: 'mukjik', verb: 'stomp', target: 'jacket' }, says: 'park_fountain.soft', why: '주 단서 ②(3절 7번): 재킷 밑 흙길에서 쿵 → ぼふっ 흙먼지, 비둘기. 재킷은 그대로' },
  {
    id: 'clue-main-3-high-again',
    pre: [{ char: 'ppik', verb: 'squeak', target: 'keeper' }, { char: 'jjuk', verb: 'stretch', target: 'jacket' }],
    action: { char: 'jjuk', verb: 'stretch', target: 'jacket' },
    says: 'park_fountain.high_again',
    why: '주 단서 ③(3절 6번 두 번째): 물을 끈 뒤 꼭대기 재킷에 장대 → 부들부들 툭, "조금만 내려와 주면" 혼잣말',
  },
  // 0절 보조 아하(プピッ로 관리인이 분수를 끈다) 단서.
  { id: 'clue-aux-1-spring', action: { char: 'jjuk', verb: 'stretch', target: 'alarm_clock' }, says: 'park_fountain.clock_broken', why: '보조 단서 ①(4절): 장대로 태엽 → 용수철 ビヨーン, 자명종은 고장' },
  { id: 'clue-aux-2-fall', action: { char: 'mukjik', verb: 'stomp', target: 'alarm_clock' }, says: 'park_fountain.clock_fall', why: '보조 단서 ②(4절): 자명종이 화단으로 굴러떨어져도 관리인은 안 깸' },
  { id: 'clue-aux-3-poke', action: { char: 'jjuk', verb: 'stretch', target: 'keeper' }, says: 'park_fountain.keeper_poke', why: '보조 단서 ③(4절): 창 톡톡 → 커튼, 잠꼬대에 닭 울음과 "5분만"' },

  // 단서가 가리키는 결과. 대조할 때 "단서 → 결과"가 같은 그림 말로 이어지는지 본다.
  { id: 'fail-wet', action: { char: 'jjuk', verb: 'stretch', target: 'jacket' }, says: 'park_fountain.wet', why: '3절 5번 💥: 물이 뿜는 동안 재킷에 장대 → 물벼락, "물부터"가 그림으로 읽히는가' },
  { id: 'aha-keeper-wake', action: { char: 'ppik', verb: 'squeak', target: 'keeper' }, says: 'park_fountain.keeper_wake', why: '3절 1번 ★(0절 KX3): 벌떡 → 자명종 탁 → 갸웃 → 벽시계 → 제어판 → 물줄기 꺼짐 → 다시 졺' },
  { id: 'aha-stomp-drop', action: { char: 'mukjik', verb: 'stomp', target: 'fountain' }, says: 'park_fountain.drop', why: '3절 3번 ★: 테두리 엉덩방아 → ゴォン + 분수대 흔들림 → 재킷이 동상 손으로 미끄러짐' },
  {
    id: 'aha-take',
    pre: [{ char: 'ppik', verb: 'squeak', target: 'keeper' }, { char: 'mukjik', verb: 'stomp', target: 'fountain' }],
    action: { char: 'jjuk', verb: 'stretch', target: 'jacket' },
    says: 'park_fountain.take',
    every: 250, // 클리어 컷이 길어서 120ms로는 100칸 상한에 걸린다
    why: '3절 8번 ★: 손 위 재킷을 장대로 집기 → 클리어 컷(8절). 클리어 카드 프레임은 진마씨께 보이는 자료에서 뺀다',
  },
];

export default CASES;
