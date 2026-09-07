# Changelog

All notable changes to Agent Task Sync are documented here.

## [0.2.0] - 2026-09-07

### Added

- A GitHub Release distribution with a standalone CLI and Codex, Claude Code, and Pi adapter entrypoints.
- Cross-platform CI coverage for macOS, Linux, and Windows on Node.js 20 and 22.
- Release version consistency checks, tarball generation, and SHA-256 checksum assets.
- `task-sync doctor` guidance for installation, project initialization, state worktrees, and offline mode.
- Explicit checkpoint and handoff recovery fields backed by append-only JSONL events.

### Changed

- Windows Git no-op commits, PATH casing, and CRLF fixtures are handled by regression coverage.
- The canonical Skill and every adapter continue to share one CLI and one state protocol.

### Known limitations

- npm registry publication is intentionally not part of this release.
- Real Windows hardware, real Agent UI lifecycle runs, and external user trials remain manual acceptance items.
- The tool does not store complete prompts, responses, tokens, credentials, `.env` files, or SSH keys.
