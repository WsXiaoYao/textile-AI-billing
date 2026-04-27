# 图标资源准备说明

整理日期：2026-04-27

## 图标来源

当前项目的工具型图标使用 Lucide Icons。

- 官网：https://lucide.dev/
- GitHub：https://github.com/lucide-icons/lucide
- 原始 SVG 直链示例：https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/house.svg
- 许可证：ISC

Lucide 是线性图标库，适合订单、客户、购物车、搜索、设置等工具型界面。它不是小程序组件库，只作为图标资产源。

## SVG 使用结论

小程序页面里的普通图标可以直接用 SVG。微信官方 `image` 组件支持 JPG、PNG、SVG、WEBP、GIF 等格式。

页面内用法示例：

```xml
<image class="icon" src="/assets/icons/lucide/source/search.svg" mode="aspectFit" />
```

```css
.icon {
  width: 40rpx;
  height: 40rpx;
}
```

SVG 注意事项：

- `image` 组件文档提到 SVG 在 `mode=scaleToFill` 下 WebView 和 Skyline 表现不同，页面图标建议用 `aspectFit`。
- SVG 不支持百分比单位。
- SVG 不支持 `<style>` element。
- 页面内图标需要变色时，优先生成不同颜色的 SVG，或使用组件/样式方案，不要依赖运行时改 SVG 内部颜色。

tabBar 图标暂时使用 PNG。原因是官方 `tabBar.iconPath` 文档只强调本地图片、40KB、81px * 81px、不支持网络图片，没有像 `image` 组件那样展开 SVG 限制。为保证底部导航稳定，当前策略是保留 SVG 源，同时生成 PNG 作为 tabBar 资源。

## 当前准备的图标

源码 SVG 放在 `assets/icons/lucide/source/`：

- `house`：首页 / 开单入口
- `receipt-text`：订单
- `clipboard-list`：订单备选
- `users`：客户
- `user`：我的
- `shopping-cart`：购物车
- `search`：搜索
- `settings`：设置
- `ellipsis`：更多
- `package`：商品
- `trash-2`：删除
- `plus`：新增
- `chevron-right`：进入详情

tabBar 资源放在 `assets/tabbar/`：

- `home.png` / `home-active.png`
- `orders.png` / `orders-active.png`
- `customers.png` / `customers-active.png`
- `profile.png` / `profile-active.png`

tabBar 对应的可审查 SVG 放在 `assets/tabbar/svg/`。

页面特殊色图标放在 `assets/icons/lucide/ui/`。例如首页蓝色区域使用白色购物车图标 `shopping-cart-white.svg`，避免依赖运行时 CSS 改 SVG 颜色。

## 颜色规则

- 普通态：`#7A869A`
- 选中态：`#1677FF`

后续如果品牌主色变化，只改 `tools/prepare-lucide-icons.js` 里的颜色并重新执行脚本。

## 生成命令

```bash
npm run icons:prepare
```

脚本会：

1. 从 Lucide GitHub raw 直链下载源码 SVG。
2. 为 tabBar 图标生成普通态和选中态 SVG。
3. 使用 macOS `qlmanage` 为 tabBar 生成 81px * 81px PNG。
4. 检查 tabBar PNG 是否超过 40KB。
5. 写入 `assets/icons/lucide/manifest.json`。

## 使用规则

- 页面内普通图标优先直接使用本地 SVG。
- 小程序 tabBar 暂时使用本地 PNG，不使用网络图片。
- 重要操作不能只有图标，必须配文字或在上下文中非常明确。
- 删除、提交、购物车、搜索、设置等图标全项目统一使用同一套来源。
- 引入新图标时先补充到 `tools/prepare-lucide-icons.js`，再重新生成。
