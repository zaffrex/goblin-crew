// 런타임 에셋 경로는 이 함수로만 만든다. '/assets/...' 같은 절대경로는
// 하위 경로 배포(GitHub Pages, PR 프리뷰)에서 404가 난다 (ADR-0004 결정 8).
export function assetUrl(path: string): string {
  return `${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`;
}
