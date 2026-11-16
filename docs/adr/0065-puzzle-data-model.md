# ADR-0065: 퍼즐 데이터 모델: 화면 JSON, 순수 함수 `step(screen, state, action)`, BFS 검사 도구

- 상태: 제안됨
- 일부 대체됨: 8절의 노드·리셋 간선·피해 간선 재호출은 ADR-0096으로 대체됨
- 날짜: 2026-11-15
- 작성자: **[FE Theo]**
- 리뷰어: (요청) **[디자이너 Luna]** 퍼즐 원칙(ADR-0018)·화면 1 상세(#66)와의 정합, **[BE Ben]** 안정 ID·세이브·BFS 검사 도구(#67), **[PM Noah]** 범위·승인
- 관련: 이슈 #65, ADR-0003(규칙 목록 + 3단계 폴백, 예시 퍼즐), ADR-0004(결정 2 코어 분리·JSON 직렬화, 결정 6 콘텐츠는 데이터, 결정 7 `solution`·콘텐츠 검증), ADR-0006(세이브), ADR-0018(M·S·F·G·R·I 원칙), `docs/design/mvp-screen-matrix.md`, 후속 구현 #64(규칙 엔진)·#67(BFS 검사)·#68(상호작용 UI)·#66(화면 1 상세)

## 배경 (Context)
ADR-0004 결정 6은 "코드 수정 없이 데이터로 퍼즐을 추가한다"만 정하고 데이터 형식은 이 ADR로 넘겼다. ADR-0003은 상호작용 구조(`(핫스팟, 동사, 조건) → 반응`, 처음 맞는 규칙 하나, 3단계 폴백, 서는 자리)를, ADR-0018은 검사할 숫자(M1~M6, S2, S3)와 리셋 범위(G2), ID 정책(I1~I3)을 정했다. 이 셋을 실제로 돌아가는 계약 하나로 묶어야 M1 임계 경로가 움직인다.

- #64(규칙 엔진, Theo), #67(BFS 검사, Ben), 정답 경로 자동 플레이(ADR-0004 결정 7), #68(UI)이 **같은 함수**를 써야 한다. 함수가 둘이면 "CI는 풀린다는데 게임에서는 안 풀린다"가 생긴다(PM, #65 코멘트).
- #66(화면 1 상세, Luna)이 JSON으로 옮겨질 형식이 필요하다.
- 넘어온 항목(#65 본문): ID 문법, 규칙/상태 구조, 리셋, `solution`, 검사 도구 판정, 자동 걷기 중 입력, `onEnter`. 그리고 #21 리뷰 메모 중 이 ADR이 기본값을 정할 것: 쿵 리셋 범위(대상 핫스팟 단위), 인벤토리 공용.

제약: 런타임 의존성 0개(ADR-0004 결정 1), `src/core`는 DOM 금지·JSON 직렬화 가능한 상태(결정 2), 서버 없음(ADR-0006), M1 목표 11/18. 퍼즐 데이터를 주로 쓰는 사람은 Luna다.

## 고려한 선택지 (Options)

### A. 선언형 JSON 규칙 목록 + 순수 함수 `step` 하나 (추천)
화면 하나 = JSON 파일 하나. 규칙은 `조건(when) → 효과(do) + 연출(show)`이다. 코어는 이 데이터를 해석하는 순수 함수 `step(screen, state, action)` 하나만 공개한다. 게임, 자동 플레이, BFS가 모두 이 함수를 부른다.
- 장점: 퍼즐 추가에 코드가 필요 없다. 조건·효과 종류가 닫혀 있어 BFS가 모든 행동을 열거할 수 있다. 규칙 diff가 문서처럼 읽혀서 Luna가 리뷰하고 고칠 수 있다.
- 단점: 표현력이 조건·효과 목록에 묶인다. 새 종류가 필요하면 코어 PR(그리고 이 ADR 개정)이 필요하다.

### B. 화면마다 TypeScript 스크립트(콜백)
`onAct(state, action) { if (...) ... }`처럼 화면별 코드로 퍼즐을 짠다.
- 장점: 표현력이 무한하다. 형식 설계가 필요 없다.
- 단점: ADR-0004 결정 6("코드 수정 없이 데이터로")과 맞지 않는다. Luna가 직접 고칠 수 없다. 콜백 안에서 시간·난수·전역 상태를 쓰면 BFS 결과를 믿을 수 없고, 막을 방법이 리뷰뿐이다.

### C. 명시적 상태 그래프(상태 목록 + 전이 표)
상태와 전이를 데이터에 직접 나열한다.
- 장점: BFS가 필요 없을 만큼 검사가 쉽다.
- 단점: 예시 퍼즐만 해도 도달 가능한 상태가 약 1,700개다(ADR-0018 S2). 손으로 쓸 수 없다. 결국 A 같은 규칙에서 생성하게 된다.

## 결정 (Decision)
**A를 채택한다.** 근거: 이 게임의 위험은 표현력 부족이 아니라 "막힌 상태"와 "너무 쉬운 화면"이다(ADR-0018). 닫힌 조건·효과 집합이어야 BFS가 그 둘을 기계적으로 잡는다. 표현력이 모자라면 조건·효과 종류를 하나씩 추가한다(각각 코어 30~50줄 + 테스트).

### 1. 파일 배치
```
content/
  characters.json          # 캐릭터 공통 폴백(ADR-0003 폴백 ②), 시작 대사 등
  screens/<screenId>.json  # 화면 하나 = 파일 하나. 파일 이름 = 화면 ID
  text/ko.json             # 문자열 리소스 { textId: "대사" } (ADR-0004 결정 3)
src/core/puzzle/           # types.ts, step.ts, validate.ts, bfs.ts (+ *.test.ts)
tests/playthrough/         # 화면마다 solution 자동 플레이
```
- 형식은 JSON이다. YAML·JSON5는 파서 의존성이 생겨 쓰지 않는다. 주석이 필요하면 아무 객체에나 `"note"` 문자열 필드를 쓴다(코어는 무시).
- 스키마 검사는 의존성 없이 `validate.ts`로 직접 한다. 콘텐츠 검증(ADR-0004 결정 7)은 이 함수를 `npm test`에서 부른다.

### 2. ID 문법 (ADR-0018 I1의 구체화)
- **데이터 ID**: `^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$`, 64자 이하. 마디는 소문자 snake_case, 마디 구분은 `.`이다. 예: `magpie_nest`, `magpie.on_ground`, `item.shop_key`.
- **데이터 필드 이름**은 camelCase다(`gripPoint`, `reachPoint`, `releaseTo`). ID와 필드 이름은 다른 것이다.
- **범위**: 화면 ID·아이템 ID·텍스트 ID는 전역에서 유일하다. 핫스팟·서는 자리·플래그·규칙 ID는 화면 안에서 유일하고, 화면 밖에서 가리킬 때는 `<screenId>/<localId>`(예: `magpie_nest/peck_from_hook`)로 쓴다(로그, 테스트 이름).
- 이름공간 관례: 플래그는 `<대상>.<상태>`(`magpie.on_ground`), 아이템은 `item.<이름>`, 텍스트는 `<screenId>.<이름>` 또는 `char.<캐릭터>.<이름>`. 핫스팟·서는 자리는 같은 이름공간을 쓴다(서는 자리도 클릭 대상이라서).
- ID 위반은 콘텐츠 검증 **실패**다. 세이브 스키마의 `ID_RE`(`src/core/save/schema.ts`, 대문자 허용)는 더 넓어서 그대로 둔다. 좁히는 건 Ben 판단으로 별도 PR.

### 3. 화면 데이터 형식
예시는 ADR-0003 예시 퍼즐의 뼈대다. 실제 규칙·반응·대사는 #66(Luna)이 정한다.

```jsonc
{
  "id": "magpie_nest",
  "spots": {                       // 서는 자리 (ADR-0003). 위치 상태는 이것뿐
    "floor":        { "x": 0, "y": 240, "free": true },        // 자유 바닥. 정원 무제한
    "seesaw_left":  { "x": 220, "y": 214, "box": [208, 196, 38, 24],     // 정원 기본 1. box가 있으면 클릭 대상
                      "takenShow": [{ "say": ["self", "magpie_nest.spot_taken"] }] },  // 차 있어서 못 갈 때 연출(선택)
    "seesaw_right": { "x": 284, "y": 214, "box": [250, 196, 38, 24] },
    "hook":         { "x": 160, "y": 160, "box": [150, 84, 24, 24], "hold": true, "releaseTo": "floor",  // 유지 상태(S2). move로 못 감
                      "releaseShow": { "default": [{ "say": ["self", "magpie_nest.let_go_jjuk"] }],   // 손 놓기 연출(선택)
                                       "ppik":    [{ "say": ["ppik", "magpie_nest.let_go_ppik"] }] } }
  },
  "hotspots": {
    "magpie": { "box": [134, 6, 24, 24], "hintAbility": "squeak",
                "variants": [{ "when": { "flags": { "magpie.on_ground": true } }, "box": [88, 212, 24, 24] }] },  // 상태별 위치
    "nest":   { "box": [128, 30, 36, 24], "hintAbility": "stretch", "reachPoint": [150, 34] }
  },
  "flags": { "magpie.on_ground": false, "nest.key_taken": false },  // 선언 + 초깃값. 불리언만
  "start": { "at": { "jjuk": "floor", "mukjik": "floor", "ppik": "floor" }, "items": [] },
  "exitFlag": "nest.key_taken",    // ADR-0018 S4
  "onEnter": [{ "say": ["ppik", "magpie_nest.enter"] }],
  "rules": [
    { "id": "squeak_magpie_down", "target": "magpie", "verb": "squeak",
      "when": { "flags": { "magpie.on_ground": false } },
      "do":   { "set": { "magpie.on_ground": true } },
      "show": [{ "anim": ["magpie", "fly_down"] }, { "say": ["ppik", "magpie_nest.squeak_ok"] }] },
    { "id": "launch_to_hook", "target": "seesaw_right", "verb": "stomp",
      "when": { "occupied": { "seesaw_left": true, "hook": false } },
      "do":   { "move": [{ "from": "seesaw_left", "to": "hook" }] },
      "show": [{ "anim": ["mukjik", "stomp_seesaw"] }] },
    { "id": "take_key", "target": "nest", "verb": "stretch",
      "when": { "at": ["hook"], "flags": { "magpie.on_ground": true } },
      "do":   { "set": { "nest.key_taken": true }, "give": ["item.shop_key"], "move": [{ "who": "self", "to": "floor" }] },
      "show": [{ "anim": ["jjuk", "reach_hang_up"] }] },
    { "id": "peck_from_hook", "target": "nest", "verb": "stretch",
      "when": { "at": ["hook"] },
      "do":   { "gauge": -1, "move": [{ "who": "self", "to": "floor" }] },
      "show": [{ "anim": ["jjuk", "pecked_fall"] }] }
  ],
  "fallbacks": {                   // 폴백 ①: 이 핫스팟의 동사별 기본 반응 (상태를 바꾸지 않는다, gauge만 예외)
    "nest": { "stretch": { "show": [{ "anim": ["jjuk", "reach_too_short"] }] } }
  },
  "solution": [
    { "char": "ppik",   "verb": "squeak",  "target": "magpie" },
    { "char": "jjuk",   "verb": "move",    "target": "seesaw_left" },
    { "char": "mukjik", "verb": "stomp",   "target": "seesaw_right" },
    { "char": "jjuk",   "verb": "stretch", "target": "nest" }
  ]
}
```

필드 규칙:
- **서는 자리(`spots`)**: `floor`(`free: true`)는 화면마다 하나 있고 정원이 없다. 나머지는 정원 1이 기본이다(`capacity`로 바꿀 수 있다). `hold: true`인 자리가 **유지 상태**다(ADR-0018 G2: 유지 상태는 서는 자리로 모델링). `hold` 자리는 `releaseTo`가 필수다. `hold` 자리에는 선택으로 `releasePoint: [x, y]`(내려올 때 설 발 위치, 엔진 전용)를 둔다. 없으면 엔진은 "지금 x 바로 아래 바닥"에 세운다. 화면 1 고리는 바구니 안 (160, 235)이다(2026-11-16 개정, #157, `docs/decisions/2026-11-16-scene-art-format-v1.md` 6절 2번). **`hold` 자리는 `move`로 갈 수 없다**(그 자리에 대한 `move` 규칙이 있으면 그 규칙, 없으면 `invalid`). 규칙 효과(`do.move`)로만 들어간다(#66: 고리는 발사로만 온다. 걸어서 갈 수 있으면 stomp 없는 3행동 풀이가 생긴다). `releaseShow`는 손 놓을 때 재생할 연출(선택, `{ default, <캐릭터 ID> }`)이고, `takenShow`는 정원이 차서 그 자리에 못 갈 때의 연출(선택)이다. 둘 다 연출이라 BFS에 영향이 없다. `stay`는 예약어라 자리 ID로 쓸 수 없다. 좌표 `x, y`는 엔진이 걷기·그리기에 쓰고 코어 규칙은 쓰지 않는다. `box`가 있는 자리는 클릭 대상이 된다(핫스팟과 같은 이름공간이라 같은 ID로 핫스팟을 따로 만들지 않는다).
- **핫스팟(`hotspots`)**: `box`는 내부 좌표 사각형 `[x, y, w, h]`(최소 24×24, ADR-0007 결정 6), `approach`는 그 대상에 손대기 전에 걸어갈 서는 자리다. 문자열이거나 동사별 맵(`{ "default": "yard", "squeak": "stay", "stretch": "stay" }`)이고, `stay`는 걷지 않고 지금 자리에서 한다(원거리 동사. `dog_yard`·`rooftop_gap`에서 "멀리서 하면 다른 반응"을 `when.at`으로 나눈다). 기본값은 `floor`다. 서는 자리도 클릭 대상이므로 규칙의 `target`에 올 수 있고, 서는 자리의 `approach`도 기본값이 `floor`다(그 자리에 올라서는 건 `move`뿐이다).
- **`variants`**(선택): `[{ when: { flags }, box?, approach? }]`. `when`은 `flags`만 쓴다. 처음 맞는 항목의 값을 쓰고, 없으면 기본값이다. 상태에 따라 위치가 바뀌는 대상(#66 `magpie`: 둥지 위/바닥)용이다. 플래그에서 계산되므로 퍼즐 상태가 늘지 않는다. `box`는 hitTest·그리기만 쓰고, `approach`가 바뀌면 `step`이 그 값을 쓴다.
- **`hintAbility`**(선택): 힌트 ②(ADR-0018 F3)에서 가리킬 능력 동사(`stretch`·`stomp`·`squeak`). 대사는 `characters.json`의 `hints[화자][능력]` 텍스트 ID다. 없으면 그 대상은 힌트를 띄우지 않는다(장난감). 지금 캐릭터 자기 능력이면 띄우지 않는다.
- **플래그(`flags`)**: 선언한 것만 쓸 수 있고 값은 **불리언만**이다. 상태가 셋 이상인 NPC는 불리언 여러 개와 규칙으로 표현한다. 열거형이 필요한 화면이 나오면 이 ADR을 개정한다(반대 의견 참고).
- **아이템**: 인벤토리는 **파티 공용**(#21 메모 4의 기본값)이고, 정렬된 ID 목록이다. 화면 사이에 아이템을 넘기지 않는다(매트릭스 문서 "화면 사이에 아이템을 넘기지 않는다"). 그래서 `start.items`는 보통 `[]`이고, BFS는 화면마다 따로 돈다.
- **NPC 리셋 범위는 대상 핫스팟 단위다**(#21 메모 1의 기본값). 규칙은 자기 `target`에 맞는 행동에만 발동하므로, "시소에 쿵 하면 까치도 놀란다"를 원하면 시소 규칙의 `do`에 `magpie.on_ground: false`를 명시해야 한다. 암묵적인 화면 전체 반응은 없다.

### 4. 상태 (`PuzzleState`, JSON 직렬화 가능)
```ts
interface PuzzleState {
  screen: string;                        // 화면 ID
  at: Record<CharacterId, string>;       // 캐릭터별 서는 자리 ID
  flags: Record<string, boolean>;        // 선언된 플래그 전부 (키 순서는 선언 순서)
  items: string[];                       // 파티 공용, 정렬
  gauge: number;                         // 보송 게이지 0..5 (ADR-0018 G1)
}
```
- **이게 퍼즐 상태의 전부다.** 지금 조작 중인 캐릭터, 걷기 중 좌표, 힌트 ② 카운터(ADR-0018 F3), 대사 진행은 UI 상태라 여기에 넣지 않는다. 그래서 캐릭터 전환은 행동이 아니다(ADR-0018 M6).
- 시간이 없다. 코어는 난수·시각·틱을 쓰지 않는다(ADR-0018 S1). 같은 상태 + 같은 행동 = 항상 같은 결과.
- 기존 고정 틱 함수 `game.ts`의 `step(state)`는 #64에서 `tick(state)`으로 이름을 바꾼다. 앞으로 `step`은 이 ADR의 퍼즐 함수만 가리킨다.
- 세이브(ADR-0006)는 지금처럼 화면 진입 시점의 `checkpoint`만 저장한다. 화면 중간의 `flags`·`at`은 저장하지 않으므로 새로고침하면 그 화면 처음부터 다시 한다. 화면이 4~10행동이라 감수한다. 중간 저장이 필요해지면 `PuzzleState`를 그대로 `checkpoint`에 넣으면 된다(이미 JSON이다).

### 5. 행동과 `step` 계약
```ts
type Verb = 'move' | 'look' | 'hand' | 'stretch' | 'stomp' | 'squeak' | 'item';
interface Action { char: CharacterId; verb: Verb; target: string; item?: string }  // item은 verb==='item'일 때만

interface StepResult {
  state: PuzzleState;          // 새 객체. 입력 state는 바꾸지 않는다
  events: PuzzleEvent[];       // 엔진이 순서대로 재생할 연출
  source: 'rule' | 'move' | 'hotspotFallback' | 'characterFallback' | 'release' | 'blocked' | 'invalid';  // 'move' = 기본 이동 성공
  ruleId?: string;             // source==='rule'일 때
}
function step(screen: ScreenData, state: PuzzleState, action: Action): StepResult;
function initialState(screen: ScreenData): PuzzleState;
```
- **동사**: `move`(서는 자리로 이동), `look`(보기), `hand`(맨손: 줍기·당기기·열기. 매트릭스의 "아이템 줍기는 일반 상호작용"), 능력 3개, `item`(가진 아이템 쓰기). 능력은 그 캐릭터의 것만 쓸 수 있다(`jjuk`→`stretch` 등, `characters.ts`). 남의 능력이나 없는 아이템은 `invalid`이고 상태는 그대로다(UI가 애초에 못 고르게 한다).
- **입력 1번 = `step` 1번 = 1행동**(ADR-0018 M6). 자동 걷기(`approach`)는 같은 행동 안에서 일어난다.

**`step` 처리 순서** (ADR-0003 규칙 목록·폴백·설계 규칙 3을 그대로 옮긴 것):
1. **유지 상태 확인**: 행동하는 캐릭터가 `hold` 자리 H에 있고 동사가 `look`이 아니면, 이 `(target, verb)`의 규칙 중 `when.at`에 H가 들어 있고 조건이 모두 맞는 첫 규칙을 찾는다. 있으면 걷지 않고 그 자리에서 적용하고 6·7단계로 간다. 없으면 **손을 놓고 행동을 끝낸다**: `at = H.releaseTo`, `release` 이벤트 + `H.releaseShow` 연출, `source: 'release'`. 바뀌는 것은 자리뿐이다(게이지 변화 없음). 시킨 행동은 하지 않는다. 떨어지는 장면 자체가 "매달린 사람은 거기서 할 수 있는 일만 한다"를 가르치는 실패 반응이기 때문이다(F2, 입력 1번 = 반응 1개. Luna 리뷰, ADR-0003 예시 "손을 놓고 빨래 바구니로 떨어진다"). `look`은 자리를 바꾸지 않고 손도 놓지 않는다.
2. **이동 판정 `goTo(T)`**: (a) `(T, move)` 규칙 중 `when`이 맞는 첫 규칙이 있으면 그것을 적용한다(예: 마당에 들어가다 대장에게 물림). (b) 맞는 규칙이 없으면(규칙이 아예 없거나 하나도 안 맞으면) **기본 이동**이다. 폴백 ①로 가지 않는다. 기본 이동은 T가 `hold`면 `invalid`, 정원이 차 있으면 `blocked` + `T.takenShow`, 아니면 `at = T`.
   - `move` 행동이면 `goTo(대상)`으로 끝낸다(규칙이 적용됐으면 6·7단계).
   - 다른 동사면 걸어갈 자리 A = 대상의 `approach`(동사별 맵이면 그 동사, 없으면 `default`)다. `look`, `stay`, 이미 A에 있음 중 하나면 걷지 않는다. 아니면 `goTo(A)`를 거친다. **`(A, move)` 규칙이 적용됐거나 기본 이동이 막혔으면 행동은 거기서 끝난다**(입력 1번 = 반응 1개). 기본 이동으로 A에 도착했을 때만 3단계로 간다. 그래서 자동 걷기로 울타리·틈 같은 `move` 규칙을 건너뛸 수 없다(Luna 리뷰, `dog_yard`·`rooftop_gap`).
3. **규칙**: `(target, verb)`가 같은 규칙을 파일 순서대로 보고, `when`이 모두 맞는 **첫 규칙 하나**만 적용한다(ADR-0003). `when.at`은 2단계 이동 **뒤** 자리로 판정한다.
4. **폴백 ①**: 맞는 규칙이 없으면 `fallbacks[target][verb]`. 폴백은 상태를 바꾸지 않는다. 예외로 `gauge`(다치는 실패)만 허용한다.
5. **폴백 ②**: 그것도 없으면 `characters.json`의 그 캐릭터·그 동사 공통 실패 리액션(ADR-0018 R2 공용 리액션). 상태는 그대로다.
6. **게이지 0 처리**: 효과 적용 뒤 `gauge`가 0이면 `faint` 이벤트, `at = screen.start.at`, `gauge = 5`. 플래그와 아이템은 그대로다(ADR-0018 G2). 유지 상태도 자리라서 함께 풀린다.
7. **클리어**: `flags[exitFlag]`가 이번 행동으로 `true`가 되면 `clear` 이벤트(ADR-0018 S4).

**조건(`when`)** — 모두 AND. 종류는 이것뿐이다:
| 키 | 뜻 |
|---|---|
| `who` | 행동하는 캐릭터 목록 (`look`·`hand`·`item` 개그를 캐릭터별로 나눌 때) |
| `at` | 행동하는 캐릭터의 서는 자리 목록 (2단계 이동 뒤 기준) |
| `flags` | `{ 플래그: true/false }` |
| `has` / `lacks` | 파티 인벤토리에 있는/없는 아이템 |
| `item` | `verb: "item"`일 때 쓴 아이템 |
| `occupied` | `{ 자리: true/false }` 그 자리에 누가 있는지 |

게이지는 조건에 쓸 수 없다("게이지가 1이면 다른 반응" 같은 규칙 금지). BFS가 게이지를 노드에서 빼는 전제다(8절).

**효과(`do`)** — 이 순서로 적용한다:
| 키 | 뜻 |
|---|---|
| `set` | 플래그 값 바꾸기 |
| `give` / `take` | 인벤토리에 넣기/빼기 |
| `move` | `{ who: "self" \| 캐릭터 ID, to }` 또는 `{ from: 자리, to }`(그 자리에 있는 사람을 옮김, 시소 발사). 빈 자리에서 `from`은 아무 일 없음. 선택 `via: hold 자리`는 "그 자리를 거쳐 떨어졌다"는 연출 표시라 엔진이 그 자리의 `releasePoint`에 세운다. 상태·BFS에는 영향이 없다. `via` 자리는 `releasePoint`가 있어야 하고 그 `releaseTo`가 `to`와 같아야 한다(화면 1 13번 포개짐, 2026-11-16 개정 #157). 정원을 넘기는 `move`는 콘텐츠 오류다(`step`이 예외를 던지고 BFS가 그 상태까지 가는 경로와 함께 실패로 보고) |
| `gauge` | 게이지 증감 (−1이 보통) |

한 규칙에 `set`/`give`와 `gauge`를 같이 써도 된다(예: "열쇠는 챙겼지만 쪼였다"). 그 행동으로 기절하면 6단계대로 플래그·아이템은 남고 자리만 시작으로 돌아간다.

**연출(`show`)과 이벤트**: `show`는 상태를 바꾸지 않는다. `anim [대상, 애니메이션]`, `say [화자, 텍스트 ID | 텍스트 ID 배열]`, `fx [효과, 대상]`(먼지·별·"삑!", ADR-0018 R2). `step`은 이것을 `walk`, `release`, `anim`, `say`, `fx`, `gauge`, `item`, `faint`, `clear` 이벤트 목록으로 바꿔 돌려준다. 엔진(#64·#68)은 **이벤트로만** 반응한다. 상태를 직접 들여다보고 연출을 추측하지 않는다.
- `say`·`anim`의 화자/대상에는 캐릭터 ID 말고도 `self`(행동한 캐릭터)와 `@<자리 ID>`(**효과 적용 전에** 그 자리에 있던 캐릭터)를 쓸 수 있다. `step`이 실제 캐릭터 ID로 바꿔 이벤트를 낸다(#66 "매달려 있던 사람이 말한다"). 그 자리가 비어 있으면 그 연출은 건너뛴다.
- `say`의 텍스트가 배열이면 "첫 번째, 두 번째부터…" 변형이다. UI가 그 규칙(또는 폴백)의 발동 횟수로 고른다(마지막 것을 반복). 횟수는 힌트 카운터처럼 UI 상태라 세이브·BFS에 들어가지 않는다.

**힌트 ② 카운터**(ADR-0018 F3): UI가 `source`와 `target`으로 센다. `hotspotFallback`이 같은 `target`에서 2번이면 그 대상의 `hintAbility`로 힌트 대사. `characterFallback`(공통 반응, 예: `look`)은 세지 않는다(#66 5절). 코어는 카운터를 모른다.

**`onEnter`**: 화면에 들어올 때 엔진이 재생하는 연출 목록이다. 상태를 바꾸지 않는다(효과를 가진 트리거는 BFS 그래프를 흐리게 만들어 MVP에는 두지 않는다).

### 6. 자동 걷기 중 입력
`step`은 즉시 끝나고 상태도 즉시 바뀐다. 엔진은 돌려받은 이벤트를 시간에 맞춰 재생할 뿐이다. 그래서 연출 도중 새 입력이 오면:
- **걷기(`walk`) 재생 중**: 탭은 걷기만 끝 위치로 건너뛴다. **새 행동은 받지 않는다.** 남은 이벤트(`anim`·`say` 등)는 그대로 재생한다. 상태는 이미 확정이라 되돌릴 게 없다. (2026-11-15 개정, #68: 원래 문장은 "걷기를 끝 위치로 건너뛰고 새 행동을 `step`한다"였다. 그러면 걷기 뒤에 붙은 반응이 새 행동에 밀려 사라진다(ADR-0018 F2). `docs/design/ui-interaction.md` 5절, `docs/decisions/2026-11-15-default-tap-verb.md` 결정 5. 구현은 `src/core/scene.ts` `sceneTap`.)
- **반응(`anim`, `say`) 재생 중**: 입력은 대사 넘기기로만 쓴다. 반응이 끝나야 다음 행동을 받는다. 반응 하나가 1~2초라 막힘이 짧다.
- 바닥 클릭으로 그냥 걸어 다니기(같은 `floor` 안)는 퍼즐 행동이 아니다. 엔진 좌표만 바뀌고 `step`을 부르지 않는다. `floor`가 아닌 자리에서 바닥을 누르면 `move floor` 행동이다.
- 큐(입력 미리 쌓기)는 두지 않는다. 연출 중 입력은 줄 세우지 않고 버린다(`docs/design/ui-interaction.md` 5절, 2026-11-15 개정).

### 7. `solution`과 자동 플레이
- `solution`은 화면 JSON 안의 `Action` 배열이다(ADR-0004 결정 7). 자동 플레이 테스트(`tests/playthrough/`)는 `initialState`부터 차례로 `step`하고 다음을 확인한다: 모든 행동의 `source`가 `rule` 또는 `move`(기본 이동)다, 게이지가 0이 되지 않는다, 마지막 행동에서 `clear`가 나온다.
- 길이 규칙(ADR-0018 M6)은 `solution` 길이와 BFS 최단 길이로 센다. 캐릭터 전환은 `Action`이 아니라서 자연히 빠진다.

### 8. 검사 도구 (#67, Ben)
`bfs.ts`가 화면마다 `step`만으로 상태 그래프를 만든다. 다른 퍼즐 해석 코드를 두지 않는다.
- **노드**: `PuzzleState`에서 `gauge`를 뺀 정규화 키(`at`, 선언 순서 `flags`, 정렬된 `items`). 게이지는 그래프에서 빼고, 대신 **모든 상태에 "리셋" 간선**(`at = start.at`)을 더한다. 게이지 0 리셋은 아무 상태에서나 일어날 수 있기 때문이다(#65 본문).
- **피해 간선의 기절 결과**: 리셋 간선은 `flags`·`items`를 그대로 두므로, 플래그나 아이템을 바꾸면서 동시에 기절하는 결과는 만들지 못한다. 그래서 게이지를 깎는 행동(적용된 규칙이나 폴백의 `gauge` 효과가 음수)은 같은 상태를 `gauge = 1`로 두고 한 번 더 `step`해서, 그 결과(`faint` 포함)도 간선으로 더한다. 조건에 게이지가 없으므로(5절) 기절했을 때의 결과는 기절 직전 게이지와 무관하다. 추가 호출은 피해 행동 수만큼이다(PR #87 Ben 리뷰).
- **간선**: 캐릭터 3명 × (모든 서는 자리로 `move` + 모든 대상에 `look`·`hand`·자기 능력 + 가진 아이템별 `item`). `source`가 `invalid`이거나 키가 같은 간선은 버린다. `blocked`는 상태를 바꾸지 않으므로 항상 버려진다. 손 놓기(`release`)는 자리가 바뀌므로 간선이다. 예시 화면은 상태당 약 60행동이라 1,700상태 × 60 ≈ 10만 `step` 호출, 1초 미만으로 본다.
- **검사와 판정** (ADR-0018의 실패/경고 구분을 따른다):

| 항목 | 방법 | 판정 |
|---|---|---|
| 스키마, I1 ID 문법, 참조 무결성(자리·핫스팟·플래그·아이템·텍스트 ID 존재, `variants`의 플래그, `approach` 맵의 동사, `@자리` 화자), 핫스팟과 서는 자리 ID 중복 없음, `stay` 자리 ID 금지, `hintAbility`는 능력 동사, 대사 14자×2줄, `hold` 자리의 `releaseTo`는 `free: true` 자리 | `validate.ts` | 실패 |
| I2 세이브 ID(화면·아이템) 삭제·개명 | 커밋된 ID 매니페스트(`content/ids.json`, 생성 스크립트 포함)와 비교. CI shallow checkout에서도 돌고, 개명은 매니페스트 diff로 보인다. 바뀌면 마이그레이션 노트 필요 | 실패 |
| 정원 초과 | 규칙 효과 `move`가 정원이 찬 자리로 옮김(`step` 예외). 그 상태까지 가는 경로 출력 | 실패 |
| 정답 도달 | 시작 상태에서 `exitFlag = true` 상태에 닿는다 | 실패 |
| S3 막다른 상태 | 도달 가능한 모든 상태에서 정답 상태로 가는 경로가 있다(리셋 간선 포함). 실패 시 시작→그 상태 경로를 출력하고 리셋을 지나면 `via reset` 표시 | 실패 |
| M1·M2 필수 능력 | 능력 하나씩 간선에서 빼고 정답 도달을 다시 본다. 풀리면 그 능력은 필수가 아니다. 결과 표를 출력하고, 매트릭스 문서와 다르면 문서를 고친다(ADR-0018) | 실패 |
| M3·M4 | 화면별 필수 능력 결과를 화면 순서대로 집계 | 실패 |
| `solution` 재생 | 위 7절 | 실패 |
| M5 동사 비율 | `solution`에서 능력 동사만 센다 | 경고 |
| M6 경로 길이 | BFS 최단 길이가 범위 안인지, `solution` 길이가 최단과 같은지 | 경고 |
| S2 유지 상태 | `hold` 자리 수 ≤ 2 | 경고 |
| R1 고유 반응 수 | `show`의 서로 다른 `anim` ID 수 4~12 | 경고 |
| 상태 수 | 도달 가능 상태가 10만 개를 넘음 | 경고 |

- S2는 ADR-0018이 실패/경고를 정하지 않았다. 인지 부하 기준(추정치)이라 경고로 둔다.
- 화면 순서(M3·M4 집계용)는 `content/screens/order.json`의 ID 배열로 둔다.

## 반대 의견 (Dissent)
리뷰에서 나온 것(PR #87):
- **Ben**: 게이지 0과 효과가 동시에 일어나는 상태를 BFS가 못 만든다 → 8절 "피해 간선의 기절 결과"로 반영. 손을 놓은 뒤 흐름이 모호하다 → 처음엔 "이어서 진행"으로 못 박았다가, Luna 리뷰로 "손 놓기로 끝"으로 바꿨다(아래). `releaseTo`는 자유 자리여야 한다 → 검증 규칙에 넣음. I2는 커밋된 ID 매니페스트와 비교 → 반영(#67에서 Ben이 구현).

- **Luna(PR #87 리뷰, #88 화면 1)**: (1) 손 놓기는 이어서 진행하지 말고 거기서 끝 → 반영(5절 1단계). 작성자는 #88 리뷰에서 "이어서"를 추천했지만, 한 입력에 낙하·걷기·다른 반응이 붙으면 왜 떨어졌는지 놓친다(F2)는 근거가 더 강하다고 보고 바꿨다. 덤으로 "손 놓은 뒤 `blocked`" 특수 경우가 없어진다. (2) 자동 걷기가 `move` 규칙을 건너뛴다 → `goTo` 판정으로 통일(5절 2단계). (3) 원거리 동사 → `approach` 동사별 맵 + `stay`. (4) 막혔을 때 연출 → `takenShow`. (5) 정원 초과 → 판정표. 요청 3개: 상태별 위치 → `variants`, 힌트 능력 → `hintAbility`, 다른 캐릭터 옮기기 → 이미 `move.from`.
- **Theo(PR #88 리뷰에서 화면 1을 옮기다 찾음)**: `hold` 자리에 `move`로 걸어갈 수 있었다(stomp 없는 3행동 풀이), 서는 자리가 대상이면 폴백인데도 그 자리에 올라섰다, `hook`·`seesaw_*`가 핫스팟과 서는 자리 양쪽에 있었다(→ 자리에 `box`), 상태에 따라 바뀌는 화자(`self`, `@자리`)와 "두 번째부터" 대사(텍스트 배열)가 없었다, 힌트 카운터는 폴백 ①만 센다.

작성자가 보는 강한 반론과 지금의 답:
- **"플래그를 불리언으로만 두면 NPC 상태가 꼬인다"**(예: 대장이 `in_house`, `in_corner` 둘 다 true): 맞는 우려다. 열거형을 넣으면 조건·효과·BFS 키가 모두 한 단계 복잡해지는데, MVP 5화면은 매트릭스상 NPC 상태가 화면당 2개 이하라 불리언 1개로 충분하다. 꼬임은 S3 BFS가 "도달 가능 상태" 목록으로 드러내 준다. 3상태 NPC가 실제로 나오면 개정한다.
- **"조건·효과가 닫혀 있으면 Luna가 원하는 개그를 못 만든다"**: 연출(`show`)은 열려 있다. 애니메이션·대사·효과는 상태와 무관해서 아무리 늘려도 BFS에 영향이 없다. 닫힌 것은 상태를 바꾸는 쪽뿐이다. 새 효과가 필요하면 #66 리뷰에서 바로 말해 달라. 예시 퍼즐과 매트릭스 5화면 한 줄 설계를 위 표로 옮겨 봤을 때 상태를 바꾸는 종류는 빠진 것이 없었다(`dog_yard`의 "실패하면 울타리 밖으로 밀려남"은 `move self` + `gauge`). 다만 **걷기 판정**에 구멍이 있었다: 자동 걷기가 `move` 규칙을 건너뛰고, 원거리 동사도 먼저 걸어갔다(Luna 리뷰). 5절 2단계 `goTo`와 `approach` 동사별 맵으로 고쳤다.
- **"상태가 즉시 바뀌고 연출은 뒤따르면 화면과 상태가 어긋나 보인다"**: 엔진은 이벤트 재생이 끝나기 전에는 상태에서 그림을 다시 만들지 않는다. 걷기만 건너뛰기를 허용한다. 반응 재생 중 입력 차단이 답답하다는 관찰이 M1에서 나오면 #68에서 조정한다.
- **"`hand` 동사가 하나 더 늘면 UI 선택지가 늘어난다"**: 매트릭스 2·3번 화면이 "줍기는 일반 상호작용"이라 필요하다. UI에서 기본 클릭(동사를 고르지 않은 탭)이 `hand`가 되게 하면 선택지는 늘지 않는다. 결정은 #68 UI 설계에서 Luna와 한다.

## 결과 (Consequences)
- 좋아지는 것: #64(엔진)·#67(BFS)·자동 플레이·#68(UI)이 `step` 하나를 공유한다. #66은 이 형식으로 바로 JSON을 쓸 수 있다. ADR-0018의 실패 항목이 전부 CI에서 기계적으로 검사된다.
- 나빠지는 것: 조건·효과 종류가 늘 때마다 코어 PR과 이 ADR 개정이 필요하다. JSON에는 주석이 없어 `note` 필드로 대신한다. 화면 중간 세이브가 없다.
- 새 리스크: (1) `approach` 자동 걷기 + 유지 상태 해제 순서가 플레이어 직관과 다를 수 있다(예: 매달린 쭉이에게 바닥의 대상을 시키면 떨어지기만 하고 끝난다. 한 번 더 눌러야 한다). M1 플레이테스트 확인 항목이다. (2) 상태 수가 예상보다 빨리 늘 수 있다. 10만 경고로 감시한다.
- 다시 검토할 조건: (1) 3상태 이상 NPC가 필요한 화면, (2) 화면 사이에 아이템을 넘기는 설계, (3) 효과를 가진 이벤트 트리거(`onFlag` 등)가 필요할 때, (4) 한 화면의 도달 가능 상태가 10만 개를 넘을 때.
