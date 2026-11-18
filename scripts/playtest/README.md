# scripts/playtest — M1 실입력 재생 도구 (#101)

M1 판정 1(`docs/team/m1-acceptance.md`)용. 배포 URL을 headless Chrome에서 열고 Chrome DevTools Protocol로 **실제 마우스 클릭·터치 탭**을 보낸다. 게임 함수를 불러 게임을 움직이지 않는다. `Runtime.evaluate`는 관찰(캔버스 위치, DOM 상태, 포인터 기록)에만 쓴다.

의존성 없음: Node 22의 타입 제거 실행과 내장 `WebSocket`을 쓴다. Chrome은 `CHROME_PATH` 또는 기본 경로에서 찾는다.

```bash
node scripts/playtest/smoke.ts                          # 배포본 (기본 URL)
node scripts/playtest/smoke.ts --url http://localhost:4173/ --out /tmp/pt
node scripts/playtest/smoke.ts --no-sandbox             # 컨테이너 등 샌드박스가 안 될 때
```

판정 1 재생(2부-b, A1·A2·A3·A4·A6②):

```bash
node --import ./scripts/playtest/register.mjs scripts/playtest/replay.ts --url https://zaffrex.github.io/goblin-crew/
npm run build && npx vite preview --port 4173 &   # 로컬 빌드로 먼저 볼 때
node --import ./scripts/playtest/register.mjs scripts/playtest/replay.ts --url http://localhost:4173/ --out /tmp/pt --no-sandbox
```

`register.mjs`는 `src/`의 확장자 없는 import(`./hit`)를 `.ts`로 풀어 주는 resolve 훅이다(의존성 없음, Node 22.15+). 스크린샷의 한글이 네모로 나오면 CJK 글꼴을 깐다(`sudo apt-get install fonts-noto-cjk`). 보고서에는 말풍선 DOM 글자를 따로 적으므로 글꼴이 없어도 판정은 된다.

`--no-sandbox`는 신뢰하는 URL(우리 배포본, 로컬 빌드)에만 쓴다. `--url`로 아무 주소나 열 수 있으니 외부 사이트에는 쓰지 않는다.

**시작 카드(#285)**: 게임을 열면 카드가 떠 있고 그동안 장면이 멈춘다. 세 도구 모두 `card.ts` `closeStartCard`로 잠금(1.0초, `#card[data-ready]`)이 풀리길 기다렸다가 화면 가운데를 한 번 눌러 닫는다. 카드가 없는 빌드면 누르지 않는다(그 탭은 바닥 걷기라 결과가 바뀐다).

결과: `<out>/report.md`, `report.json`, 뷰포트별 PNG. A4 콘솔 에러나 입력 경로 실패면 종료 코드 1, A5·A6는 경고만.

**A7 임시 그림(#142, 판정 2 시작 조건)**: 재생 내내 엔진이 실제 그림 대신 임시 그림으로 그린 것을 `?playtest=1` 훅 `window.__gcFallbacks()`로 모아 `report.md`에 표로 적는다. 이름은 `bg`(임시 방, 배경 draft), `box:<대상 ID>`(물건 시트가 안 그리는 임시 상자), `char:<캐릭터>:<자세>`(실루엣, 시트에 그 자세가 없음). 그림이 읽히는 중인 프레임은 세지 않는다. 기본은 경고만이고, 판정 2 요청 전에는 `--require-art`로 돌려 하나라도 있으면 종료 코드 1을 받는다.

- 한계: **재생이 지나간 자세만** 센다(정답 + A2·A3 오답). 사람이 아무 데나 눌러서 나오는 자세(예: 다른 캐릭터의 기본 실패 반응)는 안 잡힌다. 화면 1 전체 자세 목록은 `magpie_nest.json`의 `anim`에서 따로 뽑는다(#142 하위 작업).
- 로드 실패(404)는 "읽히는 중"으로 남아 A7에 안 잡힌다. 그건 A4 콘솔 에러가 잡는다.

| 파일 | 내용 |
|---|---|
| `coords.ts` | 화면 JSON 대상(핫스팟 `variants`, 서는 자리 `box`) → 내부 좌표 → CSS px. 게임 입력과 같은 `viewport.ts` 변환을 쓴다 |
| `cdp.ts` | Chrome 실행, CDP 세션, 클릭·탭·스크린샷·콘솔 에러 수집 |
| `plan.ts` | 2부-a: 정답 행동 `{char, verb, target}` → 누를 곳(캐릭터 칸, 동사 무장, 대상, 터치 2번). `docs/design/ui-interaction.md` 2·3·4·10절. 입력은 `?playtest=1` 읽기 전용 훅 `window.__gcLayout()`(#68). HUD id는 `hud.ts` `HudId`(`char.jjuk`, `verb.ability`, `item.0`). 테스트는 고른 탭을 실제 `interact.ts` `tap()`에 넣어 확인한다 |
| `scenarios.ts` | 2부-b: 판정 시나리오(A1 정답, A2 규칙 2·7 두 번씩, A3 게이지 0 → 리셋 → 클리어, A6② 8px/9px 탭)와 행동별 확인 함수. `scenarios.test.ts`가 같은 시나리오를 실제 `scene.ts`에 넣어 Chrome 없이 먼저 확인한다 |
| `replay.ts` | 2부-b: `?playtest=1`로 열어 시나리오를 실제 클릭·탭으로 재생. 행동마다 `busy`가 거짓이 될 때까지 기다리고, 새 말풍선이 뜰 때마다 스크린샷. `report.md`에 판정 표(A1~A4, A6②)와 행동별 말풍선 글·게이지 |
| `smoke.ts` | 1부: 데스크톱 1280×720(마우스, dpr 1), 모바일 844×390(터치, dpr 3), 작은 폰 667×375(터치, dpr 2), 세로 390×844(스크린샷). 가로 화면마다 시작 카드가 스크롤 없이 다 보이는지 검사(#335) |
| `frames.ts` | 특기 연출 프레임(#284, 판정 2 시작 조건 8번): 처음 상태에서 세 사람 특기를 대상 7개에 실제 클릭으로 쓰고, 마지막 탭부터 120ms마다 찍어 사례별 모음 PNG를 만든다. 자동 판정 없음, 사람이 본다. `--mobile`이면 휴대폰 가로 |

재생은 말풍선 넘기기를 쓰지 않는다(ui-interaction 5절). 그래서 "걷는 중 누른 탭이 씹힌다" 같은 문제는 판정 1에서 안 보이고 판정 2(사람)에서 본다. A5(첫 화면)·A6①(세로 안내)은 `smoke.ts`가 본다.
