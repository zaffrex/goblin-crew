# 결정 기록 (Decision Log)

ADR(`docs/adr/`)보다 가벼운 결정을 ADR과 같은 형식으로 남기는 곳이다. Slack에서 정한 것도 **반드시 여기에 문서로 남긴다.**

| 종류 | 위치 | 리뷰 |
|---|---|---|
| L1 가벼운 결정 | `docs/decisions/YYYY-MM-DD-slug.md` | 자동 통과(리뷰 게이트), 결정자가 바로 머지 |
| L2 제품 영향 결정 | `docs/adr/NNNN-slug.md` | 2개 역할 리뷰 + PM 승인 |
| L3 사장님 결정 | `docs/decisions/YYYY-MM-DD-slug.md` (레벨: L3) | 사장님 결정 내용을 PM이 기록 |

- 파일 이름은 날짜+slug라 여러 명이 동시에 써도 번호가 겹치지 않는다.
- 템플릿: `_template.md`
- **공개 저장소 주의**: 저장소는 public이고 Slack은 비공개다. 문서·이슈·PR·커밋에 Slack URL(permalink), 워크스페이스 주소, 채널/사용자 ID를 쓰지 않는다. 출처는 "`#goblin-ceo` 사장님 질문 (2026-11-15)"처럼 채널명 + 날짜로 쓰고, 필요하면 원문을 한 줄 인용한다 ([이슈 #32](https://github.com/zaffrex/goblin-crew/issues/32)).
- 결정을 뒤집을 때는 새 기록을 쓰고 이전 기록 맨 위에 `> 대체됨: <새 파일>` 한 줄을 단다.
