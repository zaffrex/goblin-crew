// R1 반응 예산을 새 칸 수로 센다 (ADR-0422, ADR-0018 5절 R1 상한 대체, #422).
// 그림 JSON을 읽는 검사라 코어(`src/core/puzzle/`) 밖에 둔다(ADR-0065). 하한(이름 4개)은 코어 `uniqueReactions`가 그대로 본다.
//
// 세는 법(ADR-0422 1절):
// - 대상: 화면 데이터(`rules`·`fallbacks`·`onEnter`·`spots`)가 부르는 `anim` 중 `common.*` 아닌 것.
// - 칸: 캐릭터면 `public/sprites/<캐릭터>-base.json`의 `anims[이름].frames`. `@자리`·`self`면 진짜 `step`이 그 연출을
//   실제로 준 캐릭터(없으면 그 이름을 가진 모든 캐릭터). 물건·NPC면 `public/scenes/<화면>-objects.json`의
//   `anims["<대상>.<이름>"]`과 n번째 변형 `anims["<대상>.<이름>#k"]`(#765)의 `frames` + 모든 `variants[].frames`.
// - 빼는 칸(기본 칸): 캐릭터 `idle`·`walk`·`step_up`·`hold`·`common.*`, 물건 `default`·`states[]`의 `frame`과 `loop.frames`,
//   `tilt.frames` 값, `overlay.frame`.
// - 시트별 칸 번호의 합집합. `reuse`(앞 칸 다시 잇기)·효과 anim(칸 없음)은 저절로 0칸이다.
// 분류 검사(3절): 물건 시트의 모든 칸은 기본 칸이나 반응 칸이어야 한다. 아니면 **실패**다. 빼는 칸 목록은 시트 형식에
// 묶인 손 목록이라, 시트에 새 키가 생겨 목록이 틀리면 여기서 드러난다. 실패하면 같은 PR에서 위 목록을 고친다.

import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { SceneArtMeta } from '../../src/core/sceneArt';
import type { SpriteMeta } from '../../src/core/sprite';
import type { CharactersData, ScreenData } from '../../src/core/puzzle/types';
import { eachStep } from './each-step';

const ROOT = join(import.meta.dirname, '..', '..');
const load = (...p: string[]): unknown => JSON.parse(readFileSync(join(ROOT, ...p), 'utf8'));
const characters = load('content', 'characters.json') as CharactersData;

/** R1' 상한(ADR-0422 2절): 12개 × 4프레임. 넘으면 경고(실패 아님). PR에 이유를 적고 머지할 수 있다. */
const R1_CELL_CAP = 48;

/**
 * 화면별 장부: 새 칸 N, 기본 칸 K. 그림·화면 데이터가 바뀌어 숫자가 달라지면 그 PR이 이 줄을 고친다.
 * 리뷰어가 diff에서 "이 PR이 반응 그림 몇 칸을 늘렸나"를 바로 읽게 하려는 것이다. 48을 넘는 건 막지 않는다(경고).
 */
