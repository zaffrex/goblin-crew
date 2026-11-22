# 결정: 그림 쪽 고정 검사는 CI vitest(`tests/art/`)에 두고, 그림 있는 화면은 클릭 대상 전부를 시트에 그려야 머지된다

- 레벨: L1
- 날짜: 2026-11-23 (실제로 정한 날은 11/22, PR #820·#829)
- 결정자: **[디자이너 Luna]** (리뷰 Theo, PR에서 합의)
- 참여: Luna, Theo(리뷰)
- 출처: PR #820(H5 ② 여유 고정), #828·PR #829(시트가 클릭 대상을 다 그리는지), PR #829 Theo 리뷰 ③ "결정 기록을 `docs/decisions/`에도"

## 배경
11/22에 그림 쪽 검사 두 개를 vitest로 넣었다. 그때 결정은 외부 시범 도구가 루트 `decisions/`에만 남겼다(`2026-11-22-art-timing-guard-in-vitest.md`, `2026-11-22-scene-sheet-covers-all-targets.md`). CLAUDE.md상 `docs/decisions/`가 우선이므로, 그림 PR 머지 조건이 된 두 규칙을 여기에 한 장으로 남긴다. 루트 기록과 내용은 같다.

## 선택지
- A. 미리보기 스크립트(`frames.ts`, 재생 도구 A7 `--require-art`)로만 본다. 장점: 이미 있다. 단점: 사람이 돌려야 보인다. #827에서 `statue`가 보라 임시 판으로 덮였는데 `npm test`가 통과했다.
- B. 빌드된 `public/scenes/<화면>-objects.json`을 읽는 vitest를 `tests/art/`에 둔다. 장점: CI `check`에서 PR마다 걸린다. 단점: 그림 PR이 테스트 상한도 같이 고쳐야 할 때가 생긴다.

## 결정
**B.**
1. 연출 길이 한도(ADR-0761 H5·H6)를 지키려고 시트 anim 칸 시간 합을 고정하는 검사는 `tests/art/` vitest로 둔다. 첫 예: `tests/art/park-fountain-timing.test.ts`(`floor.pigeons_perch` + `jacket.slide` ≤ 2070ms). 상한을 바꾸는 PR은 replay로 H5를 다시 재서 본문에 적는다.
2. 물건 시트가 있는 화면은 hotspot 전부와 `box` 있는 spot 전부가 시트(`coveredIds`)에 있어야 한다(`tests/art/hotspot-coverage.test.ts`). 대상 기준은 엔진 `sceneLayout()`과 같고, 상자 없는 걷기 자리 spot은 대상이 아니다. 시트가 없는 그림 전 화면(지금 `laundromat`)은 보지 않는다. 그림 PR이 시트를 만드는 순간부터 그 화면 대상 전부를 그려야 머지된다. 예외 목록은 지금 없다.
3. 두 검사 다 메타를 `parseSceneArt`로 읽는다(엔진이 받는 것과 같은 검증).

## 반대 의견
가장 강한 반론(Theo, PR #829 ①): "테스트의 `targetIds`는 `sceneLayout` 기준을 다시 적은 복사라, 엔진 기준이 바뀌면 조용히 어긋난다." → 지금은 `sceneLayout`을 테스트에서 부르려면 `SceneData` 전체를 꾸려야 해서 복사가 더 싸다. 기준이 바뀌는 PR이 나오면 Theo가 `scene.ts`에서 대상 ID 목록 함수를 빼서 둘 다 쓰게 한다.

## 다시 볼 조건
- 일부러 임시 상자로 남겨 둘 클릭 대상이 필요해질 때 → 예외 목록을 L1로 정한다.
- 엔진의 `uncovered()` 폴백 규칙이나 `sceneLayout()` 대상 기준이 바뀔 때.
- 그림 PR마다 길이 상한을 고치는 일이 잦아지면(같은 화면 2번 이상) → 상한 대신 replay H5 측정을 CI에 두는 쪽 검토.
