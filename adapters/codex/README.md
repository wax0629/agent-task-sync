# Codex adapter

This is a thin lifecycle adapter. It delegates task state to the `task-sync` CLI and does not import the domain reducer.

The `codex-hooks.json` file is a configuration skeleton for SessionStart, PreCompact, and Stop. The hook command reads a JSON input object from stdin and emits a JSON result. Hook failures return `continue: true` with a warning so they do not block a Codex session.