const LEDGER: Record<string, { cells: number; base: number }> = {
  // 쭉 7(launch_to_hook 4 + reach_hang_up 3), 삑 8(launch_to_hook 4 + hide_in_basket 4), 묵직 0(seesaw_stomp는 reuse), 물건 35.
  // 50 > 48 경고: U10 클리어 반전 컷 magpie.twist 4칸(#763). 설계 7절 계획 34칸에 들어 있던 칸이고, 날기·바닥 자세 7칸은 재사용(0칸).
  magpie_nest: { cells: 50, base: 17 },
  // 물건 41(효과 water_off·water_burst 0칸, guest.soaked는 상태 칸 11이라 0칸), 쭉 4(take_up 3 + take_off 1), 묵직 3(sit_corner).
  // S2(#802, PR #815 그림 + 화면 JSON): 54 > 48 경고. 비둘기가 돌우산까지 165px를 나는 길(R3 칸당 ≤ 21px) 때문이다.
  // 손 그림 칸은 0(있는 비둘기 모양을 자리만 바꿔 찍음). 물건 −7 옛 pigeons_up + 12 perch 칸, 기본 +1 꼭대기 멈춘 모습(Luna 계산 53/13),
  // 그리고 재킷 대기 움찔 loop를 빼서(설계 6절) 움찔 칸이 기본 칸 → 반응 칸(jacket.slide 첫 칸)으로 옮겼다(+1/−1).
  // 동상 미끼(#802 PR #827): 기본 +1 동상 멈춘 모습(배경 동상과 같은 그림 + 외곽선, 새로 그린 칸 0). 시트에 없으면 임시 상자가 덮는다.
  park_fountain: { cells: 54, base: 13 },
  // 시트 1/2(#764): 삑 hide_in_basket 4(화면 1 U9 재사용) + 물건 29. 물건은 손그림 칸(틈 속 머리 2, 내려다보기 1, 부리에 문 열쇠 1, 혹 3)과
  // 재사용·자리 옮김 칸(창 안 날기 4, 뒤집기 1, 부르르·털썩·웅크림, nudge 잘린 열쇠 2, 혹 자리 복사, 둥지 반짝, 클리어 둥지가 후드 속으로 쏙 2)이다. 기본 15(멈춘 모습·대기 반복).
  // 시트 2/2-a(건조기): 반응 +11 = burst 5(열린 문 1장 + 양말·병뚜껑 자리) + burst#2 1 + door_bang 1(열린 문만) + sock_head 4(머리 위 양말 비행 3 + 얹힘 1).
  //   손그림은 열린 문·양말·병뚜껑 3장이고 나머지는 자리 옮김·뒤집기다. 기본 +2 = 드럼 회전 칸 0°·40°·80° 중 멈춘 그림을 대신한 0° 말고 둘.
  // 시트 2/2-b(머리 위 물건): 반응 +10 = feather_puff 2 + feather_head 2(새로 그린 건 꽂힌 깃털 1장, 나머지는 같은 깃털 자리 옮김)
  //   + nest_hat 3(열쇠 든 둥지 O2 재사용, 16 → 8 → 0px 자리만) + hat_perch 3(창 안 날기·puff·smug 재사용). 손그림 1칸.
  //   54 > 48 경고: anchor 칸은 제자리 칸과 픽셀이 같아도 안 합쳐진다(형식 16절). 이 넘침 10칸 중 9칸이 그 재사용이다.
  // 시트 2/2-c1(정답 길): 반응 +6 = gap.glint 2(작은 별·큰 별, 둥지 반짝 별 재사용, 마지막 칸은 멈춘 모습과 합쳐짐)
  //   + shutter.roll_up 4(잠김·올라감 그림을 섞어 판을 21px씩 올린 칸, 마지막 칸은 key.back 멈춘 모습과 합쳐짐). 손그림 0칸.
  //   60 > 48: 2/2-b·2/2-c1이 더한 16칸 중 손그림은 1칸(꽂힌 깃털)이고 나머지는 anchor 재사용·자리 옮김·섞은 칸이다. 2/2-c2(덕트 바람·막대·자판기)가 더 붙인다.
  laundromat: { cells: 60, base: 17 },
};

/** 캐릭터 시트에서 반응 비용이 아닌 anim(가만히·걷기·올라서기·들기·공용). */
const CHAR_BASE = new Set(['idle', 'walk', 'step_up', 'hold']);
const isCharBase = (name: string): boolean => CHAR_BASE.has(name) || name.startsWith('common.');

type AnimRef = [target: string, name: string];

/** 화면 데이터가 부르는 `common.*` 아닌 `anim` 참조. `uniqueReactions`(코어)와 같은 자리를 본다. */
function animRefs(screen: ScreenData): AnimRef[] {
  const out = new Map<string, AnimRef>();
  const walk = (v: unknown): void => {
    if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') {
      const a = (v as Record<string, unknown>).anim;
      if (Array.isArray(a) && typeof a[0] === 'string' && typeof a[1] === 'string' && !a[1].startsWith('common.'))
        out.set(`${a[0]}\0${a[1]}`, [a[0], a[1]]);
      Object.values(v).forEach(walk);
    }
  };
  walk([screen.rules, screen.fallbacks, screen.onEnter, screen.spots]);
  return [...out.values()];
}

/** 진짜 `step`이 캐릭터에게 준 `common.*` 아닌 연출: 이름 → 캐릭터들. `@자리`·`self`를 풀 때 쓴다. */
function playedBy(screen: ScreenData, chars: CharactersData): Map<string, Set<string>> {
  const who = new Set(Object.keys(screen.start.at));
  const out = new Map<string, Set<string>>();
  eachStep(screen, chars, (_s, _a, r) => {
    for (const e of r.events) {
      if (e.type !== 'anim' || !who.has(e.target) || e.name.startsWith('common.')) continue;
      if (!out.has(e.name)) out.set(e.name, new Set());
      out.get(e.name)!.add(e.target);
    }
  });
  return out;
}

