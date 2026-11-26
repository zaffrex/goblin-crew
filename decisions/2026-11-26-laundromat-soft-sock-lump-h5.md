---
schema: 1
id: 1cf32b2c-d97b-4963-948c-eb4bd45775c1
title: 빨래방 ★① 첫 판의 말랑한 양말 혹(duct.sock_through)은 둥근 2칸·580ms로 두고, H5 검사에 burst·sock_head와 함께 센다
status: accepted
accepted_via: pr-merge
decided_at: 2026-11-26
owner: "@zaffrex"
topic: laundromat-duct-lump
scope: [art/scenes/laundromat.objects.mjs, art/scenes/laundromat.mjs, tests/art/laundromat-timing.test.ts, docs/design/screens/laundromat-duct-lump-preview.mjs, docs/design/screens/laundromat-dryer-burst-preview.mjs]
related: [3d7bd2be-3c2e-42e6-ad9d-5ce01cdcb74a, 6182ce95-8bd8-4be7-b960-0f64e9a2021d]
revisit_when: Kai S3 PR의 Theo replay에서 ★① 첫 판이 H5를 넘거나, 묶음 2에서 혹(가로 구간)을 못 봤다는 말이 나오면
origin:
  kind: agent-session
  agent: claude-code
links:
  - issue: zaffrex/goblin-crew#935
  - pr: zaffrex/goblin-crew#992
---
## 결정
- 스테이지 3 `laundromat` ★① 첫 판(`dryer_reverse`)에 쓰는 양말 혹 `duct.sock_through`는 새 손그림 2칸(`lumpSoftH` 22×16, `lumpSoftV` 18×22)이다. 어깨가 둥글고 2px만 부풀며 패 모서리 반짝(white)이 없다. 열쇠 혹(각진 어깨, 3·4px, 반짝 1px)과 모양으로 대비한다.
- 길은 `lump_travel`과 같다(가로 110·188·268·330 → 세로 96). 걸림 자리 150에서 멈추지 않고 158·173으로 건조기 뒤로 들어간다. 7칸, ms `[100, 80×6]` = 580ms다.
- `tests/art/laundromat-timing.test.ts` ★① 첫 판 검사는 시트에 `duct.sock_through`가 있으면 `burst + sock_head + sock_through ≤ 1500`(H5)으로 센다. 지금은 570 + 330 + 580 = 1480이다.
- `burst` 3번째 칸의 병뚜껑은 378,152(덕트 오른쪽 벽 cotton 앞)에 띄운다. 칸 수는 그대로다.

## 이유
- PM이 #935 묶음 1 판정에서 안 (나) "말랑한 혹"을 골랐다. 각진 `lump_travel`을 재사용하면 S5(패가 넓다)가 흐려지고, 마지막 칸이 걸린 혹이라 ★③ 자리에서 혹이 사라지는 것처럼 보인다.
- 처음 적은 0.82초(8칸)는 시트 합이 1720ms라 H5를 넘었다. 혹은 S3 단서지만, 같은 show에 붙은 연출이라 H5 안에 두는 쪽을 골랐다. 첫 칸을 짧게(100ms) 한 것은 그림 뜻과도 맞다. 가벼운 양말은 휙 지나가고, 패가 든 열쇠 혹만 창 쪽에서 버틴다.
- 병뚜껑은 윗판(364,172)에서 다이얼과 같은 회색 동그라미로 묻혔다(1-3 다시 후보 15). 벽 앞이면 ink 외곽선과 은색 몸이 같이 읽힌다.

## 검토했지만 택하지 않은 안
- (가) 각진 혹 `lump_through` 0칸: S5가 흐려져 PM이 버렸다.
- 820ms 그대로 두고 H5 판단을 Kai PR에 미루기: 상한을 넘는 걸 알면서 main에 넣게 된다.
- H5 검사에서 혹을 "단서라서" 빼기: 무엇이 붙인 엉뚱함인지는 Kai·Theo가 replay로 정할 일이라, 지금은 보수적으로 센다.