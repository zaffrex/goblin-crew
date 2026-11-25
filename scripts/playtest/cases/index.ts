// 화면별 frames.ts 사례 목록(#466 2부). 화면을 늘리면 `cases/<화면 ID>.ts`를 만들고 여기 한 줄 더한다.
import laundromat from './laundromat.ts';
import magpie_nest from './magpie_nest.ts';
import park_fountain from './park_fountain.ts';
import type { FrameCase } from './types.ts';

export type { FrameCase } from './types.ts';

export const CASES_BY_SCREEN: Readonly<Record<string, readonly FrameCase[]>> = { magpie_nest, park_fountain, laundromat };