interface R1Input {
  screen: ScreenData;
  objects: SceneArtMeta | null;
  sheets: Record<string, SpriteMeta>;
  /** `@자리`·`self` 연출 이름 → 그 연출을 실제로 받은 캐릭터. */
  played: Map<string, Set<string>>;
}

interface R1Result {
  /** 새 칸 N(모든 시트 합). */
  cells: number;
  /** 시트별 새 칸: 캐릭터 이름 또는 `objects`. */
  bySheet: Record<string, number>;
  /** 물건 시트 기본 칸 K. */
  base: number;
  /** `common.*` 아닌 이름 수 M(하한 판정은 코어 `uniqueReactions`). */
  names: number;
  /** 물건 시트에서 기본 칸도 반응 칸도 아닌 칸 번호. 비어 있어야 한다. */
  unclassified: number[];
}

function r1Cells({ screen, objects, sheets, played }: R1Input): R1Result {
  const refs = animRefs(screen);
  const charCells = new Map<string, Set<number>>();
  const objCells = new Set<number>();
  const addChar = (char: string, name: string): void => {
    const sheet = sheets[char];
    const anim = sheet?.anims[name];
    if (!anim || isCharBase(name)) return;
    if (!charCells.has(char)) charCells.set(char, new Set());
    for (const f of anim.frames) charCells.get(char)!.add(f);
  };
  for (const [target, name] of refs) {
    if (target in sheets || target in screen.start.at) addChar(target, name);
    else if (target.startsWith('@') || target === 'self') {
      const who = played.get(name) ?? new Set(Object.keys(sheets).filter((c) => sheets[c]!.anims[name]));
      for (const c of who) addChar(c, name);
    } else {
      // n번째 변형(`이름#k`, #765)도 같은 줄이 부른다. 두 번째부터 나오는 짧은 판(`burst#2`)의 칸도 반응 칸이다.
      const key = `${target}.${name}`;
      for (const [k, anim] of Object.entries(objects?.anims ?? {})) {
        if (k !== key && !k.startsWith(`${key}#`)) continue;
        for (const f of anim.frames) objCells.add(f);
        for (const v of anim.variants ?? []) for (const f of v.frames) objCells.add(f);
      }
    }
  }
  // 캐릭터 기본 칸은 시트 안에서 뺀다(같은 칸 번호를 기본 anim이 쓰면 반응 비용이 아니다. seesaw_stomp 16 = step_up).
  for (const [char, set] of charCells) {
    for (const [name, a] of Object.entries(sheets[char]!.anims)) if (isCharBase(name)) for (const f of a.frames) set.delete(f);
  }
  const objBase = new Set<number>();
  for (const o of objects?.objects ?? []) {
    if (o.effect !== undefined) continue;
    const pics = [o.default, ...(o.states ?? [])];
    for (const p of pics) {
      if (p.frame !== null) objBase.add(p.frame);
      for (const f of p.loop?.frames ?? []) objBase.add(f);
    }
    for (const f of Object.values(o.tilt?.frames ?? {})) objBase.add(f);
    if (o.overlay) objBase.add(o.overlay.frame);
  }
  for (const f of objBase) objCells.delete(f);
  const bySheet: Record<string, number> = {};
  for (const [char, set] of [...charCells].sort(([a], [b]) => a.localeCompare(b))) bySheet[char] = set.size;
  bySheet.objects = objCells.size;
  const total = objects?.frames.length ?? 0;
  const unclassified: number[] = [];
  for (let i = 0; i < total; i++) if (!objBase.has(i) && !objCells.has(i)) unclassified.push(i);
  return {
    cells: Object.values(bySheet).reduce((a, b) => a + b, 0),
    bySheet,
    base: objBase.size,
    names: new Set(refs.map(([, n]) => n)).size,
    unclassified,
  };
}

const sheets: Record<string, SpriteMeta> = Object.fromEntries(
  readdirSync(join(ROOT, 'public', 'sprites'))
    .filter((f) => f.endsWith('-base.json'))
    .map((f) => [f.replace(/-base\.json$/, ''), load('public', 'sprites', f) as SpriteMeta]),
);

const objectsOf = (id: string): SceneArtMeta | null => {
  const p = join(ROOT, 'public', 'scenes', `${id}-objects.json`);
  return existsSync(p) ? (JSON.parse(readFileSync(p, 'utf8')) as SceneArtMeta) : null;
};

const screens = readdirSync(join(ROOT, 'content', 'screens'))
  .filter((f) => f.endsWith('.json') && f !== 'order.json')
  .map((f) => load('content', 'screens', f) as ScreenData);

