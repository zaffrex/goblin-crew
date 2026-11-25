// `laundromat`(화면 3, 후보 B「거꾸로 도는 건조기」) 프레임 사례(#764, 설계 `docs/design/screens/laundromat.md`).
// 시트(`public/scenes/laundromat-objects.json`)가 생기는 그림 PR 뒤 바로 찍으려고 먼저 둔다. 행동·대사는 `cases.test.ts`가 지금 JSON으로 본다.
// 사례 ID 앞머리: `clue-sN-`(7절 단서 사슬 표 S0~S6 줄), `aha-sN-`(그 단계 정답 결과, 8절 박자·8-3 replay 확인), `fail-`(다치는 실패),
// `decoy-`(미끼, ADR-0761 H4), `toy-`(폴백·되돌림). 길 이름 3-1·3-2·1-2·2-1·2-2는 설계 4절 규칙 번호다.
// `idle`(대기 loop) 사례는 시트 PR에서 더한다. `cases.test.ts` idle 검사가 시트의 loop 칸 시간을 읽기 때문이다.
import type { Action } from '../../../src/core/puzzle/types.ts';
import type { FrameCase } from './types.ts';

const REVERSE: Action = { char: 'mukjik', verb: 'stomp', target: 'dryer_3' };
const SQUEAK_GAP: Action = { char: 'ppik', verb: 'squeak', target: 'gap' };
const POKE_DUCT: Action = { char: 'jjuk', verb: 'stretch', target: 'duct' };

