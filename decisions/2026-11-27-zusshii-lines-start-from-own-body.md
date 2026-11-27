---
schema: 1
id: ebed71b0-90a1-4a3e-8315-5d018e80f2d9
title: ズッシー가 물건의 변화를 말하는 대사는 자기 몸·동작에서 시작해 화자가 보이게 한다
status: accepted
accepted_via: pr-merge
decided_at: 2026-11-27
owner: "@zaffrex"
topic: ja-text-speaker-voice
scope: [content/text/ja.json, docs/design/ja-text.md, docs/design/screens/*.md]
revisit_when: 진마씨 플레이나 Mia 회차에서 ズッシー 줄의 화자를 또 헷갈리거나, 새 줄이 말투표와 어긋나게(설명조·ズッシー답지 않게) 읽힌다는 보고가 나올 때
origin:
  kind: agent-session
  agent: claude-code
links:
  - pr: zaffrex/goblin-crew#1007
  - issue: zaffrex/goblin-crew#935
---
## 결정
ズッシー가 물건의 변화를 말하는 줄은 자기 몸·동작에서 시작한다(`…頭に、靴下。` `…踏み直した。`). 물건만 말하는 `…` 독백(`…靴下と、ビンのフタ。` `…元に戻った。`)은 쓰지 않는다. 바로 자기 일을 말하는 줄(`…痛い。` `…得した。`)은 그대로 둔다. 규칙은 `docs/design/ja-text.md` 3절 표 아래 한 줄로 적었고, 성격 칸은 바꾸지 않았다(작가 L0).

첫 적용(PR #1007): `laundromat.reverse_first`·`reverse_again`·`forward`. 정답 길 줄 `reverse_key`는 화자 헷갈림 보고가 없고 클리어 시간 여유(H6 0.23초)가 빠듯해 두었다.

## 이유
#935에서 ズッシー의 `…` 독백이 까치 말이나 "화면 밖 목소리"로 읽힌 게 4번이었다(묶음 1 `reverse_first` 3/3, 휴대폰 1회 `reverse_first`·`forward`). 헷갈린 줄은 모두 물건만 말했고, 쿵과 대사 사이에 연출이 길었다. 자기 일을 말하는 줄은 Mia가 다 ズッシー로 맞혔다. 양말이 실제로 ズッシー 머리에 얹히는 장면이라 `頭に`가 말풍선 꼬리 없이도 화자를 가리킨다.

## 당시 상황과 제약
3화면 진마씨 요청(#792) 직전이라 그림 0칸, 대사만으로 고쳐야 했다. 팀에 일본어 원어민이 없다.

## 검토했지만 택하지 않은 안
- 말풍선 꼬리를 화자 얼굴 높이에 고정(`src/core/bubble.ts` `tailY`, Theo): 코어 코드 변경이고, Luna·Theo 대조 모두 꼬리보다 말투가 원인이라고 봤다.
- ズッシー 줄에 동료 이름 부르기를 넣기: 말하는 사람이 누구인지는 여전히 안 드러난다.
- `ビンのフタ`를 살린 13자 첫 줄(`…頭に靴下。ビンのフタも。`): 말풍선이 넓어져 이미 プピ를 덮던 자리를 더 덮는다. 병뚜껑은 S3 덤이라 대사에서 뺐다(Luna 확인 요청).