const inputOf = (screen: ScreenData): R1Input => ({
  screen,
  objects: objectsOf(screen.id),
  sheets,
  played: playedBy(screen, characters),
});

describe('R1 새 칸 예산 (ADR-0422)', () => {
  it.each(screens.map((s) => [s.id, s] as const))('%s: 장부와 같고 분류 안 된 칸이 없다', (id, screen) => {
    const r = r1Cells(inputOf(screen));
    const parts = Object.entries(r.bySheet).map(([k, v]) => `${k} ${v}`).join(', ');
    console.info(`[${id}] R1 새 칸 ${r.cells}/${R1_CELL_CAP}, 이름 ${r.names}, 기본 칸 ${r.base} (${parts})`);
    if (r.cells > R1_CELL_CAP) console.warn(`[${id}] 경고: R1 새 칸 ${r.cells} > ${R1_CELL_CAP}. PR에 이유를 적어 주세요(ADR-0422 2절)`);
    // 분류 안 된 칸: 시트에 새 키가 생겼거나, 화면 데이터가 안 부르는 물건 anim이 있다(코드가 직접 부르는 anim 포함).
    expect(r.unclassified, `${id}: 물건 시트에서 기본 칸도 반응 칸도 아닌 칸`).toEqual([]);
    expect({ cells: r.cells, base: r.base }, `LEDGER['${id}']를 이 숫자로 맞춰 주세요`).toEqual(LEDGER[id]);
  });

  it('LEDGER에 없는 화면 이름이 없다', () => {
    const ids = new Set(screens.map((s) => s.id));
    for (const id of Object.keys(LEDGER)) expect(ids.has(id), id).toBe(true);
  });

  const nest = screens.find((s) => s.id === 'magpie_nest')!;

  it('시트별로 ADR-0422 손 계산과 같다 (magpie_nest)', () => {
    // `@seesaw_left` launch_to_hook은 쭉·삑 둘 다 받는다. 묵직이 seesaw_stomp는 step_up·common.stomp 칸을 다시 이어 0칸.
    expect(r1Cells(inputOf(nest)).bySheet).toEqual({ jjuk: 7, mukjik: 0, ppik: 8, objects: 35 });
  });

  it('물건 anim의 variants 칸을 센다', () => {
    const objects = structuredClone(objectsOf('magpie_nest')!);
    for (const a of Object.values(objects.anims)) delete a.variants;
    const r = r1Cells({ ...inputOf(nest), objects });
    // 땅 위 까치 peck 3칸 + ruffle 3칸이 빠지고, 그 칸은 분류 안 된 칸이 된다.
    expect(r.bySheet.objects).toBe(35 - 6);
    expect(r.unclassified).toEqual([32, 33, 34, 38, 39, 40]);
  });

  it('기울기·앞면 칸은 기본 칸이다', () => {
    const objects = structuredClone(objectsOf('magpie_nest')!);
    const seesaw = objects.objects.find((o) => o.key === 'seesaw')!;
    const basket = objects.objects.find((o) => o.key === 'basket')!;
    delete seesaw.tilt;
    delete basket.overlay;
    const r = r1Cells({ ...inputOf(nest), objects });
    // 13·14는 plank_bounce 첫 칸이라 반응으로 넘어가고(+2), 16은 아무 데도 안 잡힌다.
    expect(r.base).toBe(17 - 3);
    expect(r.bySheet.objects).toBe(35 + 2);
    expect(r.unclassified).toEqual([16]);
  });

  it('화면 데이터가 안 부르는 물건 anim이 있으면 분류 검사가 잡는다', () => {
    // 화면 데이터의 `long_johns.flutter`를 시트에 없는 이름으로 바꾸면, 시트의 flutter 칸 49~51을 아무도 안 부른다.
    const screen = JSON.parse(JSON.stringify(nest).replaceAll('"long_johns","flutter"', '"long_johns","flutter_gone"')) as ScreenData;
    expect(animRefs(screen).some(([t, n]) => t === 'long_johns' && n === 'flutter_gone')).toBe(true);
    const r = r1Cells({ ...inputOf(nest), screen });
    expect(r.unclassified).toEqual([49, 50, 51]);
  });

  it('`@자리` 연출을 아무도 안 받으면 그 이름을 가진 캐릭터 모두로 센다', () => {
    const r = r1Cells({ ...inputOf(nest), played: new Map() });
    // launch_to_hook은 쭉·삑 시트에만 있다. 묵직이 시트에는 없어 0칸 그대로다.
    expect(r.bySheet).toEqual({ jjuk: 7, mukjik: 0, ppik: 8, objects: 35 });
  });
});
