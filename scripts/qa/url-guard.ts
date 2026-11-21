// QA 브라우저가 열 수 있는 URL 검사 (#536). 화면 데이터가 든 번들(/assets/*.js)을 스크린샷으로 보는 길을 막는다.
export function assertPlayableUrl(raw: string): URL {
  const url = new URL(raw);
  const deployed = url.origin === 'https://zaffrex.github.io' && url.pathname === '/goblin-crew/';
  const local = url.hostname === 'localhost' && url.pathname === '/';
  if (!deployed && !local) throw new Error('배포본 첫 페이지(/goblin-crew/, 쿼리만 허용)만 열 수 있어요');
  return url;
}
