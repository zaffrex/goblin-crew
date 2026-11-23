// `park_fountain`(화면 2) 단서 프레임 사례(#466 2부, #468 단서 프레임 대조).
// S2(#802, 설계 `docs/design/screens/park_fountain-s2.md`) 기준: 1절 첫 시도 T1~T4, 6절 단서 표 줄마다 하나 + 9절 진입·대기 + 아하·실패 결과.
// 사례 ID 앞머리: `clue-main-N`(주 아하 "비둘기 지정석" 단서), `clue-aux-N`(아하 "끌 수 없는 자명종 = 오리" 단서), `enter`·`idle`(9절),
// `aha-`·`fail-`(그 단서가 가리키는 결과), `decoy-`(미끼 규칙, ADR-0761 H4), `toy-`(장난감·폴백 반응).
import type { FrameCase } from './types.ts';

const CASES: FrameCase[] = [
  // 9절 진입: 물줄기 `シャーッ` 글자 + プピ `enter`.
  { id: 'enter', why: '9절 진입: 물소리 글자, プピ 첫마디. 재킷·관리인·자명종·오리·손님이 처음부터 다 보이는가(X4)' },
  // 9절 대기 동작: 관리인 꾸벅(15000~15400ms), 손님 동동. 재킷 소매 움찔 loop는 S2에서 뺐다(예고편, 설계 6절). 한 번씩은 나오게 17초 찍는다.
  // 16초였을 때 꾸벅 뒤 여유가 0.6초뿐이라 느린 PC(화면 시계가 늦게 감, #286)에서 빠질 수 있었다. 창·간격은 cases.test.ts가 그림 loop로 잰다(#477).
  { id: 'idle', why: '9절 대기: 관리인 꾸벅 + 고개가 자명종 쪽, 손님 시계·동동. 재킷은 가만히 있는가(움찔 loop 없음)', minMs: 17_000, every: 200 },

  // 주 아하(물을 끈 뒤 흙길 쿵 → 비둘기가 꼭대기 지정석에 앉으며 재킷을 밀어냄) 단서.
  { id: 'clue-main-1-pigeons-wet', action: { char: 'mukjik', verb: 'stomp', target: 'jacket' }, says: 'park_fountain.pigeons_wet', why: 'T4·단서 ⑤(3절 7번, 16절 S7): 물 켜짐에 흙길 쿵 → 비둘기가 돌우산 꼭대기로 날았다가 물보라에 맞고 쫓겨 옴. 대사 「ハト、てっぺんで水に追い返された」가 비행을 놓쳐도 혼자 읽히는가. 재킷은 1px도 안 움직이는가' },
  {
    id: 'clue-main-2-seat',
    pre: [{ char: 'mukjik', verb: 'stomp', target: 'jacket' }],
    action: { char: 'mukjik', verb: 'stomp', target: 'jacket' },
    says: 'park_fountain.pigeons_wet_again',
    why: '단서 ⑥(3절 7번 두 번째): 같은 쿵 두 번째 → 「あそこはハトの指定席か」. 꼭대기 = 비둘기 자리가 그림과 같이 읽히는가',
  },
  {
    id: 'clue-main-3-high-again',
    pre: [{ char: 'ppik', verb: 'squeak', target: 'duck' }, { char: 'jjuk', verb: 'stretch', target: 'jacket' }],
    action: { char: 'jjuk', verb: 'stretch', target: 'jacket' },
    says: 'park_fountain.high_again',
    why: '단서 ⑦(3절 6번 두 번째): 물을 끈 뒤 꼭대기 재킷에 장대 → 부들부들 툭, "조금만 내려와 주면" 혼잣말',
  },
  // 아하 "끌 수 없는 자명종"(프피 × 오리) 단서.
  { id: 'clue-aux-1-snooze', action: { char: 'ppik', verb: 'squeak', target: 'keeper' }, says: 'park_fountain.snoozed', why: 'T2·단서 ①(3절 1번): 가장 뻔한 첫 시도. 관리인이 눈도 안 뜨고 자명종을 탁 → 「はいはい、起きた起きた…」 → 계속 졺. 깨어날 것 같던 예상이 웃기게 빗나가는가' },
  {
    id: 'clue-aux-2-snooze-again',
    pre: [{ char: 'ppik', verb: 'squeak', target: 'keeper' }],
    action: { char: 'ppik', verb: 'squeak', target: 'keeper' },
    says: 'park_fountain.snoozed_again',
    // 대사 두 번째는 규칙 ID별로 센다(scene.ts variantKey). 관리인 → 자명종 순이면 `keeper_snooze_clock`의 첫 번째(snoozed)가 다시 뜬다.
    why: '단서 ②(3절 1번 두 번째, 16절 S4): 「目覚まし扱い…ずっと鳴る音なら…」. 탁 뒤에 오리가 돌아보고(길 A), "계속 울리는 소리"를 찾게 하는 혼잣말이 읽히는가',
  },
  { id: 'clue-aux-3-poke', action: { char: 'jjuk', verb: 'stretch', target: 'keeper' }, says: 'park_fountain.keeper_poke', why: '단서 ④(폴백 그대로): 창 톡톡 → 커튼, 잠꼬대에 닭 울음과 "5분만"(스누즈 버릇을 미리 보여 줌)' },

  // 단서가 가리키는 결과. 대조할 때 "단서 → 결과"가 같은 그림 말로 이어지는지 본다.
  { id: 'fail-wet', action: { char: 'jjuk', verb: 'stretch', target: 'jacket' }, says: 'park_fountain.wet', why: 'T1·3절 5번 💥: 물이 뿜는 동안 재킷에 장대 → 물벼락, "물부터"가 그림으로 읽히는가' },
  {
    id: 'aha-duck-alarm',
    action: { char: 'ppik', verb: 'squeak', target: 'duck' },
    says: 'park_fountain.fountain_off',
    why: '3절 3번 ★: プピッ → 오리 クワッ → 관리인이 자면서 탁 → 또 クワッ(안 꺼짐) → 벌떡 → 벽시계 → 제어판 → 물줄기 꺼짐. "오리 소리가 관리인을 깨웠다"가 읽히는가(설계 8절 우려)',
  },
  {
    id: 'aha-pigeons-perch',
    pre: [{ char: 'ppik', verb: 'squeak', target: 'duck' }],
    action: { char: 'mukjik', verb: 'stomp', target: 'jacket' },
    says: 'park_fountain.drop',
    why: '3절 8번 ★: 물 꺼짐에 흙길 쿵 → 비둘기가 꼭대기에 내려앉고 재킷이 그 밑에서 미끄러져 동상 손으로. 새가 닿기 전 재킷이 정지해 있는가(N1)',
  },
  {
    id: 'aha-take',
    pre: [{ char: 'ppik', verb: 'squeak', target: 'duck' }, { char: 'mukjik', verb: 'stomp', target: 'jacket' }],
    action: { char: 'jjuk', verb: 'stretch', target: 'jacket' },
    // 클리어 컷 안에 말풍선이 없다(#781, 끝 한마디는 엔진 clearLine). 12초 컷이라 120ms로는 100칸 상한에 걸린다
    every: 150,
    why: '3절 9번 ★: 손 위 재킷을 장대로 집기 → 클리어 컷(#781 12초 판). 재회 만세 → 늦은 자명종 → 관리인 꾹 → 물 솟음·손님 흠뻑. 클리어 카드 프레임은 진마씨께 보이는 자료에서 뺀다',
  },

  // 미끼 규칙(ADR-0761 H4). 그럴듯한 첫 시도가 빗나가고 아무 상태도 안 바뀌는지 본다.
  { id: 'decoy-sit-wet', action: { char: 'mukjik', verb: 'stomp', target: 'fountain' }, says: 'park_fountain.sit_wet', why: 'T3·3절 10번: 테두리에 털썩 → 젖은 돌이라 엉덩이만 젖음, 분수대는 꿈쩍 안 함, 비둘기는 돌아보기만(단서 ⑧)' },
  {
    id: 'decoy-sit-dry',
    pre: [{ char: 'ppik', verb: 'squeak', target: 'duck' }],
    action: { char: 'mukjik', verb: 'stomp', target: 'fountain' },
    says: 'park_fountain.sit_dry',
    why: '16절 S7 길 C: 물을 끈 뒤 분수대에 쿵(흔들어 떨어뜨리기) → 털썩, 돌은 꿈쩍 안 하고 땅 비둘기만 돌아봄 「ハトだけ落ち着かない」. 비둘기가 다음 대상으로 읽히는가',
  },
  {
    id: 'decoy-statue-step',
    pre: [{ char: 'ppik', verb: 'squeak', target: 'duck' }, { char: 'jjuk', verb: 'stretch', target: 'jacket' }],
    action: { char: 'mukjik', verb: 'stomp', target: 'statue' },
    says: 'park_fountain.statue_sit_dry',
    why: '18절 S7 길 F: 물을 끈 뒤 장대가 짧아서(high) ズッシー를 발판으로 동상 밑에 앉힘(像をドスン) → 땅 비둘기가 돌아봄 「踏み台でも届かない。てっぺんはハトの席だ」. 발판 생각이 비둘기·꼭대기로 꺾이는가, ノビー 몸이 땅 비둘기를 가리지 않는가',
  },
  { id: 'decoy-tap', action: { char: 'jjuk', verb: 'stretch', target: 'fountain' }, says: 'park_fountain.tap', why: '3절 12번: 장대로 테두리 カーン → 비둘기만 돌아봄(단서 ⑧). 재킷 움찔이 없는가(예고편 뺌)' },
  {
    id: 'decoy-tap-left',
    pre: [{ char: 'jjuk', verb: 'stretch', target: 'alarm_clock' }],
    action: { char: 'jjuk', verb: 'stretch', target: 'fountain' },
    says: 'park_fountain.tap',
    why: '#530: 쭉이가 자명종 쪽(테두리 왼쪽 x 111)에서 칠 때 カーン이 왼쪽 끝 장대 옆에 뜨는가, ニューッ과 안 겹치는가',
  },
  {
    id: 'decoy-squeak-seated',
    pre: [{ char: 'ppik', verb: 'squeak', target: 'duck' }, { char: 'mukjik', verb: 'stomp', target: 'jacket' }],
    action: { char: 'ppik', verb: 'squeak', target: 'jacket' },
    says: 'park_fountain.jacket_squeak_seated',
    why: '3절 14번: 꼭대기 비둘기는 プピッ에도 꿈쩍 안 함. 땅 칸으로 순간이동하지 않는가(Luna #810 리뷰 A), 클릭이 안 먹은 것처럼 보이지 않는가',
  },

  // 폴백 반응. 단서가 아니라서 블라인드 대조 대상은 아니다.
  { id: 'toy-clock-spring', action: { char: 'jjuk', verb: 'stretch', target: 'alarm_clock' }, says: 'park_fountain.clock_broken', why: '폴백: 장대로 태엽 → 용수철 ビヨーン, 자명종은 고장' },
  { id: 'toy-clock-fall', action: { char: 'mukjik', verb: 'stomp', target: 'alarm_clock' }, says: 'park_fountain.clock_fall', why: '폴백: 자명종이 화단으로 굴러떨어져도 관리인은 안 깸' },
  // 오리 × ノビー·ズッシー 폴백(4절, 7절 P9). 오리는 S2에서 정답 대상(프피)이 됐지만 이 둘은 폴백 그대로다. 그림이 물 위에 떠 있는지, 서로 다른 반응으로 읽히는지 본다(#529).
  { id: 'toy-duck-peck', action: { char: 'jjuk', verb: 'stretch', target: 'duck' }, says: 'park_fountain.duck_peck', why: '4절 오리 × ノビー: 집게를 콕 → いてっ → 왼쪽으로 헤엄쳐 갔다가 제자리' },
  { id: 'toy-duck-flap', action: { char: 'mukjik', verb: 'stomp', target: 'duck' }, says: 'park_fountain.duck_splash', why: '4절 오리 × ズッシー: 쿵에 놀라 퍼덕 → 물벼락 → 젖은 ズッシー' },
  {
    id: 'toy-duck-flap-high',
    pre: [{ char: 'mukjik', verb: 'move', target: 'floor' }],
    floor: [400, 205],
    action: { char: 'mukjik', verb: 'stomp', target: 'duck' },
    says: 'park_fountain.duck_splash',
    why: '#575: 위쪽 바닥(발 y 205)에서 쿵 → x 187에서 발 y 242까지 앞으로 내려선 뒤 퍼덕. 오리가 ズッシー 몸 뒤에 가리지 않고, 머리와 오리 사이에 틈이 남는다(CLEAR_GAP)',
  },
  {
    id: 'toy-duck-flap-mid',
    pre: [{ char: 'mukjik', verb: 'move', target: 'floor' }],
    floor: [400, 236],
    action: { char: 'mukjik', verb: 'stomp', target: 'duck' },
    says: 'park_fountain.duck_splash',
    why: '#585: 바닥 가운데(발 y 236, 재판정 4 ❌ 자리)에서 쿵 → 반만 안 가려도 머리가 오리에 붙으니 발 y 242까지 내려선 뒤 퍼덕. 머리와 오리 사이에 틈이 남는다',
  },
];

export default CASES;
