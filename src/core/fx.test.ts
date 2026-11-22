import { describe, expect, it } from 'vitest';
import screenJson from '../../content/screens/magpie_nest.json';
import parkJson from '../../content/screens/park_fountain.json';
import { CHARACTERS } from './characters';
import { DUST_TICKS, dustPush, FX_STYLE, FX_TICKS, fxTicks, missingSignatures, SHAKE_TICKS, shakeOffset, SIGNATURE_TICKS, SIGNATURES } from './fx';
import type { RuleShowItem, ShowItem } from './puzzle/types';

/** 화면 데이터 안의 show 배열을 전부 모은다(규칙, 폴백 반응, 진입 연출, 손 놓기·자리 참 연출). 경로와 같이. */
// 표시 `{ do: "here" }`가 섞인 규칙 show도 모은다. 안 그러면 표시를 넣은 순간 그 show가 검사에서 조용히 빠진다.
function allShows(o: unknown, path = ''): [string, RuleShowItem[]][] {
  const isShow = (v: unknown): v is RuleShowItem[] =>
    Array.isArray(v) &&
    v.length > 0 &&
    v.every((x) => typeof x === 'object' && x !== null && ('anim' in x || 'say' in x || 'fx' in x || 'do' in x)) &&
    v.some((x) => !('do' in x));
  if (isShow(o)) return [[path, o]];
  if (Array.isArray(o)) return o.flatMap((v, i) => allShows(v, `${path}/${i}`));
  if (typeof o === 'object' && o !== null) return Object.entries(o).flatMap(([k, v]) => allShows(v, `${path}/${k}`));
  return [];
}

describe('특기 시그니처 (ability-feedback.md 2·5절, #284)', () => {
  it('캐릭터마다 시그니처가 하나 있고, fx 이름이 겹치지 않고, 글자 모양 표에 있다', () => {
    expect(Object.keys(SIGNATURES).sort()).toEqual(CHARACTERS.map((c) => c.id).sort());
    const fx = Object.values(SIGNATURES).map((s) => s.fx);
    expect(new Set(fx).size).toBe(fx.length);
    for (const f of fx) expect(FX_STYLE[f]).toBeDefined();
  });

  it('F-e: 시그니처 글자는 그 캐릭터 대표색이다(쭉이 빨강, 묵직이 청록, 삑삑이 노랑). 쿵 글자만 10px', () => {
    expect(FX_STYLE[SIGNATURES.jjuk.fx]).toEqual({ color: 'redL', height: 8 });
    expect(FX_STYLE[SIGNATURES.mukjik.fx]).toEqual({ color: 'tealM', height: 10 });
    expect(FX_STYLE[SIGNATURES.ppik.fx]).toEqual({ color: 'yelL', height: 8 });
  });

  it('화면 1의 모든 show에서 특기 연출 바로 다음은 그 캐릭터의 시그니처 fx다', () => {
    const shows = allShows(screenJson);
    expect(shows.length).toBeGreaterThan(30);
    const bad = shows.flatMap(([path, show]) => missingSignatures(show).map((i) => `${path}[${i}]`));
    expect(bad).toEqual([]);
  });

  it('화면 2(park_fountain)의 모든 show에서도 특기 연출 바로 다음은 시그니처 fx다 (#466)', () => {
    const shows = allShows(parkJson);
    expect(shows.length).toBeGreaterThan(20);
    const bad = shows.flatMap(([path, show]) => missingSignatures(show).map((i) => `${path}[${i}]`));
    expect(bad).toEqual([]);
  });

  it('검사는 빠진 곳·다른 fx가 온 곳을 잡고, 특기가 아닌 연출(찌릿·떨기)은 보지 않는다', () => {
    const stomp: ShowItem = { anim: ['mukjik', 'common.stomp'] };
    expect(missingSignatures([stomp, { say: ['mukjik', 'x'] }])).toEqual([0]);
    expect(missingSignatures([{ say: ['mukjik', 'x'] }, stomp])).toEqual([1]);
    expect(missingSignatures([stomp, { fx: ['dust', 'mukjik'] }])).toEqual([0]);
    expect(missingSignatures([stomp, { fx: ['stomp_text', 'mukjik'] }])).toEqual([]);
    expect(missingSignatures([{ anim: ['jjuk', 'common.zap'] }, { say: ['jjuk', 'x'] }])).toEqual([]);
    expect(missingSignatures([{ anim: ['ppik', 'common.shiver'] }])).toEqual([]);
    // 다른 캐릭터의 특기 이름이라도 그 캐릭터 것이 아니면 보지 않는다.
    expect(missingSignatures([{ anim: ['ppik', 'common.stomp'] }])).toEqual([]);
  });

  it('효과 위치 표시는 줄로 치지 않는다: 특기 연출과 시그니처 사이에 표시가 껴도 통과, 빠지면 잡는다(ADR-0065, PR #245 Ben)', () => {
    const stomp: RuleShowItem = { anim: ['mukjik', 'common.stomp'] };
    const here: RuleShowItem = { do: 'here' };
    expect(missingSignatures([stomp, here, { fx: ['stomp_text', 'mukjik'] }])).toEqual([]);
    expect(missingSignatures([here, stomp, { fx: ['stomp_text', 'mukjik'] }])).toEqual([]);
    expect(missingSignatures([stomp, here, { say: ['mukjik', 'x'] }])).toEqual([0]);
    expect(missingSignatures([stomp, here])).toEqual([0]);
    expect(missingSignatures([here, stomp])).toEqual([1]);
  });

  it('allShows는 표시가 섞인 show도 모은다', () => {
    const shows = allShows({ rules: [{ show: [{ anim: ['mukjik', 'common.stomp'] }, { do: 'here' }, { say: ['mukjik', 'x'] }] }] });
    expect(shows.map(([p]) => p)).toEqual(['/rules/0/show']);
    expect(missingSignatures(shows[0]![1])).toEqual([0]);
  });

  it('둥지에 삑처럼 시그니처를 대상 위에 띄우는 예외는 통과한다(fx 이름만 본다, PR #289)', () => {
    expect(missingSignatures([{ anim: ['ppik', 'common.squeeze_chicken'] }, { fx: ['squeak_text', 'nest'] }])).toEqual([]);
  });

  it('F-d: 쭉이 내복 반응은 이제 장대를 뻗고 나서 내복이 날아온다(장대가 실제로 펴지는 reach_wobble, #587 C2)', () => {
    const show = (screenJson as unknown as { fallbacks: Record<string, Record<string, { show: ShowItem[] }>> }).fallbacks.long_johns!.stretch!.show;
    expect(show.slice(0, 3)).toEqual([{ anim: ['jjuk', 'common.reach_wobble'] }, { fx: ['stretch_text', 'jjuk'] }, { anim: ['long_johns', 'flutter'] }]);
  });
});

