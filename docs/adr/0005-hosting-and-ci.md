# ADR-0005: 호스팅은 GitHub Pages(Actions 배포), 게임 CI는 기존 ci.yml 확장

- 상태: 승인됨 (2026-11-15, PM Noah. PR #17 머지)
- 날짜: 2026-11-15
- 작성자: **[인프라 Sam]**
- 리뷰어: (대기)
- 관련: 이슈 #5, ADR-0004(빌드 산출물 정적 `dist/`), ADR-0006(localStorage 세이브), Slack #goblin-ceo 사장님 방향(2026-11-15 00:21 "일단 GitHub Pages라도 괜찮을 거 같아")

## 배경 (Context)
사장님이 언제든 최신 빌드를 플레이할 수 있어야 한다. 제약: 월 0원(비용 발생 시 L3), 서버 없음(ADR-0006), 산출물은 정적 파일(ADR-0004), 저장소는 이미 public이라 Pages와 Actions 표준 러너가 무료다. 사장님은 GitHub Pages로 시작하고 필요하면 Cloudflare를 검토하자고 했다.

## 고려한 선택지 (Options)
### A. GitHub Pages, GitHub Actions 배포 (`upload-pages-artifact` + `deploy-pages`)
- 장점: 계정·시크릿 추가 없음, 같은 저장소 안에서 끝남, main 머지 시 자동 배포.
- 단점: PR별 미리보기 기본 기능 없음. 커스텀 응답 헤더 설정 불가. 사이트 1GB, 월 대역폭 약 100GB 소프트 한도.
- 월 비용: **0원**

### B. GitHub Pages(gh-pages 브랜치) + PR 프리뷰 하위 경로 배포 (`/pr-<n>/`)
- 장점: PR마다 URL.
- 단점: 외부 액션과 쓰기 권한(`contents: write`) 필요, 브랜치 소스 방식이라 A와 배타적. 프리뷰와 main이 **같은 오리진**이라 localStorage가 섞인다(Ben ADR-0006 저장 키 충돌).
- 월 비용: **0원**

### C. Cloudflare Pages
- 장점: PR 프리뷰가 자동이고 오리진이 분리된다(`<hash>.project.pages.dev`), 헤더 설정 가능.
- 단점: 외부 계정·API 토큰 시크릿 추가(L3: 외부 서비스), 운영 대상 증가.
- 월 비용: 무료 티어 **0원**, 초과 시 발생

### D. 아무것도 안 하기(로컬 빌드만)
- 사장님이 플레이할 수 없어 목표에 어긋난다. 기각.

## 결정 (Decision)
**A를 채택한다.** 근거: 비용 0원, 계정 추가 없음, 권한 최소(`pages: write`, `id-token: write`는 deploy 잡에만). 구체안:
1. `deploy.yml`: main push 시 `npm ci && npm run build` 후 `dist/`를 Pages로 배포. `BASE_PATH=/goblin-crew/`, `VITE_BUILD_SHA=${{ github.sha }}`. `concurrency: { group: pages, cancel-in-progress: false }`로 연속 머지 시 배포가 겹치지 않게 한다. PR 이벤트에서는 배포하지 않는다(시크릿이 없어도 안전).
2. 게임 CI는 기존 `ci.yml`의 `lint/typecheck/test/build`를 그대로 쓴다(스크립트 이름만 맞추면 자동 실행). 실패 시 머지 금지는 브랜치 보호의 필수 체크로 건다. Node 22, npm. **CI 빌드도 배포와 같은 `BASE_PATH=/goblin-crew/`와 `VITE_BUILD_SHA`로 한다**(하위 경로 버그를 CI에서 잡기 위해). 확인: `BASE_PATH=/goblin-crew/ npm run preview` 후 `http://localhost:4173/goblin-crew/`.
3. **PR 프리뷰 대용:** CI가 `dist/`를 아티팩트(보존 7일)로 올린다. 리뷰어는 받아서 `npm run preview`로 확인한다. 아티팩트 프리뷰는 Pages와는 오리진이 분리되지만, 로컬 `npm run preview`는 PR이 달라도 모두 `http://localhost:4173`이라 **PR끼리는 localStorage를 공유한다.** 그래서 프리뷰/개발 빌드는 `VITE_SAVE_NS=dev`로 빌드한다(CI 아티팩트 빌드에 적용).
4. 세이브 키: main 배포는 기존 `goblincrew.save.v1`을 유지한다. 프리뷰/개발 빌드와 오리진을 공유하는 배포(B 등)는 빌드 변수 `VITE_SAVE_NS`(main 기본 빈 문자열)로 접두사를 붙인다. 버전이 다른 세이브는 조용히 무시하지 않고 버리고 알린다(ADR-0006 후속, Ben). 경로 하드코딩 비교는 하지 않는다. 규칙은 ADR-0006 후속 PR(Ben), 코드는 필요해질 때(Theo).
   CSP는 빌드 결과물의 `<meta http-equiv>`로 건다(Theo). `frame-ancestors`는 불가.
5. CI에서 번들 크기·로드 시간 예산 검사는 M1로 미룬다(Theo 요청 질문에 대한 답: 동의, 대신 `dist/assets/*.js` gzip 합계를 `$GITHUB_STEP_SUMMARY`에 출력, 기준은 ADR-0004의 초기 JS gzip 100KB).

## 반대 의견 (Dissent)
가장 강한 반론: "리뷰어가 PR마다 아티팩트를 받아 실행하는 건 번거로워 프리뷰 없이는 UI 리뷰가 느려진다. 처음부터 C를 쓰자." 받아들이지 않은 이유: 현재 PR 대부분이 문서/ADR이고 플레이 가능한 빌드는 M1부터다. C는 계정 추가(L3)와 시크릿 관리가 필요하다. 대신 아래 재검토 조건을 둔다.

## 비용
| 항목 | 월 비용 |
|---|---|
| GitHub Pages (public) | 0원 |
| Actions 표준 러너 (public) | 0원 |
| Cloudflare Pages 무료 티어 (전환 시) | 0원, 초과 시 발생 → L3 |

## 결과 (Consequences)
- 좋아지는 것: main이 항상 플레이 가능한 URL로 배포된다. 운영 대상이 늘지 않는다.
- 나빠지는 것: PR 프리뷰 URL이 없다. 커스텀 헤더(예: 엄격한 CSP)를 못 쓴다.
- 리스크: Pages 오리진 `https://<user>.github.io`는 같은 계정의 모든 프로젝트 사이트가 localStorage를 공유한다(경로는 오리진을 나누지 않음). 키 접두사 `goblincrew.`로 충돌을 줄이고 XSS는 CSP로 방어한다.
- 리스크: **저장소를 private으로 바꾸면** Pages(무료 플랜 불가)와 Actions 분량 비용이 바뀐다. 전환 전 L3로 올린다. 대역폭 한도는 공개 홍보 시점에 재확인한다.
- 리스크: Pages URL은 첫 배포부터 공개·검색 노출된다. 가제 "짝짝이 원정대"는 상표 조사 전이므로 L3 런칭 전까지 빌드에 `<meta name="robots" content="noindex">`를 넣는다(프로젝트 사이트라 robots.txt는 무효). 런칭 L3 때 제거한다.
- **Cloudflare Pages 재검토 조건:** ① 사장님이 PR 단계에서 직접 봐야 하는 UI 변경이 생겨 PR별 플레이 가능한 프리뷰가 리뷰 병목이 될 때 ② 저장소를 private으로 바꿀 때 ③ 사이트 크기/대역폭 한도에 근접할 때 ④ 커스텀 헤더가 필요할 때. 이때 계정 생성은 L3로 올린다.

## 권한 필요 사항
봇 토큰은 저장소 admin이 아니라(확인: permissions 전부 false) Pages 소스를 "GitHub Actions"로 바꾸기와 브랜치 보호(필수 체크)를 직접 못 한다. 사장님께 설정 1회를 요청한다(비용 없음, L3 아님). 마감: 11/20 배포 URL 전.
**B 플랜:** 11/18까지 설정이 안 되면 아티팩트 프리뷰만으로 M0를 판정한다. 요청은 클릭 3단계 이하로 쓴다.
