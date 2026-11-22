// 말풍선·별·▼ 앵커 높이 검사 (#464). 커밋된 캐릭터 시트 PNG의 실제 픽셀로 `core/sprite.ts` `headTop`을 돌린다.
// - 서 있는 자세(서 있기·걷기·깡충·쿵 등)는 앵커가 예전과 같다(시트 기본 `hit` 위끝). 회귀 방지.
// - 납작 자세(`common.flatten_stay`, `common.flatten` 0·1번)는 앵커가 그 칸의 머리(불투명 위끝)로 내려간다.
// 시트를 다시 그려서 서 있는 자세 위끝이 문턱(LOW_POSE_PX)을 넘게 출렁이면 여기서 걸린다(앵커가 흔들린다는 뜻).

import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { cellTops, headTop, parseSpriteMeta } from '../../src/core/sprite';
import { decodeIndexed } from './png';

const DIR = join(import.meta.dirname, '..', '..', 'public', 'sprites');

/** 서 있는 자세: 앵커가 기본 hit 위끝에서 움직이면 안 된다. 매달린 자세(`hold`·`reach_hang_up`)는 자세 hit 상자가 따로 맡는다. */
const STANDING = ['idle', 'walk', 'step_up', 'common.stomp', 'seesaw_stomp', 'common.zap', 'common.stretch', 'common.reach_wobble', 'common.wet', 'common.shiver', 'common.wag_finger', 'common.squeeze_chicken'];
/** 납작: 이 칸들에서 앵커가 그 칸 머리로 내려가야 한다(#464 완료 조건, #357·#433). */
const FLAT = ['common.flatten_stay'];

const files = readdirSync(DIR).filter((f) => f.endsWith('-base.json'));

describe.each(files)('%s 앵커 높이 (#464)', (file) => {
  const meta = parseSpriteMeta(JSON.parse(readFileSync(join(DIR, file), 'utf8')));
  const png = decodeIndexed(readFileSync(join(DIR, meta.image)));
  const tops = cellTops(png.rgba, png.width, meta.cell, Math.floor(png.width / meta.cell[0]));

  it('서 있는 자세는 모든 칸에서 기본 hit 위끝 그대로', () => {
    for (const name of STANDING) {
      const a = meta.anims[name];
      if (!a) continue;
      for (const f of a.frames) expect(headTop(meta, tops[f] ?? null), `${name} 칸 ${f}`).toEqual({ y: meta.hit[1], low: false });
    }
  });

  it('납작 유지 칸은 앵커가 그 칸의 불투명 위끝(머리)으로 내려간다', () => {
    const flat = FLAT.map((n) => meta.anims[n]).filter((a) => a !== undefined);
    const base = meta.anims['common.flatten'];
    // `flatten_stay`가 없는 시트(묵직이)는 `flatten` 0·1번(엔진이 같은 칸을 쓴다, #433).
    const frames = flat.length > 0 ? flat.flatMap((a) => a.frames) : (base?.frames.slice(0, 2) ?? []);
    expect(frames.length, '납작 칸이 있어야 한다').toBeGreaterThan(0);
    for (const f of frames) {
      const head = headTop(meta, tops[f] ?? null);
      expect(head, `칸 ${f}`).toEqual({ y: tops[f], low: true });
      // 예전 앵커(서 있는 머리)보다 확실히 낮다.
      expect(head.y - meta.hit[1], `칸 ${f}`).toBeGreaterThan(20);
    }
  });
});
