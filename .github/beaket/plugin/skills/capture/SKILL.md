---
name: capture
description: Use whenever this run settles a choice that weighed two or more alternatives, had its reason said in the task or by you, and affects code beyond the current task. Records the decision in decisions/ with the propose_decision tool, for you to commit with the change it belongs to.
---

# Recording decisions

This repository records its decisions in `decisions/`, one file per decision. When this run settles a decision, record it with `propose_decision` and commit the file it writes in the pull request of the change it belongs to. That pull request's review accepts the record with the change, and once it merges, later runs see the decision.

## Which choices are decisions

Record a decision when all three hold:

1. Two or more alternatives were on the table, named in the task or weighed by you.
2. The reason for the choice was said, in the task or by you.
3. The choice reaches beyond the task at hand: other modules, later work, a convention, an interface, infrastructure, a dependency.

Decisions:

- The job queue uses SQS FIFO rather than Kafka, because the team of two cannot run Kafka.
- Sessions stay in cookies, not JWTs, since sessions must be revocable on the server.
- From now on API errors are RFC 9457 problem details instead of ad hoc JSON, so clients parse one shape.

Not decisions:

- Naming a variable or a function inside the change at hand.
- Doing what a record in `decisions/`, or another decision document of this repository, already says.
- A choice with no alternative discussed, or no reason given.
- Temporary steps while debugging.

## When the decision is also written elsewhere

This repository may keep decision documents of its own, such as ADRs or a decision log, and its instructions may rank them above `decisions/`. If the decision is written in one of them, or you are writing it there in this change, the record only points to it:

- The decision section says in one sentence what was decided, and names the document's path.
- The reason section says only "See `<path>`."
- `links` holds `{ "url": "https://github.com/<owner>/<repo>/blob/<default branch>/<path>" }`.
- `scope` covers the code the decision governs, as usual. That is what shows the document to the agents that work on that code.

A record never restates or changes what such a document says.

## How to record

Call `propose_decision` on the beaket MCP server (`mcp__plugin_beaket_beaket__propose_decision`; if it is deferred, load it with ToolSearch first). It needs no approval. Pass:

- `via`: `"skill"`
- `session`: `"${CLAUDE_SESSION_ID}"`
- `title`: what was decided, one sentence in the language of the task, at most 120 characters.
- `slug`: a few English words in kebab-case for the file name, at most 60 characters.
- `topic`: a kebab-case subject shared by decisions about the same thing, such as `job-queue`.
- `scope`: globs relative to the repository root for the code the decision governs, or `[]`. Never a path in a home folder.
- `revisit_when`: the concrete condition under which the decision should be looked at again.
- `body`: Markdown in the language of the task with these `##` sections. Decision and reason are required; leave out the others when there is nothing to say.
  - context: `## 당시 상황과 제약` / `## 当時の状況と制約` / `## Context`
  - decision: `## 결정` / `## 決定` / `## Decision`
  - reason: `## 이유` / `## 理由` / `## Reason`
  - rejected alternatives: `## 검토했지만 택하지 않은 안` / `## 検討したが採らなかった案` / `## Rejected alternatives`
- `supersedes`, `related`, `conflicts`: ids of records in `decisions/` only. Leave them out otherwise.

For example, in Korean:

```
## 당시 상황과 제약
일 처리량은 수천 건 수준이고 운영 인원은 2명이다.

## 결정
작업 큐는 SQS FIFO를 쓴다.

## 이유
지금 처리량에 충분하고 운영 부담이 가장 적다.

## 검토했지만 택하지 않은 안
- Kafka: 리플레이는 매력적이지만 지금은 운영 비용이 이득보다 크다.
```

Never put a secret, a token or a path in someone's home folder in a record.

If the tool answers "The record was not written", fix each listed issue and call it again. If it says a decision is not in this branch's `decisions/`, bring the branch up to date with the default branch, then call it again. If the same decision changes later in the run, edit the file it wrote instead of calling it again.

## Then

Commit the record in the pull request of the change it belongs to, and name it in that pull request's description, one line per record. If the run settles a decision but changes no code, commit the record in a pull request of its own, as you would any other document.
