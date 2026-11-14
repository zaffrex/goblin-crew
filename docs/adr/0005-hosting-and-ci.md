# ADR-0005: 호스팅은 GitHub Pages(Actions 배포), 게임 CI는 기존 ci.yml 확장

- 상태: 제안됨
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
1. `deploy.yml`: main push 시 `npm ci && npm run build` 후 `dist/`를 Pages로 배포. `BASE_PATH=/goblin-crew/`. PR 이벤트에서는 배포하지 않는다(시크릿이 없어도 안전).
2. 게임 CI는 기존 `ci.yml`의 `lint/typecheck/test/build`를 그대로 쓴다(스크립트 이름만 맞추면 자동 실행). 실패 시 머지 금지는 브랜치 보호의 필수 체크로 건다. Node 22, npm.
3. **PR 프리뷰 대용:** CI가 `dist/`를 아티팩트(보존 7일)로 올린다. 리뷰어는 받아서 `npm run preview`로 확인한다. 아티팩트는 별도 오리진이라 localStorage가 섞이지 않는다.
4. 추가로 세이브 키에 `BASE_PATH` 기반 접두사를 붙이자고 Ben/Theo에게 요청한다(향후 B나 다른 하위 경로 배포 대비).
5. CI에서 번들 크기·로드 시간 예산 검사는 M1로 미룬다(Theo 요청 질문에 대한 답: 동의, 대신 번들 크기만 로그로 출력).

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
- 리스크: **저장소를 private으로 바꾸면** Pages(무료 플랜 불가)와 Actions 분량 비용이 바뀐다. 전환 전 L3로 올린다. 대역폭 한도는 공개 홍보 시점에 재확인한다.
- **Cloudflare Pages 재검토 조건:** ① PR별 플레이 가능한 프리뷰가 리뷰 병목이 될 때 ② 저장소를 private으로 바꿀 때 ③ 사이트 크기/대역폭 한도에 근접할 때 ④ 커스텀 헤더가 필요할 때. 이때 계정 생성은 L3로 올린다.
