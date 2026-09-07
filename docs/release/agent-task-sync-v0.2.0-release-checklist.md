# v0.2.0 Release Checklist

## 发布门禁

- [x] 根包、workspace 包、内部依赖和 lockfile 版本均为 `0.2.0`。
- [x] `LICENSE`、`CHANGELOG.md`、发布说明和本清单已入库。
- [x] `npm run check:release -- --version 0.2.0` 通过。
- [x] `npm test`、`npm run typecheck` 和 `npm run test:release` 通过。
- [x] macOS/Linux/Windows × Node 20/22 CI 通过。
- [ ] GitHub Release 上传 `.tgz` 和 `SHA256SUMS.txt`（合并后推送 `v0.2.0` tag 触发）。
- [x] Release notes 写明安装、升级、限制、验收证据和回滚。

## 不在本次发布门内

- [ ] npm registry publish：需要单独的账号授权和凭据，不作为本次成功条件。
- [ ] 实体 Windows、真实 Codex/Claude Code/Pi UI 生命周期和真实用户试用：按人工验收文档回传证据。

## 资产与回滚

- 资产命名：`agent-task-sync-0.2.0.tgz`、`SHA256SUMS.txt`。
- 校验：下载后先验证 SHA-256，再执行全局安装。
- 回滚：安装上一版 tarball；保留状态分支和 JSONL 事件，不删除或重写事实源。
