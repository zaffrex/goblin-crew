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

화면 정답 풀기(#466): 아무 화면이나 `?screen=<id>`로 열고 화면 JSON의 `solution`을 실제 클릭(`--touch`면 탭)으로 끝까지 누른 뒤 `cleared`를 본다. 클리어 뒤 클리어 카드 글이 `soloCardKey` 규칙(화면 1은 `ui.clear`, 다른 화면은 `<id>.clear_card` 또는 `ui.end`, #597)과 같은지도 본다. 클리어 못 하거나 카드 글이 틀리거나 콘솔 에러가 있으면 종료 코드 1.

```bash
node --import ./scripts/playtest/register.mjs scripts/playtest/solve.ts --screen park_fountain --url http://localhost:4173/ --out /tmp/solve --no-sandbox
```

`register.mjs`는 `src/`의 확장자 없는 import(`./hit`)를 `.ts`로 풀어 주는 resolve 훅이다(의존성 없음, Node 22.15+). 스크린샷의 한글이 네모로 나오면 CJK 글꼴을 깐다(`sudo apt-get install fonts-noto-cjk`). 보고서에는 말풍선 DOM 글자를 따로 적으므로 글꼴이 없어도 판정은 된다. **단 `cover.ts` 가림 비율은 예외다.** 네모 글자는 폭이 달라 말풍선 크기·자리가 바뀌므로 글꼴 없이 잰 숫자는 판정에 쓰지 않는다(리포트 머리 `CJK 글꼴` 줄, #1006).

`--no-sandbox`는 신뢰하는 URL(우리 배포본, 로컬 빌드)에만 쓴다. `--url`로 아무 주소나 열 수 있으니 외부 사이트에는 쓰지 않는다.

**시작 카드(#285)**: 게임을 열면 카드가 떠 있고 그동안 장면이 멈춘다. 세 도구 모두 `card.ts` `closeStartCard`로 잠금(1.0초, `#card[data-ready]`)이 풀리길 기다렸다가 화면 가운데를 한 번 눌러 닫는다. 카드가 없는 빌드면 누르지 않는다(그 탭은 바닥 걷기라 결과가 바뀐다).

**맵 다시 하기(#792 완료 조건 4)**: `solve.ts --deploy --via-map`은 `?playtest=1&title=1`로 연다(이 둘이 같이 있을 때만 훅을 켠 채 타이틀이 뜬다, `core/title.ts` `skipsTitle`). `はじめ` → 첫 판 클리어 → 카드 → 둘째 판 입구까지 간 뒤, 같은 프로필로 다시 열어 `マップ` → 첫 판 카드 → 다시 클리어 → 카드 다음 줄 `ui.map.return`(마우스면 `_click`) → 탭 → 맵(그 카드에 초점)을 실제 클릭·탭으로 탄다. 다시 깨는 동안 세이브 checkpoint·깬 화면이 그대로인지 본다. `--touch`로 휴대폰 가로도 같다.

```bash
node --import ./scripts/playtest/register.mjs scripts/playtest/solve.ts --deploy --via-map [--touch] --url http://localhost:4173/ --out /tmp/via-map --no-sandbox
```

**마지막 판 다시 하기(설계 7절 5번)**: `--via-map-last`는 `はじめ` → 모든 판 클리어 → 끝 카드(`ui.end`)까지 간 뒤 같은 프로필로 다시 열어 `マップ` → 마지막 판 카드(짧은 시작 카드) → 다시 클리어 → 끝 카드 본문 `ui.end` + 다음 줄 `ui.map.return` → 탭 → 맵(타이틀 아님)을 탄다. 세 판을 다 깨서 `--via-map`보다 약 2분 더 걸린다(로컬 2분 32초).

```bash
node --import ./scripts/playtest/register.mjs scripts/playtest/solve.ts --deploy --via-map-last [--touch] --url http://localhost:4173/ --out /tmp/via-map-last --no-sandbox
```

**타이틀(#792, #885)**: 기본 링크(쿼리 없음)에는 카드 앞에 타이틀이 뜬다. `card.ts` `passTitle`이 `#title`의 `はじめ`(`button[data-button="new"]`) 가운데를 실제 클릭/탭으로 누르고, 확인(노랑)이 뜨면 0.5초 뒤 한 번 더 눌러 늘 첫 판 처음부터 간다(세이브가 있으면 지워진다). 그다음 밝아짐 0.3초 동안 숨은 카드가 뜰 때까지 기다린다. `closeStartCard`가 이걸 먼저 부르고, `smoke.ts`는 카드 맞춤 검사 전에 따로 부른다. `?screen=`·`?playtest=1`이면 타이틀이 없어서 아무것도 안 누른다.

결과: `<out>/report.md`, `report.json`, 뷰포트별 PNG. A4 콘솔 에러나 입력 경로 실패면 종료 코드 1, A5·A6는 경고만.

**A7 임시 그림(#142, 판정 2 시작 조건)**: 재생 내내 엔진이 실제 그림 대신 임시 그림으로 그린 것을 `?playtest=1` 훅 `window.__gcFallbacks()`로 모아 `report.md`에 표로 적는다. 이름은 `bg`(임시 방, 배경 draft), `box:<대상 ID>`(물건 시트가 안 그리는 임시 상자), `char:<캐릭터>:<자세>`(실루엣, 시트에 그 자세가 없음). 그림이 읽히는 중인 프레임은 세지 않는다. 기본은 경고만이고, 판정 2 요청 전에는 `--require-art`로 돌려 하나라도 있으면 종료 코드 1을 받는다.

- 한계: **재생이 지나간 자세만** 센다(정답 + A2·A3 오답). 사람이 아무 데나 눌러서 나오는 자세(예: 다른 캐릭터의 기본 실패 반응)는 안 잡힌다. 화면 1 전체 자세 목록은 `magpie_nest.json`의 `anim`에서 따로 뽑는다(#142 하위 작업).
- 로드 실패(404)는 "읽히는 중"으로 남아 A7에 안 잡힌다. 그건 A4 콘솔 에러가 잡는다.

**C-7 말풍선 가림(#356)**: 새 말풍선이 뜰 때마다 `#bubble` DOM 상자를 `__gcLayout().hotspots`(화자 자신은 `#bubble[data-speaker]`로 뺌)와 교차한다. 둥지·까치를 1px이라도 덮으면 그 행동이 ❌, 장난감(바구니·내복)은 ⚠️만. 게임은 위·아래 자리가 물건을 덮으면 화자 옆으로 옮기므로(`core/bubble.ts` `placeBubble`) 정상이면 ❌가 없다. 화자 표시가 없는 옛 빌드는 화자 자신도 세어서 더 엄격하게 나온다.

화면별 사례를 화면 크기 4개(D1·D4·M3·M1, #330)로 돌려 가림만 보려면 `cover.ts`(#598). 사례마다 핫스팟별 최대 가림 비율을 적고, 가장 많이 가린 순간을 찍는다. 다 막혔을 때 게임은 단서 → 다른 사람 몸 → 장난감 순으로 가장 덜 덮는 자리를 고른다(`placeBubble` `coverCost`).

```bash
node --import ./scripts/playtest/register.mjs scripts/playtest/cover.ts --screen park_fountain --url http://localhost:4173/ --no-sandbox --only=aux
```

| 파일 | 내용 |
|---|---|
| `coords.ts` | 화면 JSON 대상(핫스팟 `variants`, 서는 자리 `box`) → 내부 좌표 → CSS px. 게임 입력과 같은 `viewport.ts` 변환을 쓴다 |
| `cdp.ts` | Chrome 실행, CDP 세션, 클릭·탭·스크린샷·콘솔 에러 수집 |
| `plan.ts` | 2부-a: 정답 행동 `{char, verb, target}` → 누를 곳(캐릭터 칸, 동사 무장, 대상, 터치 2번). `docs/design/ui-interaction.md` 2·3·4·10절. 입력은 `?playtest=1` 읽기 전용 훅 `window.__gcLayout()`(#68). HUD id는 `hud.ts` `HudId`(`char.jjuk`, `verb.ability`, `item.0`). 테스트는 고른 탭을 실제 `interact.ts` `tap()`에 넣어 확인한다 |
| `scenarios.ts` | 2부-b: 판정 시나리오(A1 정답, A2 규칙 2·7 두 번씩, A3 게이지 0 → 리셋 → 클리어, A6② 8px/9px 탭)와 행동별 확인 함수. `scenarios.test.ts`가 같은 시나리오를 실제 `scene.ts`에 넣어 Chrome 없이 먼저 확인한다 |
| `replay.ts` | 2부-b: `?playtest=1`로 열어 시나리오를 실제 클릭·탭으로 재생. 행동마다 `busy`가 거짓이 될 때까지 기다리고, 새 말풍선이 뜰 때마다 스크린샷. `report.md`에 판정 표(A1~A4, A6②)와 행동별 말풍선 글·게이지 |
| `smoke.ts` | 1부: 데스크톱 1280×720·1920×1080(마우스, dpr 1), 모바일 844×390(터치, dpr 3), 작은 폰 667×375(터치, dpr 2), 세로 390×844(터치, dpr 3: 세로 안내가 창 전체를 덮고 글이 タップ 쪽인지, #624), 세로 모니터 1080×1920(마우스: 안내가 안 뜨고 그대로 플레이, 9-1절 경계). 가로 화면마다 시작 카드가 스크롤 없이 다 보이는지 검사(#335), 목표 줄이 게임 화면 안·둥지 앞(내부 x 118)에서 끝나는지 검사(#336), 얼굴 이름표끼리 CSS 1px 이상 떨어져 있는지 검사하고 틈을 보고서에 적음(#675). 이름표 폭은 글꼴에 달려서 일본어 글꼴(Noto Sans CJK JP 등)이 깔린 곳에서 돌려야 실측이 된다. 글꼴이 없으면 네모(두부) 글자로 재서 틈이 실제보다 넓게 나온다 |
| `pace.ts` | 느린 PC 게임 시간(#286 4번 (b)): CPU 감속(`Emulation.setCPUThrottlingRate`, 기본 ×1·4·8·16·32)마다 바닥을 실제 클릭해 화면을 가로지르는 걷기를 재서, 벽시계 대비 px/s와 rAF 간격을 `pace.md`에 적는다. 측정 간격을 `consumeFrame`에 넣은 예상값도 같이 적어 원인이 프레임당 틱 상한인지 본다. 자동 판정 없음 |
| `frames.ts` | 특기 연출 프레임(#284, 판정 2 시작 조건 8번): 사례마다 실제 클릭으로 특기를 쓰고, 마지막 탭부터 120ms마다 찍어 사례별 모음 PNG를 만든다. 자동 판정 없음, 사람이 본다. `--mobile`이면 휴대폰 가로. `--screen <id>`(기본 `magpie_nest`)로 화면을 고르고 `?screen=<id>`로 연다. 배포본에 없는 화면은 로컬 빌드 `--url`로. 결과는 `playtest-out/frames/<id>/` |
| `cover.ts` | 말풍선 가림(#598): `cases/<id>.ts` 사례 × 화면 크기 4개, 말풍선이 떠 있는 동안 50ms마다 핫스팟별 가림 비율(히트 박스 기준, 화자 제외). 단서 > 0 ❌, 장난감 > 0 ⚠️. 결과는 `playtest-out/cover/<id>/report.md`와 PNG |
| `cases/<id>.ts` | `frames.ts` 화면별 사례(#466). `magpie_nest`는 특기 연출, `park_fountain`은 설계 문서 0절 단서 표 + 9절 진입·대기 + 아하 결과(#468 단서 대조용). 화면을 늘리면 `cases/index.ts`에 한 줄. `cases.test.ts`가 Chrome 없이 `scene.ts`로 사례마다 누를 수 있는지, 기대 대사(`says`)가 뜨는지, 화면 파일 이름 = JSON id인지 본다 |

재생은 말풍선 넘기기를 쓰지 않는다(ui-interaction 5절). 그래서 "걷는 중 누른 탭이 씹힌다" 같은 문제는 판정 1에서 안 보이고 판정 2(사람)에서 본다. A5(첫 화면)·A6①(세로 안내)은 `smoke.ts`가 본다.

**타이틀·맵 프레임(#792 설계 6절, 체크리스트 3-1절)**: `menus.ts`는 쿼리 없는 기본 링크를 세이브 상태 셋(없음 / 일부 깸 / 다 깸)으로 열어 타이틀·`はじめ` 확인 줄·맵·잠금 안내 줄을 찍는다. 세이브는 `seed.ts`가 게임과 같은 `saveOnCard`로 만들어 문서가 만들어지기 전에 localStorage에 심는다. 판은 안 푼다(데스크톱 약 14초). `--view`로 체크리스트 1절 크기(D1·D4·M3·M1, 쉼표로 여럿, `all`은 넷 다 약 61초)를 고른다. 기본 D1, `--touch`만 주면 M3이고, M3·M1은 탭으로 누른다. 클릭·탭은 크기가 정하므로 `--view`와 `--touch`를 같이 주면 바로 에러로 끝난다. 타이틀 버튼·맵 카드 상태가 `titleMenu`·세이브와 다르거나 콘솔 에러가 있으면 종료 코드 1. 맵에서 다시 깬 카드·돌아온 맵은 판을 풀어야 해서 `solve.ts --via-map(-last) --out`이 찍는다.

```bash
node --import ./scripts/playtest/register.mjs scripts/playtest/menus.ts [--view D1,M1|all | --touch] --url http://localhost:4173/ --out /tmp/menus --no-sandbox
```
