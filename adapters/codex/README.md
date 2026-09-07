# Codex adapter

This is a thin lifecycle adapter. It delegates task state to the `task-sync` CLI and does not import the domain reducer.

The `codex-hooks.json` file is a configuration skeleton for SessionStart, PreCompact, Stop, and Handoff. The hook command reads a JSON input object from stdin and emits a JSON result. Hook failures return `continue: true` with a warning so they do not block a Codex session.

When `taskId` is omitted, the shared CLI can recover the task selected by `task-sync task use` through the state worktree's `current-task` pointer. Stop and Handoff still require an explicit confirmed candidate before writing an event.
