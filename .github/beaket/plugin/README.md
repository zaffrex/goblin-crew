# Beaket experiment plugin (agent-team build)

A Claude Code plugin, in a closed trial. In a team of coding agents it:

- records the decisions a run settles, as files in `decisions/` that the agent commits with the change they belong to, so the pull request's review accepts them with the code;
- shows the recorded decisions that govern a file when an agent reads or edits it, and answers the agents' questions about them;
- stops a run once, at its end, when the run may have settled a decision it did not record.

It calls no network and writes nothing outside `decisions/` and `.git/beaket/`. [REVIEW.md](REVIEW.md) lists everything it does, with the commands that check it.

## Turning it on and off

The workflow that runs the agents loads it only when the repository variable `BEAKET_ENABLED` is `true`:

```yaml
claude_args: >-
  ...
  ${{ vars.BEAKET_ENABLED == 'true' && '--plugin-dir .github/beaket/plugin' || '' }}
```

Records name `zaffrex`, the GitHub login that owns the team's decisions, as their owner. This folder's `.mcp.json` sets it as `BEAKET_OWNER` for the plugin's MCP server, so the workflow passes nothing on.

Unset the variable, or set it to anything but `true`, and no run loads the plugin and the `Beaket decisions` check is skipped. The records already in `decisions/` stay, as plain files.

## Counting

`node .github/beaket/plugin/beaket.mjs metrics --repo . <folder>` prints the trial's weekly numbers from the events artifacts downloaded into `<folder>` and the history of `decisions/`. It sends nothing anywhere; [REVIEW.md](REVIEW.md) has the details.

## Where it comes from

Built from beaket/beaket@7d40212564e6 by `node plugin/publish.ts --agent-team`. Updates come as pull requests that change this folder, so the owner's review sees each one. The terms are in [LICENSE](LICENSE).
