# Pi adapter

This is a thin lifecycle adapter for Pi. It delegates task state to the `task-sync` CLI through the shared `adapter-contract` package and does not import the domain reducer.

Build and link the adapter from the repository root:

```bash
npm run build
npm link --workspace=@agent-task-sync/adapter-pi
```

Use `pi-hooks.json` as the configuration template. The executable reads one JSON object from stdin and writes one JSON result to stdout. It supports `session_start`, `pre_compact`, `stop`, and `handoff` dispatches.

Session start and compaction only read context. Stop and handoff return a candidate without writing until the input contains `confirmed: true`; CLI failures return `continue: true` with a warning so a Pi session is not blocked.
