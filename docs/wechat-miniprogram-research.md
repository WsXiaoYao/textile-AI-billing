# 微信小程序开发资料总结

整理日期：2026-04-27

这份文档用于指导“纺织开单小工具”的后续落地。目标不是把 Figma 截图硬搬进小程序，而是按微信小程序的工程、组件、样式和设计规范，把设计拆成可维护的页面与组件。

## 1. 工程结构

微信小程序的基础工程由全局文件、页面文件、自定义组件和静态资源组成。

全局层：

- `app.json`：全局配置，包含 `pages`、`window`、`tabBar`、`usingComponents`、分包、主题等。
- `app.js`：小程序生命周期和全局数据。
- `app.wxss`：全局样式。
- `sitemap.json`：搜索收录相关配置。

页面层：

- 每个页面由同名的 `.json`、`.js`、`.wxml`、`.wxss` 四个文件组成。
- `app.json` 的 `pages` 只写页面路径，不写文件后缀。
- 未配置 `entryPagePath` 时，`pages` 数组第一项就是启动首页。
- 新增或删除页面时，必须同步维护 `app.json` 的 `pages`。

项目建议：

- 先保留一个最小入口页，等信息架构确定后再逐页创建。
- 不把测试脚本、截图、文档、设计产物放进小程序包。
- 后续可用 `packOptions.ignore` 排除 `docs/`、`tools/`、`artifacts/` 等非运行文件。

## 2. 页面与导航

小程序页面不应该自绘手机系统层。

必须剥离的 Figma 内容：

- 手机时间、电量、信号。
- 微信右上角胶囊菜单。
- 模拟手机刘海、系统状态栏、底部 Home Indicator。

保留并实现的内容：

- 业务标题、客户信息、订单信息、购物车、输入框、识别按钮、反馈状态等真实产品内容。

导航规则：

- 默认使用微信原生导航栏。
- 只有确实需要沉浸式顶部时，才讨论 `navigationStyle: custom`。
- 自定义导航会只保留右上角胶囊按钮，必须自己处理标题区、安全区、返回逻辑和适配，风险更高。
- tab 页使用原生 `tabBar`；详情页、编辑页、流程页使用普通页面跳转。

路由规则：

- `wx.navigateTo`：打开非 tabBar 页面。
- `wx.redirectTo`：替换当前非 tabBar 页面。
- `wx.switchTab`：切换到 tabBar 页面。
- `wx.reLaunch`：可打开任意页面。

tabBar 规则：

- `tabBar.list` 最少 2 个、最多 5 个。
- `pagePath` 必须先在 `pages` 中定义。
- tab 图标必须是本地图片，不能用网络图片。
- `iconPath` 和 `selectedIconPath` 单个图片限制 40KB，官方建议尺寸 81px * 81px。
- 设计指南建议 tab 不超过 4 项，且一个页面不要出现多组 tab。

## 3. WXML 写法

WXML 是小程序的结构层，结合基础组件、数据绑定和事件系统构建页面。

常用能力：

- 数据绑定：`{{ value }}`。
- 列表渲染：`wx:for`，必须配合稳定的 `wx:key`。
- 条件渲染：`wx:if`、`wx:elif`、`wx:else`。
- 事件绑定：如 `bindtap`、`bindinput`。
- 模板和引用：适合轻量复用，但复杂模块更适合自定义组件。

项目规则：

- WXML 先表达业务结构，不用大量空 view 堆视觉。
- 列表项必须有稳定 key，不能依赖数组下标当业务唯一标识。
- 页面命名和 class 命名以业务模块为主，例如 `customer-card`、`message-bubble`、`cart-summary`。
- 不在 WXML 里写 Figma 截图里的系统 UI。

## 4. WXSS 样式

WXSS 用于描述 WXML 组件样式，支持 CSS 大部分能力，并扩展 `rpx` 和 `@import`。

尺寸规则：

- 小程序规定屏幕宽度为 `750rpx`。
- 在 iPhone 6 基准下，`750rpx = 375px`，即 `1px = 2rpx`。
- 官方建议设计师可以用 iPhone 6 作为视觉稿标准。
- 微信设计指南还提到 375px 固定布局基准和 390px 响应式布局基准。

样式规则：

- 静态样式写在 class 中。
- `style` 只用于动态样式，因为运行时解析会影响渲染速度。
- `app.wxss` 是全局样式，页面 `.wxss` 是局部样式，并可覆盖相同选择器。
- 支持的常用选择器包括 `.class`、`#id`、元素选择器、并列选择器、`::before`、`::after`。

