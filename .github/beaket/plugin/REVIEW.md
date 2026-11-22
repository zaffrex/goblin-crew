# What this plugin does

For the review before it is turned on. Each statement holds for `beaket.mjs` as it is in this folder, and the commands below check it from this folder.

## The four criteria

### 1. No external network calls

The plugin starts one program, `git`, with the subcommands under "Programs", none of which reach a remote. Nothing fetches or pushes. The PreToolUse hook is an `echo` of a fixed line.

There is no `gh`, `fetch`, HTTP, TLS or socket module in the bundle:

```sh
grep -nE '"gh"|fetch\(|"node:(http|https|http2|net|tls|dgram)"' beaket.mjs   # prints nothing
```

### 2. No environment values or tokens read, logged or written

The bundle reads these variables, and no other:

| Variable | Why |
|---|---|
| `CLAUDE_PROJECT_DIR` | the repository Claude Code runs in |
| `CLAUDE_CODE_SESSION_ID` | the run's session id, for the event log and the records |
| `BEAKET_OWNER` | the GitHub login a record names as its owner. This folder's `.mcp.json` sets it, for the MCP server only |
| `LOG_TOKENS`, `LOG_STREAM` | debug switches of the bundled `yaml` library; set, they make it print what it parses. Leave them unset |

`hooks/hooks.json` and `.mcp.json` also use `CLAUDE_PLUGIN_ROOT` to find the bundle. No environment value is written to a file or printed. `git` inherits the environment, as any program Claude Code starts does.

```sh
grep -nE 'process\.env|env\.[A-Z_]+' beaket.mjs
```

Text that reaches a file is checked for secrets first. The turn file holds the run's prompt with anything shaped like a token, key or password replaced. A record with such a value is refused.

### 3. Files written

| Where | What | When |
|---|---|---|
| `decisions/<date>-<slug>.md` | a new record | `propose_decision` |
| `decisions/<file>.md` | `status: superseded` in a record a new one replaces | `propose_decision` with `supersedes` |
| `.git/beaket/turns/<session>.json` | the turn's prompt, secrets replaced, its start time, and a hash of HEAD and `git status` | each prompt; deleted at session end |
| `.git/beaket/shown/<session>.json` | the ids and titles of decisions already shown | each note or tool answer; deleted at session end |
| `.git/beaket/events.jsonl` | one line per event, below | each event |

Nothing else in the working tree is written. `.git/` is never committed, and on a runner it goes away with the runner. The plugin does not commit and does not touch pull requests: the agent commits the records, and writes the pull request's description itself.

### 4. The check workflow

`.github/workflows/beaket.yml`:

- has `permissions: {}`, and its one job has `contents: read`;
- checks out with `persist-credentials: false`;
- runs only when `BEAKET_ENABLED` is `true` and the pull request changes `decisions/`;
- runs `node .github/beaket/plugin/beaket.mjs check decisions`, which reads the folder and writes nothing.

It is informational. Do not make it a required check.

## Every hook and tool

| Hook or tool | When | Reads | Writes | Prints to Claude Code |
|---|---|---|---|---|
| PreToolUse | before one of the plugin's four tools | — | — | approval of that call |
| UserPromptSubmit | a prompt | HEAD and `git status` | the turn file | nothing |
| Stop | the run ends a turn | the turn file, the event log, `decisions/`, and `decisions/` on the default branch's last fetch | `gate`, `nudged`, `cited` events | once per session, when the turn changed a file or made a commit and may hold an unrecorded decision: a block whose reason asks to record it |
| PreCompact | before compaction | the event log, the records it names | — | what the summary should keep |
| SessionStart (`compact`) | after compaction | the same | — | which decisions to record if the summary has unrecorded ones |
| SessionEnd | the session ends | — | deletes the turn and shown files, `session-end` event | nothing |
| PostToolUse (`Read`, `Edit`, `Write`, `MultiEdit`, `Bash`) | a file was read or edited, or a shell command ran | for Bash, whether the command's words are files of the repository, and the files its globs match; then `decisions/`, and `decisions/` on the default branch's last fetch | the shown file, `shown` event | the recorded decisions that govern the file, or the files the command names, once each per session |
| `propose_decision` | the agent records a decision | `decisions/`, the default branch's last fetch | the record, a superseded record's status, `recorded` event | the file it wrote |
| `search_decisions`, `get_decision`, `check_paths` | the agent asks | `decisions/`, the default branch's last fetch | the shown file, `consulted` event | the matching decisions |

A hook that fails prints one line, `beaket: hook <event>: <message>`, and Claude Code goes on. A run's output keeps no hook's stderr, so it also logs `hook-failed` with the hook's name, and not the message, which can quote the run's text.

## Programs

`git -C <repository>` with:

- `rev-parse --path-format=absolute --git-common-dir` and `rev-parse --show-toplevel`
- `symbolic-ref -q refs/remotes/origin/HEAD`, and `rev-parse --verify -q` of `refs/remotes/origin/main` or `master`
- `rev-parse -q --verify HEAD` and `--no-optional-locks status --porcelain -z --untracked-files=all`, at each prompt and Stop
- `ls-tree -z <ref> -- decisions/` and `cat-file --batch`
- `ls-files -z --cached --others --exclude-standard -- :(glob)<glob>`, after a shell command with an unquoted `*`, `?` or `[`
- for `metrics` only: `log --first-parent --diff-merges=first-parent --reverse --no-renames --name-status <ref> -- decisions/`, and `cat-file --batch` of the records it names

```sh
grep -nE 'execFileSync|spawn|exec\(' beaket.mjs | grep -v '\.exec('
```

## The event log

Each line has `at` (the time), `event` and `session`, and holds no text from the run:

| Event | Other fields |
|---|---|
| `recorded` | `id`, `file`, `via`, `supersedes` |
| `shown` | `ids`, `path` |
| `consulted` | `tool`, `ids` |
| `cited` | `ids` |
| `gate`, `nudged` | — |
| `session-end` | `reason` |
| `hook-failed` | `hook`; no `session` if the hook failed before reading its input |

## Counting

`beaket.mjs metrics` counts the trial's weekly numbers. No hook or tool runs it; a person does:

```sh
gh run download -p 'beaket-events-*' -D ../beaket-events   # the events artifacts, one folder per run
node .github/beaket/plugin/beaket.mjs metrics --repo . ../beaket-events
```

It reads the event logs it is given and the history of `decisions/` on the default branch as of the last fetch, and prints tables (or JSON with `--json`). It fetches nothing and writes no file. Weeks start on Monday in the computer's time zone, which `TZ` sets.

## What the bundle holds

`beaket.mjs` is built by esbuild from `plugin/bin/direct.ts` of beaket/beaket@7d40212564e6, and is not minified. Comments of the form `// plugin/lib/…` start Beaket's code. `// node_modules/zod/…` starts zod 4.6.7, and `// node_modules/yaml/…` starts yaml 2.9.1. Neither library does any I/O, apart from yaml's two debug switches above.