const CASES: FrameCase[] = [
  // S0 목표 + 진입 연출(설계 12절 끝): 셔터 ガタン → 틈 너머 열쇠 패 반짝 → 까치 갸웃 → プピ `enter`.
  { id: 'enter', why: 'S0 ③: 셔터 ガタン → 틈 너머 길바닥 열쇠(O1, #929 다시 그림) 반짝 → 창 너머 까치 갸웃 → プピ enter. 목표(열쇠)와 도둑(까치)이 첫 3초에 같이 보이는가' },

  // S1 직접은 안 된다.
  { id: 'clue-s1-poke', action: { char: 'jjuk', verb: 'stretch', target: 'gap' }, says: 'laundromat.gap_poke', why: 'T2·S1 ①: 집게가 틈에 들어가 열쇠를 밀어냄 → 셔터 끝에 걸려 끙 → 엉덩방아, 열쇠는 제자리로. "안에서는 밀 수만 있다"가 읽히는가' },
  { id: 'clue-s1-reach', action: { char: 'jjuk', verb: 'stretch', target: 'magpie' }, says: 'laundromat.reach', why: 'T5·S1 ④: 장대가 높은 창까지 못 닿아 부들부들(F2)' },
  { id: 'clue-s1-hook', action: { char: 'jjuk', verb: 'stretch', target: 'shutter' }, says: 'laundromat.shutter_hook', why: 'S1 ③: ノビー × 셔터' },
  {
    id: 'clue-s1-shutter-again',
    pre: [{ char: 'mukjik', verb: 'stomp', target: 'shutter' }],
    action: { char: 'mukjik', verb: 'stomp', target: 'shutter' },
    says: 'laundromat.shutter_stomp_again',
    why: 'S1 ②: 💥 두 번째 「…やっぱり痛い。カギがないとな。」. 목표(열쇠)를 다시 말하는가, 게이지가 두 칸 줄었는가',
  },

  // S2 건조기가 밖과 이어져 있다(★①).
  { id: 'aha-s2-reverse', action: REVERSE, says: 'laundromat.reverse_first', why: 'T1·★①·박자 A: 쿵 → 역회전 → 문 벌컥, 양말·양말·병뚜껑 퐁퐁, 양말 하나가 ズッシー 머리에(anchor) → 0.5초 뒤 까치 털 곤두섬(S3 B). 8-3 H5 +1.2초. 머리 위 양말이 대사 끝까지 1.0초 넘게 가만히 보이는가(8-1 ④)' },
  {
    id: 'aha-s2-reverse-again',
    pre: [REVERSE, REVERSE],
    action: REVERSE,
    says: 'laundromat.reverse_again',
    why: '★① 두 번째(역회전 → 정회전 → 역회전): burst#2 양말 하나(#765 짧은 판). 8-3 H5 +0.4초',
  },

  // S3 들어온 것은 둥지의 것이다.
  { id: 'clue-s3-duct-squeak', action: { char: 'ppik', verb: 'squeak', target: 'duct' }, says: 'laundromat.duct_squeak', why: 'S3 C: プピッ 소리가 배기구로 나가 까치가 움찔. 덕트 끝 = 둥지 밑이 읽히는가' },
  {
    id: 'clue-s3-reach-again',
    pre: [{ char: 'jjuk', verb: 'stretch', target: 'magpie' }],
    action: { char: 'jjuk', verb: 'stretch', target: 'magpie' },
    says: 'laundromat.reach_again',
    why: 'S3 E: 두 번째 「あの巣、ぬくそうやな」. 둥지가 배기 후드 위라는 그림과 같이 읽히는가',
  },

  // S4 열쇠를 까치에게 넘긴다(★②). 이 판에서 가장 큰 빈칸 위험(7절 끝).
  { id: 'clue-s4-snub', action: { char: 'ppik', verb: 'squeak', target: 'magpie' }, says: 'laundromat.snub', why: 'T3·S4 A: 앞 판 수(プピ × 까치)가 빗나감. 까치가 흘끗 보고 "흥", 등을 돌림' },
  {
    id: 'clue-s4-snub-again',
    pre: [{ char: 'ppik', verb: 'squeak', target: 'magpie' }],
    action: { char: 'ppik', verb: 'squeak', target: 'magpie' },
    says: 'laundromat.snub_again',
    why: 'S4 A 두 번째: 등 돌린 채 틈 쪽 열쇠를 힐끔. "고무 닭보다 열쇠"가 보이는가(⚠ 반)',
  },
  {
    id: 'clue-s4-poke-again',
    pre: [{ char: 'jjuk', verb: 'stretch', target: 'gap' }],
    action: { char: 'jjuk', verb: 'stretch', target: 'gap' },
    says: 'laundromat.gap_poke_again',
    why: 'S4 B: 「なんか上から見られてる」 + 까치가 고개를 내밀어 열쇠를 내려다봄(O3). 블라인드 의도 0/2였던 칸, 움직임과 대사로는 읽히는가',
  },
  { id: 'aha-s4-steal', action: SQUEAK_GAP, says: 'laundromat.steal', why: '3-1·★② 정회전·박자 B: 까치 fly_out → 틈 속 머리·부리가 열쇠를 물어 감(블라인드 까치 0/2, 순서로는 2/2) → fly_in 둥지에 열쇠. 내려앉을 때 열쇠가 툭 생기지 않는가(Luna #934 우려). H5 +0.4초' },
  {
    id: 'aha-s4-suck',
    pre: [REVERSE],
    action: SQUEAK_GAP,
    says: 'laundromat.suck',
    why: '3-2·★② 역회전·박자 B\' (커밋 순서): beak_suck 첫 칸 부리에 문 열쇠(#934) → 빈 부리 멍 → 혹이 천장 덕트를 가로질러 덜컥 → 깃털 퐁, ズッシー 머리에. 8-3 확인 (2) 덜컥과 깃털이 한 박자로 붙는가(lump_travel 마지막 칸 80~120ms). H5 +0.8초',
  },

  // S5 열쇠가 들어오다 걸린다(다른 순서 1-2).
  {
    id: 'aha-s5-reverse-key',
    pre: [SQUEAK_GAP],
    action: REVERSE,
    says: 'laundromat.reverse_key',
    why: '1-2·★① 다른 순서: 행렬 없이 key_out(둥지 빈 칸) → 혹 여행 → 덜컥 → 깃털 → 「…来る。…来ない。」. 8-3 확인 (1) 혹이 창 쪽 첫 자리에서 1~2칸 머문 뒤 출발하는가. H5 +0.8초',
  },

  // S6 뚫는다(★③) → 클리어 연출(8-2, H6 처음 8초 안). 클리어 카드 프레임은 진마씨께 보이는 자료에서 뺀다.
  {
    id: 'aha-s6-clear',
    pre: [REVERSE, SQUEAK_GAP],
    action: POKE_DUCT,
    says: 'laundromat.clear_nest',
    every: 150,
    why: '★③·박자 C: 쿡 → 혹 쑥 + 둥지 사라짐 → perch_drop(쿡 바로 다음 줄, 사이가 안 뜨는가, 8-3 확인 (3)) → 문 벌컥, 둥지가 ズッシー 머리에 16 → 8 → 0px → fly_out 첫 칸이 둥지 높이에서 몇 px 튀는가 → 까치가 둥지 위에 → 셔터 촤르르. 어림 6.7초',
  },

  // 되돌림·폴백.
  { id: 'toy-forward', pre: [REVERSE], action: REVERSE, says: 'laundromat.forward', why: '2-1: 역회전 → 정회전(reverse_start 칸 거꾸로), 까치가 따뜻한 바람에 부풂(fluff)' },
  {
    id: 'toy-forward-stuck',
    pre: [REVERSE, SQUEAK_GAP],
    action: REVERSE,
    says: 'laundromat.forward_stuck',
    why: '2-2: 걸린 혹이 덕트를 거꾸로 돌아가고(lump_back) 열쇠가 둥지로(key_in). 막다른 상태 대신 되돌림이 읽히는가',
  },
  { id: 'toy-duct-warm', action: POKE_DUCT, says: 'laundromat.duct_warm', why: '덕트 쿡(정회전): 따뜻함. ★③ 자리 미리 보기' },
  { id: 'toy-duct-suck', pre: [REVERSE], action: POKE_DUCT, says: 'laundromat.duct_suck', why: '덕트 쿡(역회전, 혹 없음)' },
  { id: 'toy-duct-stomp', action: { char: 'mukjik', verb: 'stomp', target: 'duct' }, says: 'laundromat.duct_stomp', why: '폴백: ズッシー × 덕트' },
  { id: 'toy-gap-stomp', action: { char: 'mukjik', verb: 'stomp', target: 'gap' }, says: 'laundromat.gap_stomp', why: '폴백: 틈 앞 쿵 → 셔터 덜컹(rattle) + gap 그림 톡(hop). 열쇠가 튀어 보이는가' },
  { id: 'toy-gap-empty-squeak', pre: [SQUEAK_GAP], action: SQUEAK_GAP, says: 'laundromat.gap_squeak_empty', why: '열쇠가 둥지로 간 뒤 빈 틈에 プピッ' },
  { id: 'toy-gap-empty-poke', pre: [SQUEAK_GAP], action: { char: 'jjuk', verb: 'stretch', target: 'gap' }, says: 'laundromat.gap_poke_empty', why: '열쇠가 둥지로 간 뒤 빈 틈에 장대' },
  { id: 'toy-dryer-stretch', action: { char: 'jjuk', verb: 'stretch', target: 'dryer_3' }, says: 'laundromat.dryer_stretch', why: '폴백: ノビー × 건조기' },
  { id: 'toy-dryer-squeak', action: { char: 'ppik', verb: 'squeak', target: 'dryer_3' }, says: 'laundromat.dryer_squeak', why: '폴백: プピ × 건조기(부저가 대답)' },
  { id: 'toy-magpie-stomp', action: { char: 'mukjik', verb: 'stomp', target: 'magpie' }, says: 'laundromat.magpie_stomp', why: '폴백: ズッシー × 까치' },
  { id: 'toy-shutter-squeak', action: { char: 'ppik', verb: 'squeak', target: 'shutter' }, says: 'laundromat.shutter_squeak', why: '폴백: プピ × 셔터' },

  // 미끼(ADR-0761 H4): 자판기 셋.
  { id: 'decoy-soap-stretch', action: { char: 'jjuk', verb: 'stretch', target: 'soap_vending' }, says: 'laundromat.soap_stretch', why: '미끼: ノビー × 자판기' },
  { id: 'decoy-soap-stomp', action: { char: 'mukjik', verb: 'stomp', target: 'soap_vending' }, says: 'laundromat.soap_stomp', why: '미끼: ズッシー × 자판기' },
  { id: 'decoy-soap-squeak', action: { char: 'ppik', verb: 'squeak', target: 'soap_vending' }, says: 'laundromat.soap_squeak', why: '미끼: プピ × 자판기' },
];

export default CASES;
