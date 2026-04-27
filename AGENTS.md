# Codex Project Memory

This repository is the WeChat Mini Program implementation for the textile order assistant. Before changing UI code, read and follow:

1. `docs/miniprogram-development-rules.md`
2. `docs/wechat-design-application-rules.md`
3. `docs/design-foundations.md`
4. Figma MCP design context and screenshot for the target node

## Non-Negotiable UI Rules

- Do not implement the Figma screenshot's fake phone status bar, WeChat capsule, home indicator, or custom bottom navigation.
- Use the native WeChat navigation bar and native `tabBar` from `app.json`.
- Convert Figma dimensions into mini-program layouts carefully. Figma `375px` frames map to `750rpx`, but component roots must stay responsive.
- Every custom component must define a `:host` style, normally:

```css
:host {
  display: block;
  width: 100%;
}
```

- Do not rely on a component's internal fixed width such as `702rpx` to make it fill a page. Let the page provide horizontal padding and let the component fill `100%`.
- Prefer flex layouts for mini-program UI. Do not use CSS Grid or `minmax()` for business rows because WeChat Mini Program rendering support is less predictable than browsers.
- Cards must not shrink, clip, or overlap key business data. Customer names, amounts, product names, quantities, and totals are priority content.
- Use `npm run wx:check` before reporting work as complete.

## Current Product Rules

- Bottom tabs are `首页 / 订单 / 客户 / 更多 / 我的`.
- Root tab pages should feel like native WeChat business tools: dense but readable, restrained, and focused on the task.
- The homepage task is `选客户 -> 输入 -> 识别 -> 确认购物车`.
- Do not automate or script-control WeChat DevTools GUI unless explicitly requested.