describe('fx 길이', () => {
  it('시그니처는 0.6초(36틱), 다른 fx는 30틱', () => {
    for (const s of Object.values(SIGNATURES)) expect(fxTicks(s.fx)).toBe(SIGNATURE_TICKS);
    expect(SIGNATURE_TICKS).toBe(36);
    expect(fxTicks('ting_text')).toBe(FX_TICKS);
    expect(fxTicks('dust')).toBe(FX_TICKS);
  });
});

describe('쿵 흔들림·먼지 (ability-feedback.md 2-1절)', () => {
  it('3틱마다 +2, −2, +1, −1, 0이고 15틱 뒤 멈춘다', () => {
    const ys = Array.from({ length: 18 }, (_, t) => shakeOffset('stomp_text', t));
    expect(ys).toEqual([2, 2, 2, -2, -2, -2, 1, 1, 1, -1, -1, -1, 0, 0, 0, 0, 0, 0]);
    expect(SHAKE_TICKS).toBe(15);
  });

  it('쿵 말고 다른 fx는 흔들지 않는다', () => {
    for (const f of ['squeak_text', 'stretch_text', 'shake', 'dust', 'clang_text']) {
      for (let t = 0; t < 20; t++) expect(shakeOffset(f, t)).toBe(0);
    }
  });

  it('먼지는 12틱 동안 0 → 6px 바깥으로 밀리고 그 뒤 사라진다', () => {
    expect(dustPush(0)).toBe(0);
    expect(dustPush(DUST_TICKS - 1)).toBe(6);
    expect(dustPush(DUST_TICKS)).toBeNull();
    expect(dustPush(-1)).toBeNull();
    const pushes = Array.from({ length: DUST_TICKS }, (_, t) => dustPush(t)!);
    expect(pushes.every((p, i) => i === 0 || p >= pushes[i - 1]!)).toBe(true);
  });
});

/** show 안 fx 이름을 전부 모은다(경로와 같이). */
function fxNames(o: unknown): [string, string][] {
  return allShows(o).flatMap(([path, show]) =>
    show.flatMap((x, i) => ('fx' in x && Array.isArray(x.fx) && typeof x.fx[0] === 'string' ? [[`${path}[${i}]`, x.fx[0]] as [string, string]] : [])),
  );
}

describe('소리 글자 fx 이름 (#451 리뷰 → #466)', () => {
  // 화면 JSON에 `poof_txt`처럼 오타가 들어가면 화면에서는 기본색 임시 별로 조용히 바뀐다. `_text`로 끝나는 fx는 소리 글자라 표에 있어야 한다.
  // 물건 그림 fx(`shake`·`splash` 등, P1 #286)는 `_text`로 끝나지 않아 보지 않는다.
  it.each([
    ['magpie_nest', screenJson],
    ['park_fountain', parkJson],
  ])('%s: `_text` fx는 전부 FX_STYLE에 있다', (_id, json) => {
    const names = fxNames(json);
    expect(names.length).toBeGreaterThan(5);
    const bad = names.filter(([, n]) => n.endsWith('_text') && !FX_STYLE[n]).map(([p, n]) => `${p}: ${n}`);
    expect(bad).toEqual([]);
  });

  it('검사가 오타를 실제로 잡는다', () => {
    const typo = { rules: [{ show: [{ anim: ['ppik', 'common.squeak'] }, { fx: ['poof_txt', 'ppik'] }] }] };
    expect(fxNames(typo).filter(([, n]) => n.endsWith('_text') || n.endsWith('_txt'))).toEqual([['/rules/0/show[1]', 'poof_txt']]);
    expect(FX_STYLE.poof_txt).toBeUndefined();
  });
});