项目规则：

- 页面主布局使用 `rpx`、flex、明确的宽高约束，避免“看着差不多”的绝对定位。
- 文本、按钮、卡片、列表行都要考虑小屏挤压。
- 金额、数量、客户名、商品名是业务高频信息，优先保证可读。
- 全局只放 reset、颜色变量、字体基线、通用工具类；页面细节留在页面 wxss。
- 卡片圆角默认不超过 8px，除非设计明确要求。
- 具体颜色、字号、间距、按钮、标签等 token 见 `docs/design-foundations.md` 和 `styles/foundations.wxss`。

建议先建立设计 token：

- 主色：品牌蓝，用于主按钮、选中态、链接。
- 成功色：绿色，用于识别完成、可进入购物车。
- 警示色：红色，用于欠款、删除、错误。
- 中性色：正文、次级文字、边框、页面背景。
- 间距：8rpx、16rpx、24rpx、32rpx、48rpx。
- 字号：标题、正文、辅助文字、金额数字分别定义。

## 5. 基础组件

小程序优先使用官方基础组件，不要一开始就全自绘。

常用组件：

- 结构：`view`、`scroll-view`、`swiper`。
- 文本：`text`、`rich-text`。
- 表单：`button`、`input`、`textarea`、`picker`、`radio`、`checkbox`。
- 导航：`navigator`。
- 媒体：`image`。
- 图标：`icon`。

`scroll-view` 注意：

- 垂直滚动必须给 `scroll-view` 设置明确高度。
- 横向滚动在 WebView 下建议配合 `enable-flex`。
- 聊天消息区、客户横向切换、购物车明细可考虑使用 `scroll-view`，但不要让页面出现多层互相抢滚动的区域。

## 6. 自定义组件

自定义组件适合重复、稳定、边界清晰的 UI 模块。

组件结构：

- `component.json`：设置 `"component": true`。
- `component.wxml`：组件结构。
- `component.wxss`：组件样式。
- `component.js`：使用 `Component()` 注册组件，定义 `properties`、`data`、`methods`。

使用规则：

- 页面级 `usingComponents` 优先；`app.json` 全局组件只放几乎所有页面都会用的组件。
- 全局声明低频组件会影响启动性能和主包大小。
- 自定义组件标签名只能用小写字母、中划线、下划线。
- 自定义组件和项目根目录不要以 `wx-` 为前缀。
- 组件 WXSS 不应使用 ID 选择器、属性选择器、标签名选择器。
- 可复用组件优先使用样式隔离；需要外部定制时通过 `externalClasses` 暴露样式入口。

本项目优先抽的组件：

- `customer-card`：当前客户、标签、欠款/合同金额。
- `customer-tabs`：客户快速切换。
- `message-bubble`：识别语句或对话输入结果。
- `recognized-items`：识别出的商品列表。
- `order-item-row`：购物车/订单明细行。
- `money-summary`：合计、欠款、收款状态。
- `bottom-composer`：底部输入和识别按钮。

暂时不要抽的东西：

- 只出现一次的页面容器。
- 仍在探索的信息架构。
- 为了还原截图而存在的装饰性外壳。

## 7. 图标与资源

项目图标资源准备说明见 `docs/icon-assets.md`。

官方 `icon` 组件只适合少量状态图标，支持类型包括：

- `success`
- `success_no_circle`
- `info`
- `warn`
- `waiting`
- `cancel`
- `download`
- `search`
- `clear`

业务图标规则：

- tabBar 图标使用本地 PNG，控制在 40KB 内，建议 81px * 81px。
- 页面内业务图标优先统一成一套风格，不混用多套线宽、圆角和填充方式。
- 可评估使用 WeUI Miniprogram 或自己维护 `assets/icons/`。
- 暂不引入大型 UI 库，除非确认它能减少维护成本并且视觉符合纺织开单工具。

WeUI 结论：

- WeUI Miniprogram 是微信官方设计团队和小程序团队维护的扩展组件库，视觉与微信原生体验一致。
- 可作为表单、弹窗、反馈、基础控件的参考。
- 是否安装依赖后面再定；现阶段先把项目规则和页面结构理顺。

## 8. 设计规范要点

项目应用版规范见 `docs/wechat-design-application-rules.md`。

