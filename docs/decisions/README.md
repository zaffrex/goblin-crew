# 결정 기록 (Decision Log)

ADR(`docs/adr/`)보다 가벼운 결정을 ADR과 같은 형식으로 남기는 곳이다. Slack에서 정한 것도 **반드시 여기에 문서로 남긴다.**

| 종류 | 위치 | 리뷰 |
|---|---|---|
| L1 가벼운 결정 | `docs/decisions/YYYY-MM-DD-slug.md` | 자동 통과(리뷰 게이트), 결정자가 바로 머지 |
| L2 제품 영향 결정 | `docs/adr/NNNN-slug.md` | 2개 역할 리뷰 + PM 승인 |
| L3 사장님 결정 | `docs/decisions/YYYY-MM-DD-slug.md` (레벨: L3) | 사장님 결정 내용을 PM이 기록 |

- 파일 이름은 날짜+slug라 여러 명이 동시에 써도 번호가 겹치지 않는다.
- 템플릿: `_template.md`
- 결정을 뒤집을 때는 새 기록을 쓰고 이전 기록 맨 위에 `> 대체됨: <새 파일>` 한 줄을 단다.
