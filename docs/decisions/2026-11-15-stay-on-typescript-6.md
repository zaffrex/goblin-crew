# 결정: TypeScript 7 업그레이드 보류, 6.0.x 유지

- 레벨: L1
- 날짜: 2026-11-15
- 결정자: **[FE Theo]**
- 참여: 인프라 Sam(이슈 제기, @types/node 메이저 고정 제안)
- 출처: 이슈 #56, PR #55(dependabot ignore 반영), Dependabot PR #51(typescript 6.0.3 → 7.0.2, `check` 실패로 닫힘), PR #52(@types/node 26, 닫힘)

## 배경
Dependabot PR #51이 CI `check`에서 실패했다. 원인은 타입 오류가 아니라 `npm ci` 단계의 peer 충돌이다.
`typescript-eslint@8.72.2`(latest, canary 8.72.3-alpha.8도 같음)의 peer 범위가 `typescript >=4.8.4 <6.1.0`이다.

로컬에서 `--legacy-peer-deps`로 TS 7.0.2를 강제 설치해 확인한 결과:

| 단계 | TS 7.0.2 결과 |
|---|---|
| `typecheck` (tsconfig 3개) | 통과, 코드 수정 0줄. 0.47초(TS 6: 2.9초) |
| `test`, `build` | 통과 (vite/vitest는 tsc를 쓰지 않음) |
| `lint` | **실패**: `typescript-eslint does not support TS 7.0.` (TS 7 패키지에 기존 JS 컴파일러 API가 없음) |

## 선택지
- A. TS 6.0.x 유지, Dependabot에서 typescript 메이저 업데이트를 무시 (장점: 변경 최소, 툴체인 1개 / 단점: tsc 속도 이득을 못 얻음)
- B. 나란히 쓰기: lint용 TS 6(`@typescript/typescript6` 별칭 등) + typecheck용 TS 7 (장점: typecheck 약 2.4초 단축 / 단점: 컴파일러 2개, 에디터·lint·CI가 서로 다른 TS로 판단할 수 있음)
- C. typescript-eslint 제거, TS 7만 사용 (장점: 단순 / 단점: `no-restricted-imports` 외 TS 규칙(`no-unused-vars`, `no-explicit-any` 등)을 잃음)

## 결정
A. 우리 코드는 TS 7에서 이미 통과하므로 막는 것은 typescript-eslint 지원 하나뿐이다.
2.4초를 아끼려고 컴파일러를 두 벌 관리하는 건(B) 지금 규모에 맞지 않는다. lint를 버리는 것(C)은 손해가 더 크다.
`.github/dependabot.yml`에서 `typescript`와 `@types/node`의 semver-major 업데이트를 무시해 #51·#52 같은 PR이 매주 다시 열리지 않게 한다. 6.0.x 패치·마이너는 계속 받는다.
이 ignore 설정은 같은 내용으로 PR #55(사장님)에서 먼저 들어갔으므로, 이 기록은 그 설정의 근거와 다시 볼 조건을 남기는 역할만 한다.

## 반대 의견
가장 강한 반론: "나중에 한꺼번에 올리면 더 아프다." → 지금 확인한 바로 TS 7 전환 비용은 코드 0줄이라 미뤄도 쌓이는 빚이 거의 없다.
리스크: typescript-eslint 범위가 `<6.1.0`이라 TS 6.1이 나오면 그 Dependabot PR도 같은 이유로 실패한다. 그때는 CI 실패를 보고 같은 방식으로 판단한다.

## 다시 볼 조건
- typescript-eslint가 TS 7.x를 peer 범위에 넣으면(추적: typescript-eslint 저장소 이슈 번호 10940, lint 오류 메시지에 링크가 나옴) → `.github/dependabot.yml`의 typescript ignore 줄을 지우고 업그레이드한다.
- CI Node를 22에서 올릴 때 → `@types/node` 메이저도 같이 올린다.
- typecheck가 30초를 넘을 만큼 코드가 커지면 → B(나란히 쓰기)를 다시 본다.
