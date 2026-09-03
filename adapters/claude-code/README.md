# Claude Code adapter

This is a thin lifecycle and command adapter. It delegates task state to the `task-sync` CLI and does not import the domain reducer.

`claude-hooks.json` contains a settings skeleton for SessionStart, PreCompact, and Stop. The command files expose read-only status/context helpers. Checkpoint and handoff remain explicit, confirmed CLI writes.
