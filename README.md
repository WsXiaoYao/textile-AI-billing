# 纺织开单小工具

聚云掌柜微信小程序项目，用于把 Figma 设计稿逐步落地为可维护的小程序页面、组件和业务交互。

## 项目结构

- `app.json`：全局页面、窗口、tabBar 配置。
- `app.wxss`：全局样式入口，已引入 `styles/foundations.wxss`。
- `pages/`：小程序页面。
- `assets/`：图标、tabBar 图片等静态资源。
- `styles/`：设计基础样式。
- `tools/`：本地脚本和静态检查工具。
- `docs/`：设计规范、开发规范和协作说明。

## 常用命令

```bash
npm run wx:check
npm run icons:prepare
```

## 开发流程

1. 使用微信开发者工具打开本目录。
2. 开发前先拉取远程最新代码。
3. 每个功能使用独立分支开发。
4. 提交前运行 `npm run wx:check`。
5. 通过 Pull Request / Merge Request 合并到主分支。

更多协作规则见 [docs/collaboration.md](docs/collaboration.md)。

