// `magpie_nest`(화면 1) 특기 연출 사례. frames.ts에서 옮겨 왔다(#466 2부). 내용은 그대로다.
import type { FrameCase } from './types.ts';

/**
 * 처음 상태에서 쓰는 특기 사례. 진마씨 2차 플레이에서 실제로 누른 조합(#284 PM 재현 표) + 대상별 하나씩.
 * 정답 경로(고리 → 둥지)는 replay.ts A1이 본다.
 */
const CASES: FrameCase[] = [
  { id: 'jjuk-stretch-nest', action: { char: 'jjuk', verb: 'stretch', target: 'nest' }, why: '바닥에서 둥지: 장대가 늘어나다 모자라야 한다(#284 완료 조건 2)' },
  { id: 'jjuk-stretch-hook', action: { char: 'jjuk', verb: 'stretch', target: 'hook' }, why: '바닥에서 고리: 집게가 고리 아래에서 멈춤' },
  { id: 'jjuk-stretch-magpie', action: { char: 'jjuk', verb: 'stretch', target: 'magpie' }, why: '바닥에서 까치' },
  { id: 'mukjik-stomp-seesaw_left', action: { char: 'mukjik', verb: 'stomp', target: 'seesaw_left' }, why: '반대쪽 빈 시소 쿵: 흔들림 + "반대쪽" 암시 대사(#284 완료 조건 3)' },
  { id: 'mukjik-stomp-hook', action: { char: 'mukjik', verb: 'stomp', target: 'hook' }, why: '고리에 쿵' },
  { id: 'ppik-squeak-nest', action: { char: 'ppik', verb: 'squeak', target: 'nest' }, why: '둥지에 삑: 소리 글자' },
  { id: 'ppik-squeak-magpie', action: { char: 'ppik', verb: 'squeak', target: 'magpie' }, why: '까치에 삑: 까치가 내려옴' },
  { id: 'jjuk-move-seesaw_left', action: { char: 'jjuk', verb: 'move', target: 'seesaw_left' }, why: '시소 왼쪽 끝 올라서기: 바닥 점까지 걷고 깡충(#397 1-5-2절)' },
  // 쭉이·삑삑이 × 양쪽 끝(#397 완료 조건 3): 착지 칸에 판이 그 끝으로 기운다(3px, 1-5-4절).
  // 묵직이 올라서기 사례(웅크림·6px·제자리 쿵·들썩)는 뺐다: 특기 자리(ui-interaction 6-4-1c, #723)라 UI로 못 낸다.
  { id: 'jjuk-move-seesaw_right', action: { char: 'jjuk', verb: 'move', target: 'seesaw_right' }, why: '시소 오른쪽 끝 올라서기: 판이 오른쪽으로 3px' },
  { id: 'ppik-move-seesaw_left', action: { char: 'ppik', verb: 'move', target: 'seesaw_left' }, why: '시소 왼쪽 끝 올라서기: 가볍게 통(웅크림 50ms)' },
  { id: 'ppik-move-seesaw_right', action: { char: 'ppik', verb: 'move', target: 'seesaw_right' }, why: '시소 오른쪽 끝 올라서기: 가볍게 통' },
  {
    id: 'seesaw-bounce-launch',
    pre: [{ char: 'jjuk', verb: 'move', target: 'seesaw_left' }],
    action: { char: 'mukjik', verb: 'stomp', target: 'seesaw_right' },
    why: '정답 11번: U6 동안 쭉이 발이 판 칸을 따라 밀려 올라간 뒤 발사(#397, 1-5-4절 2026-11-19 개정)',
  },
  {
    id: 'seesaw-bounce-wrong-way',
    pre: [{ char: 'jjuk', verb: 'move', target: 'seesaw_right' }],
    action: { char: 'mukjik', verb: 'stomp', target: 'seesaw_left' },
    why: '14번: 오른쪽에 탄 쭉이 발이 왼쪽 끝 이벤트 U6 칸을 따른다',
  },
  // #414 묵직이 쿵 = 판 끝에 뛰어올라 쿵(magpie_nest.md 1-6절). `--only seesaw-stomp`로 이것만 찍는다.
  {
    id: 'seesaw-stomp-from-floor',
    pre: [{ char: 'ppik', verb: 'move', target: 'seesaw_left' }],
    action: { char: 'mukjik', verb: 'stomp', target: 'seesaw_right' },
    why: '12번: 바닥 점(290, 240)에서 높이 뛰기(H 32) → 쿵 칸에 U6 → 삑삑이 발사',
  },
  {
    id: 'seesaw-stomp-wrong-way',
    pre: [{ char: 'jjuk', verb: 'move', target: 'seesaw_right' }],
    action: { char: 'mukjik', verb: 'stomp', target: 'seesaw_left' },
    why: '14번: 왼쪽 끝에 뛰어올라 쿵 → 오른쪽 쭉이가 빨랫줄로',
  },
  {
    id: 'seesaw-stomp-self-smack-right',
    action: { char: 'mukjik', verb: 'stomp', target: 'seesaw_right' },
    why: '15번(1-6-5절): 빈 판에 쿵 → 빈 왼쪽만 휙 → U6 끝에 판이 묵직이를 (302, 244)로 튕겨 냄 → 납작',
  },
  {
    id: 'seesaw-stomp-self-smack-left',
    action: { char: 'mukjik', verb: 'stomp', target: 'seesaw_left' },
    why: '15번 거울: 왼쪽 끝 → (238, 244)로 튕겨 냄',
  },
  // #664 3번: 고리에 매달린 쭉이가 까치 있는 둥지를 누르면 쪼이고 게이지 −1. 이유(쪼기)가 그림으로 읽히는지 본다.
  {
    id: 'hook-jjuk-pecked',
    pre: [{ char: 'jjuk', verb: 'move', target: 'seesaw_left' }, { char: 'mukjik', verb: 'stomp', target: 'seesaw_right' }],
    action: { char: 'jjuk', verb: 'stretch', target: 'nest' },
    says: 'magpie_nest.hook_pecked',
    why: '#664 3번(다치는 실패 #2): 까치 쪼기 → 쭉이 찌릿 → 바구니로 떨어짐 → 게이지 −1. 쪼는 까치와 「まずカササギやな」가 게이지 깎임과 같은 순간에 읽히나',
  },
  // #419: 꽥은 원거리라 판 끝에서 내려오지 않고 돌아서기만 한다(대상 `approach`의 `squeak: stay`).
  {
    id: 'ppik-squeak-from-seesaw',
    pre: [{ char: 'ppik', verb: 'move', target: 'seesaw_left' }],
    action: { char: 'ppik', verb: 'squeak', target: 'long_johns' },
    why: '#419: 왼쪽 끝 삑삑이가 내복 쪽으로 돌아서서 꽥. 판에서 안 내려오고 기울기 그대로',
  },
];

export default CASES;
