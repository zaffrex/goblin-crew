# scripts/playtest — M1 실입력 재생 도구 (#101)

M1 판정 1(`docs/team/m1-acceptance.md`)용. 배포 URL을 headless Chrome에서 열고 Chrome DevTools Protocol로 **실제 마우스 클릭·터치 탭**을 보낸다. 게임 함수를 불러 게임을 움직이지 않는다. `Runtime.evaluate`는 관찰(캔버스 위치, DOM 상태, 포인터 기록)에만 쓴다.

의존성 없음: Node 22의 타입 제거 실행과 내장 `WebSocket`을 쓴다. Chrome은 `CHROME_PATH` 또는 기본 경로에서 찾는다.

```bash
node scripts/playtest/smoke.ts                          # 배포본 (기본 URL)
node scripts/playtest/smoke.ts --url http://localhost:4173/ --out /tmp/pt
node scripts/playtest/smoke.ts --no-sandbox             # 컨테이너 등 샌드박스가 안 될 때
```

`--no-sandbox`는 신뢰하는 URL(우리 배포본, 로컬 빌드)에만 쓴다. `--url`로 아무 주소나 열 수 있으니 외부 사이트에는 쓰지 않는다.

결과: `<out>/report.md`, `report.json`, 뷰포트별 PNG. A4 콘솔 에러나 입력 경로 실패면 종료 코드 1, A5·A6는 경고만.

| 파일 | 내용 |
|---|---|
| `coords.ts` | 화면 JSON 대상(핫스팟 `variants`, 서는 자리 `box`) → 내부 좌표 → CSS px. 게임 입력과 같은 `viewport.ts` 변환을 쓴다 |
| `cdp.ts` | Chrome 실행, CDP 세션, 클릭·탭·스크린샷·콘솔 에러 수집 |
| `plan.ts` | 2부-a: 정답 행동 `{char, verb, target}` → 누를 곳(캐릭터 칸, 동사 무장, 대상, 터치 2번). `docs/design/ui-interaction.md` 2·3·4·10절. 입력은 `?playtest=1` 읽기 전용 훅 `window.__gcLayout()`(#68). HUD id는 `hud.ts` `HudId`(`char.jjuk`, `verb.ability`, `item.0`). 테스트는 고른 탭을 실제 `interact.ts` `tap()`에 넣어 확인한다 |
| `smoke.ts` | 1부: 데스크톱 1280×720(마우스, dpr 1), 모바일 844×390(터치, dpr 3), 세로 390×844(스크린샷) |

2부-b(훅을 읽어 `solution` 재생 A1, 오답 A2, 게이지 0 A3, 8px 탭 A6②)는 #68 훅이 머지된 뒤 붙인다. 행동마다 `busy`가 거짓이 될 때까지 기다리고, 말풍선 넘기기는 쓰지 않는다(ui-interaction 5절).
