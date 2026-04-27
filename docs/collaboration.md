# 多人协作说明

整理日期：2026-04-27

本文用于约定“纺织开单小工具”的多人开发方式。目标是让微信开发者工具、Git 仓库、Figma 设计稿和本地检查脚本保持一致。

## 代码来源

Git 远程仓库是唯一代码源。微信开发者工具的“源代码管理”可以作为 Git 的图形界面使用，但不要用压缩包、聊天文件、手动覆盖目录来同步代码。

推荐流程：

```text
Figma 设计稿
  -> 设计规范和组件拆分
  -> 功能分支开发
  -> 本地检查
  -> Pull Request / Merge Request
  -> 合并主分支
```

## 分支规则

- `main`：稳定主分支，只保留可预览、可上传体验版的代码。
- `feature/*`：功能开发，例如 `feature/home-order-page`。
- `fix/*`：问题修复，例如 `fix/home-layout-overlap`。
- `docs/*`：文档和规范整理。

开发前：

```bash
git pull
git checkout -b feature/your-task-name
```

提交前：

```bash
npm run wx:check
git status
```

## 提交内容

应该提交：

- `app.js`
- `app.json`
- `app.wxss`
- `pages/`
- `components/`，如果后续新增组件
- `assets/`
- `styles/`
- `tools/`
- `docs/`
- `project.config.json`
- `package.json`
- `package-lock.json`，如果后续引入依赖
- `sitemap.json`

不要提交：

- `project.private.config.json`
- `node_modules/`
- `miniprogram_npm/`
- 本地日志、缓存、临时文件
- 个人编辑器配置

## 设计落地规则

- 页面落地前先读取 Figma 节点，记录目标尺寸、颜色、间距、字号。
- 不要凭肉眼随意改样式；优先使用 `styles/foundations.wxss` 和 `docs/design-foundations.md`。
- 公共 UI 先抽组件，再多人分工。
- tabBar 图标使用 `assets/tabbar` 下的 PNG；页面内图标优先使用 `assets/icons/lucide`。

## 微信开发者工具

- 每个人都使用本目录作为项目根目录。
- `project.config.json` 作为团队共享配置。
- `project.private.config.json` 是个人本地配置，已被 `.gitignore` 排除。
- 体验版和正式版建议由固定负责人上传，避免版本混乱。

## 冲突处理

多人同时改同一个页面时最容易冲突。开始开发前先沟通文件归属：

- 页面容器：`pages/*`
- 客户信息卡：后续可拆到 `components/customer-card`
- 客户切换：后续可拆到 `components/customer-tabs`
- 订单识别卡：后续可拆到 `components/order-card`
- 底部输入栏：后续可拆到 `components/app-composer`

如果出现冲突，先确认业务意图，再手动合并。不要使用覆盖整个文件的方式解决冲突。

