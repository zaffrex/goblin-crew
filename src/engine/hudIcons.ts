// HUD 아이콘 시트 (#255 그림, #390 처음부터 버튼에서 처음 씀). 원본은 art/ui/hud-icons.mjs, `node art/build.mjs`가 만든다.
// 메타 JSON은 번들에 넣고, 이미지는 assetUrl()로만 읽는다(ADR-0004 결정 8, fxText.ts와 같은 방식).
// DOM 버튼 안의 `<span>`에 시트를 배경으로 깔고 칸 하나만 보이게 한다. 칸 20×20, 버튼 28×28 가운데(4px 여백).

import raw from '../../public/ui/hud-icons.json';
import type { Loaded } from '../core/fallbacks';
import { assetUrl } from './assets';

interface IconMeta {
  image: string;
  cell: number[];
  icons: Record<string, number>;
}

const META = raw as IconMeta;
const COUNT = Object.keys(META.icons).length;
const SHEET_URL = assetUrl(`ui/${META.image}`);

let state: Loaded = 'loading';
const image = new Image();
image.onload = () => {
  state = 'ready';
};
// 404·끊김이면 기다리지 않는다(로딩 화면이 상한까지 갇히지 않게). 버튼은 빈 칸 + aria-label·호버 글로 남는다.
image.onerror = () => {
  state = 'none';
};
image.src = SHEET_URL;

/** 시트 상태(로딩 화면이 기다린다). */
export function hudIconState(): Loaded {
  return state;
}

/**
 * `el`(아이콘 칸 `<span>`)에 아이콘 `id`를 화면 배율 `scale`로 그린다. 같은 아이콘·배율이면 스타일을 안 건드린다.
 * 시트에 없는 id면 false(호출하는 쪽이 글자로 둔다).
 */
export function paintHudIcon(el: HTMLElement, id: string, scale: number): boolean {
  const i = META.icons[id];
  if (i === undefined) return false;
  // 브라우저가 style 값을 정규화해서(url 따옴표 등) 되읽어 비교하면 늘 달라진다. 그래서 그린 값을 따로 적어 둔다.
  const key = `${id}|${scale}`;
  if (el.dataset.icon === key) return true;
  el.dataset.icon = key;
  const [cw = 20, ch = 20] = META.cell;
  el.style.backgroundImage = `url("${SHEET_URL}")`;
  el.style.width = `${cw * scale}px`;
  el.style.height = `${ch * scale}px`;
  el.style.backgroundSize = `${cw * COUNT * scale}px ${ch * scale}px`;
  el.style.backgroundPosition = `${-cw * i * scale}px 0px`;
  return true;
}