微信小程序设计指南的核心原则：

- 友好礼貌：页面有明确重点，减少无关干扰。
- 清晰明确：告诉用户当前在哪、能去哪、如何返回。
- 便捷优雅：减少输入，尽量用选择、识别、历史项和接口能力提升效率。
- 统一稳定：控件、导航、反馈方式保持一致。

导航与胶囊：

- 微信官方胶囊在右上角固定位置，不能自定义内容。
- 设计和开发都要给它留空间，不要把可点击按钮放得太近。
- 我们不在页面里画假胶囊。

反馈：

- 操作要有明确反馈。
- 长耗时要给加载状态。
- 同一页面不要同时出现多个加载动画。
- 错误提示要明确原因和可退路。

输入：

- 小程序输入成本高，尽量减少手打。
- 对“开单助手”来说，识别输入、客户切换、商品历史、规格建议都比纯键盘输入更重要。

触控：

- 可点击区域要足够大。
- 设计指南提到移动端合适点击区域的物理尺寸大致在 7mm 到 9mm。
- 按钮之间要留足间隔，避免误触。

视觉：

- 字体跟随系统字体。
- 常见字号可参考 22、17、15、14、12 pt 的层级。
- 列表、表单、按钮、图标优先参考微信/WeUI 的尺度和反馈。

## 9. 纺织开单工具的落地建议

信息架构先按“开单主链路”设计：

1. 选择或确认客户。
2. 输入自然语言开单内容。
3. 识别商品、规格、颜色、数量。
4. 用户确认购物车。
5. 生成订单。
6. 展示应收、欠款、收款状态。

建议页面：

- `pages/order-chat/index`：对话开单首页。
- `pages/cart/index`：购物车确认。
- `pages/orders/index`：订单列表。
- `pages/order-detail/index`：订单详情。
- `pages/customers/index`：客户列表。
- `pages/profile/index`：我的/设置。

建议 tab：

- 首页：开单。
- 订单：查单、详情入口。
- 客户：客户资料和欠款。
- 我的：设置、门店、同步状态。

首页实现边界：

- 使用原生导航标题，不画手机状态栏。
- 顶部业务区保留“聚云掌柜 / 销售助手 / 重置会话 / 购物车”这类内容，但需要避开胶囊。
- 客户卡、客户切换、识别消息、购物车摘要、底部输入区是首页核心。
- 底部 tab 如果使用原生 tabBar，就不要再在页面里手写一套固定底栏。

## 10. 验证策略

当前阶段只做静态验证：

- `npm run wx:check`
- JSON 解析检查。
- 页面四件套检查。
- 禁止旧的自绘手机头部、手写底栏、临时业务路由残留。

暂不做：

- 不自动控制微信开发者工具 GUI。
- 不自动调用开发者工具预览。
- 不用脚本反复拉起模拟器。

落地阶段建议：

- 每次只实现一个页面。
- 完成后让人手动在微信开发者工具编译。
- 用模拟器截图对照 Figma，并按本文档回查：系统 UI 是否剥离、组件是否合理、样式是否稳定、文字是否挤压。

## 11. 参考来源

- 微信开放文档：全局配置 `app.json`  
  https://developers.weixin.qq.com/miniprogram/dev/reference/configuration/app.html
- 微信开放文档：页面配置  
  https://developers.weixin.qq.com/miniprogram/dev/reference/configuration/page.html
- 微信开放文档：WXML  
  https://developers.weixin.qq.com/miniprogram/dev/framework/view/wxml/
- 微信开放文档：WXSS  
  https://developers.weixin.qq.com/miniprogram/dev/framework/view/wxss.html
- 微信开放文档：基础组件  
  https://developers.weixin.qq.com/miniprogram/dev/component/
- 微信开放文档：`scroll-view`  
  https://developers.weixin.qq.com/miniprogram/dev/component/scroll-view.html
- 微信开放文档：`icon`  
  https://developers.weixin.qq.com/miniprogram/dev/component/icon.html
- 微信开放文档：自定义组件  
  https://developers.weixin.qq.com/miniprogram/dev/framework/custom-component/
- 微信开放文档：页面路由  
  https://developers.weixin.qq.com/miniprogram/dev/framework/app-service/route.html
- 微信小程序设计指南  
  https://developers.weixin.qq.com/miniprogram/design/
- WeUI Miniprogram  
  https://github.com/wechat-miniprogram/weui-miniprogram
