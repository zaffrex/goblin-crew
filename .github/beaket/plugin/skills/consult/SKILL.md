---
name: consult
description: Use before choosing between alternatives that reach beyond the current task, before changing code in an area you have not looked at in this run, when reviewing a change, and when the task asks why something is the way it is or whether it was decided. Looks up the decisions this repository recorded in decisions/, follows them, and says so in the pull request when the task goes against one.
---

# Consulting recorded decisions

This repository records its decisions in `decisions/`, one file per decision, committed with the change they belong to. They are what the team settled, with the reason and the alternatives it turned down. Use them before you settle the same thing again.

Three tools on the beaket MCP server read them. They need no approval; if they are deferred, load them with ToolSearch first.

- `search_decisions` (`mcp__plugin_beaket_beaket__search_decisions`): by words. Use words the records are likely written in, which is usually the team's language; if nothing matches, try English or a shorter word.
- `check_paths` (`mcp__plugin_beaket_beaket__check_paths`): the decisions whose scope covers files.
- `get_decision` (`mcp__plugin_beaket_beaket__get_decision`): one whole record, by its id or its first 8 characters.

Read records with these tools rather than opening the files in `decisions/` yourself: they also have the records merged into the default branch since this branch was cut, and they let the team count which decisions get used.

Reading or editing a file, with the file tools or in a shell command such as `cat` or `git show`, also shows you the decisions that cover it, unasked, in a note that starts "Beaket: recorded decisions govern". Each decision shows once per run.

## When to look

- **Before choosing between alternatives** that reach beyond the task, such as a library, a protocol, a data shape, a convention or a piece of infrastructure: `search_decisions` on the subject.
- **Before changing code in an area you have not looked at in this run:** `check_paths` with the files you are about to change, unless a Beaket note already showed you their decisions.
- **When reviewing a change:** `check_paths` with the files it changes, and judge it against those decisions.
- **When the task asks why something is the way it is, or whether it was decided:** `search_decisions`, then `get_decision` for the record that answers it. Answer from the record, and name it by its title.

Skip it for a change that stays inside one function, and for subjects you already looked up in this run.

## Following a decision

Do what an accepted decision says, without remarking on it. Following a recorded decision is not a new decision, so record nothing for it.

A record that only points to another document of this repository, such as an ADR, stands for that document: read it and follow it. If this repository's instructions rank its own decision documents above `decisions/`, follow those instructions where the two disagree.

A superseded or rejected decision is history. Follow the decision that superseded it; the tools say which one.

## When the task goes against a decision

1. Do what the task asks. Do not stop to ask whether to go ahead.
2. Going against a recorded decision is a new decision. Record it at once with `propose_decision` (`mcp__plugin_beaket_beaket__propose_decision`), as the `capture` skill says, with `via: "skill"`, `session: "${CLAUDE_SESSION_ID}"` and `supersedes` set to the old decision's full id. Its reason is the one the task gives; if it gives none, write that the task chose this without saying why, so reviewers see it.
3. Commit the new record and the old one, which the tool marks superseded, with the change. In the pull request's description and in your reply, say in one or two sentences that the change overturns the recorded decision, naming it by its title and the first 8 characters of its id.

A decision's scope can cover a file that its subject does not touch. If the task has nothing to do with what the decision is about, it does not go against it: say nothing.
