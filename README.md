# Agent Task Sync

轻量的多 Agent、多设备任务接续工具。目前仓库处于产品与原型验证阶段。

## 目录

```text
agent-task-sync/
├── docs/
│   ├── product/       # PRD 与产品设计
│   ├── architecture/  # 系统架构与模块契约
│   ├── prototype/     # 原型规格与交互说明
│   └── templates/     # 任务接续文档模板
├── design/
│   └── figma/exports/ # Figma 历史导出图
└── prototype/         # 可运行的 React 交互原型
```

## 主要文档

- [产品需求文档](docs/product/agent-task-sync-prd-v0.1.md)
- [产品设计草案](docs/product/agent-task-sync-design-draft.md)
- [原型规格 v0.2](docs/prototype/agent-task-sync-prototype-spec-v0.2.md)
- [系统架构设计 v0.1](docs/architecture/agent-task-sync-system-architecture-v0.1.md)
- [任务计划模板](docs/templates/agent-task-sync-task-plan-template.md)

## 运行原型

```bash
cd prototype
npm install
npm run dev
```
