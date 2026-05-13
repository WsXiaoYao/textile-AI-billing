# 聚云掌柜小程序项目交接说明

更新时间：2026-05-13  
项目目录：`/Users/xiaoyao/WeChatProjects/miniprogram-1`  
当前分支：`ws`

本文用于把当前小程序项目交接给下一位开发者。它侧重说明当前项目怎么跑、业务链路做到哪里、前后端怎么对接、数据库和权限怎么设计，以及继续开发时容易踩的坑。

## 1. 项目定位

本项目是一个面向纺织行业门店/批发场景的微信小程序，当前产品名为“聚云掌柜”，核心目标是让用户完成：

1. 客户建档与客户分类维护。
2. 首页对话式开单，识别客户和商品，生成销售单。
3. 销售单管理、收款、打印、退货。
4. 供应商、采购单、采购退货。
5. 仓库、库存总览、库存调整、库存预警。
6. 组织、员工、角色权限、收款码设置、消息中心。

当前阶段是本地真实后端开发阶段：小程序前端已经大面积从本地 mock/store 迁移到本地 Fastify + PostgreSQL 后端。正式线上后端还没有接入，当前服务跑在本机。

## 2. 技术栈

| 层 | 技术 | 说明 |
| --- | --- | --- |
| 小程序 | 原生微信小程序 | WXML/WXSS/JS，使用自定义 tabBar |
| 前端 API | `api/*.js` | 每个业务模块有独立 API 门面，统一走 `api/request.js` |
| 后端 | Fastify | 入口 `backend/src/server.js`，应用注册在 `backend/src/app.js` |
| ORM | Prisma | schema 在 `backend/prisma/schema.prisma` |
| 数据库 | PostgreSQL | 本地默认库 `textile_ai_billing` |
| Excel | `exceljs` | 当前客户导入支持 CSV/XLSX，导出为 CSV |
| 图标 | Lucide 静态 SVG/PNG | 资源在 `assets/icons/lucide`、`assets/tabbar` |

## 3. 目录结构

```text
miniprogram-1/
  api/                    小程序前端 API 门面
  assets/                 tabbar、图标、商品默认图
  backend/                本地真实后端
    prisma/schema.prisma  Prisma 数据模型
    scripts/              初始化、seed、修复脚本
    src/app.js            Fastify app、权限拦截、路由注册
    src/routes/           各业务模块接口
  components/             小程序通用组件
  custom-tab-bar/         权限动态 tabBar
  data/                   旧 seed/本地数据源
  docs/                   项目文档
  pages/                  小程序页面
  services/               旧本地 store 和部分页面兜底数据
  utils/                  登录态、权限、表单校验、tabbar 工具
```

重要文件：

| 文件 | 作用 |
| --- | --- |
| `config/env.js` | 小程序 API 地址配置，当前为 `http://192.168.1.172:3000/api/v1` |
| `api/request.js` | 前端统一请求入口 |
| `api/adapters/http-adapter.js` | 微信请求封装、token/header 注入 |
| `utils/auth-session.js` | 小程序端登录态缓存 |
| `utils/permissions.js` | 小程序端权限判断 |
| `utils/tabbar.js` | 根据权限过滤底部 tab |
| `backend/src/app.js` | 后端路由注册和权限拦截 |
| `backend/src/request-context.js` | 从 token/session 解析当前租户、组织、员工、权限 |
| `backend/src/permissions.js` | 后端角色、权限、数据范围定义 |
| `backend/src/auth-service.js` | 登录、模拟账号、租户和员工上下文 |

## 4. 本地运行

### 4.1 安装依赖

项目根目录：

```bash
npm install
npm --prefix backend install
```

### 4.2 数据库配置

后端默认读取 `backend/.env`，如果没有则使用：

```text
DATABASE_URL=postgresql://xiaoyao@127.0.0.1:5432/textile_ai_billing
HOST=127.0.0.1
PORT=3000
WECHAT_MOCK_LOGIN=true
AUTH_AUTO_PROVISION=true
```

如果换电脑，至少要确认 PostgreSQL 已启动，并且 `DATABASE_URL` 指向正确数据库。

### 4.3 同步数据库结构

```bash
npm run backend:db:generate
npm run backend:db:push
```

### 4.4 初始化演示数据

按当前项目状态，建议执行：

```bash
npm run backend:setup:tenants
npm --prefix backend run setup:permissions
npm run backend:seed:customer-categories
npm run backend:setup:products
npm run backend:setup:sales-orders
npm run backend:setup:inventory
npm run backend:seed:purchases
npm run backend:seed:returns
npm --prefix backend run reconcile:customers
```

说明：

- `setup:tenants` 创建多租户、组织、角色、员工、模拟账号。
- `setup:permissions` 补充权限演示账号。
- `setup:products` 导入产品和规格。
- `setup:inventory` 建库存余额。
- `reconcile:customers` 修正客户合同、已收、未收、预收汇总。

### 4.5 启动后端

开发时建议：

```bash
npm run backend:dev
```

普通启动：

```bash
npm run backend:start
```

如果要让微信开发者工具长期连接本机后端，当前机器可用以下方式常驻启动：

```bash
launchctl remove textile-ai-billing-backend 2>/dev/null || true
launchctl submit -l textile-ai-billing-backend -- /bin/zsh -lc \
  'cd /Users/xiaoyao/WeChatProjects/miniprogram-1/backend && exec /Users/xiaoyao/.openclaw/tools/node/bin/node src/server.js >> /tmp/textile-ai-billing-backend.log 2>&1'
```

检查后端是否在跑：

```bash
lsof -nP -iTCP:3000 -sTCP:LISTEN
curl http://192.168.1.172:3000/health
```

停止 launchctl 后端：

```bash
launchctl remove textile-ai-billing-backend
```

注意：如果微信开发者工具 Console 出现 `502 Bad Gateway`，优先检查 3000 端口是否还有后端进程。之前出现过普通后台 node 被执行环境回收，导致小程序请求 502。

### 4.6 小程序配置

微信开发者工具打开项目根目录：

```text
/Users/xiaoyao/WeChatProjects/miniprogram-1
```

真机调试时：

1. 电脑和手机要在同一个 Wi-Fi。
2. `config/env.js` 的 `API_BASE_URL` 要写电脑局域网 IP，例如 `http://192.168.1.172:3000/api/v1`。
3. 微信开发者工具真机调试面板勾选“局域网模式”。
4. 开发环境可勾选“不校验合法域名、web-view、TLS 版本以及 HTTPS 证书”。

## 5. 常用验证命令

```bash
# 小程序静态检查
npm run wx:check

# 后端烟测
npm run backend:smoke

# 后端健康检查
curl http://127.0.0.1:3000/health

# 模拟账号列表
curl http://127.0.0.1:3000/api/v1/auth/mock-options
```

当前已验证过：

- `npm run wx:check` 可通过。
- `npm run backend:smoke` 可通过。
- 登录接口 `/api/v1/auth/wechat-phone-login` 可用。
- 消息中心、库存预警、AI 识别、客户导出、审计日志接口已做过接口级验证。

## 6. 登录、租户、组织、员工

### 6.1 登录方式

小程序入口页是 `pages/login/index`。当前用于本地测试的主要方式是模拟登录：

1. 先选择测试租户。
2. 再选择该租户下的登录用户。
3. 点击“开发环境登录”。

正式微信手机号授权按钮保留，但本地阶段以 mock 登录为主。正式环境需要配置微信 `AppID/AppSecret` 并走微信手机号授权换取真实手机号。

### 6.2 当前模拟租户和账号

接口：`GET /api/v1/auth/mock-options`

当前主要账号：

| 租户 | 组织 | 手机号 | 角色 |
| --- | --- | --- | --- |
| 聚云掌柜主租户 | 聚云掌柜 | `1358270496` | 老板 |
| 聚云掌柜主租户 | 聚云掌柜 | `13333333331` | 业务员 |
| 聚云掌柜主租户 | 聚云掌柜 | `13333333332` | 采购 |
| 聚云掌柜主租户 | 聚云掌柜 | `13333333333` | 财务 |
| 聚云掌柜主租户 | 聚云掌柜 | `13333333334` | 仓管 |
| 聚云掌柜主租户 | 聚云掌柜 | `13333333335` | 采购、仓管组合 |
| 销售演示租户 | 销售演示组织 | `13800000001` | 业务员 |
| 仓库演示租户 | 仓库演示组织 | `13800000002` | 仓管 |
| 财务演示租户 | 财务演示组织 | `13800000003` | 财务 |

### 6.3 登录后缓存

小程序端登录态由 `utils/auth-session.js` 管理，主要缓存：

- `token`
- `user`
- `currentOrg`
- `employee`
- `permissions`
- `dataScope`
- `dataScopes`
- `expiresAt`

请求时由 `api/adapters/http-adapter.js` 自动带上：

- `Authorization: Bearer <token>`
- `X-Org-Id`

### 6.4 组织切换

页面：`pages/org-switch/index`  
接口：

- `GET /organizations`
- `POST /organizations/switch`

切换组织时后端会更新当前 `AuthSession` 的 `tenantId/orgId/employeeId`，前端会同步更新本地登录态。切换后，客户、订单、库存、消息、收款码等数据都应按当前组织重新加载。

## 7. 权限模型

后端权限定义在 `backend/src/permissions.js`。当前支持一个员工拥有多个角色，权限取并集，数据范围也支持交叉合并。

### 7.1 角色

| 角色 | 数据范围 | 主要权限 |
| --- | --- | --- |
| 老板 | `all` | 全模块 |
| 业务员 | `own_or_authorized` | 客户、销售、收款、退货、产品查看、库存查看、打印 |
| 采购 | `purchase_inventory` | 供应商、采购、产品查看、库存查看、仓库查看 |
| 财务 | `finance` | 客户、销售查询、收款、退货查询、账户、报表 |
| 仓管 | `warehouse` | 产品查看、库存、仓库、采购查询、退货查询、消息、打印 |

### 7.2 后端拦截

权限拦截在 `backend/src/app.js` 的 `preHandler`。接口会根据路径映射 required permission，例如：

| 路径 | 权限 |
| --- | --- |
| `/customers/*` | `customers:read/write` |
| `/sales-orders/*` | `sales:read/write` 或 `receipts:read/write` |
| `/return-orders/*` | `returns:read/write` |
| `/purchase-orders/*` | `purchase:read/write` |
| `/inventory/*` | `inventory:read/write` |
| `/employees/*` | `settings:read/write` |
| `/messages/*` | `messages:read` |
| `/ai/*` | `sales:write` |

`/profile/home` 只要求登录，不要求具体业务权限，因为所有角色都要能进入“我的”页。

### 7.3 前端 tab 权限

自定义 tabBar 在 `custom-tab-bar/`，可见 tab 由 `utils/tabbar.js` 决定：

| tab | 权限 |
| --- | --- |
| 首页 | `sales:write` |
| 订单 | `sales:read` |
| 客户 | `customers:read` |
| 更多 | 产品/库存/仓库/供应商/采购/退货/报表任一权限 |
| 我的 | 永远可见 |

不同角色登录后底部 tab 会不同。比如采购账号通常只看到“更多”和“我的”，财务账号可看到订单、客户、我的等。

## 8. 数据库结构

Prisma schema：`backend/prisma/schema.prisma`

核心模型：

| 模型 | 说明 |
| --- | --- |
| `Tenant` | 租户 |
| `Organization` | 组织 |
| `User` | 登录用户 |
| `AuthSession` | 登录 session |
| `UserOrgRel` | 用户和组织关系 |
| `Employee` | 员工 |
| `Role` / `EmployeeRole` | 角色和员工多角色 |
| `Warehouse` / `EmployeeWarehouse` | 仓库和员工仓库权限 |
| `OrgSetting` | 组织设置，含收款码 |
| `Customer` | 客户主档 |
| `CustomerCategory` | 客户分类 |
| `Account` | 收款账户 |
| `Product` / `ProductVariant` | 产品和规格/SKU |
| `InventoryBalance` | 库存余额 |
| `InventoryLedger` | 库存流水 |
| `SalesOrder` / `SalesOrderItem` | 销售单和明细 |
| `ReceiptOrder` / `ReceiptOrderItem` | 收款单和分摊 |
| `FundRecord` | 资金流水兼容层 |
| `Supplier` | 供应商 |
| `PurchaseOrder` / `PurchaseOrderItem` | 采购单和明细 |
| `ReturnOrder` / `ReturnOrderItem` | 退货单和明细 |
| `Message` | 消息中心 |
| `ImportExportTask` | 导入导出任务 |
| `AuditLog` | 审计日志 |

数据库中文视图：

- 已有 `customers_cn`，用于 Navicat 等工具查看中文字段。
- 相关脚本：`backend/scripts/create-customers-cn-view.js`

## 9. 后端路由模块

路由统一注册在 `backend/src/app.js`，统一前缀 `/api/v1`。

| 文件 | 资源 |
| --- | --- |
| `routes/auth.js` | 登录、mock 账号、当前登录人、退出 |
| `routes/organizations.js` | 组织列表、切换、我的页、组织收款码 |
| `routes/employees.js` | 员工列表、新增编辑、角色权限 |
| `routes/customers.js` | 客户、客户导入导出、客户收款、资金流水 |
| `routes/customer-categories.js` | 客户分类 |
| `routes/accounts.js` | 收款账户 |
| `routes/sales-orders.js` | 销售单、收款、打印 |
| `routes/returns.js` | 销售退货 |
| `routes/purchases.js` | 供应商、采购单、采购退货相关 |
| `routes/inventory.js` | 仓库、库存总览、库存调整 |
| `routes/messages.js` | 消息中心、库存预警、打印消息 |
| `routes/system.js` | 审计日志、通用导入导出任务 |
| `routes/ai.js` | 首页开单识别接口 |
| `routes/health.js` | 健康检查 |

旧的 `mock-bridge` 已删除；如果旧文档里还提到 `mock-bridge`，以当前代码为准。

## 10. 前端页面模块

### 10.1 登录

| 页面 | 说明 |
| --- | --- |
| `pages/login/index` | 当前启动页，支持选择测试租户和测试用户登录 |

### 10.2 首页开单

| 页面 | 说明 |
| --- | --- |
| `pages/index/index` | 首页对话开单、客户选择、商品识别、购物车 |
| `pages/index/order-confirm` | 下单确认页 |

当前首页识别会先请求 `POST /ai/sales-intent`，后端返回商品行后写入购物车；如果识别失败，仍有本地解析兜底。

### 10.3 客户

| 页面 | 说明 |
| --- | --- |
| `pages/customers/index` | 客户列表、筛选、懒加载 |
| `pages/customer-detail/index` | 客户详情、销售记录、资金流水 |
| `pages/customer-edit/index` | 新增/编辑客户 |
| `pages/customer-receipt/index` | 客户整体收款 |
| `pages/customer-import/index` | 客户导入导出 |
| `pages/customer-categories/index` | 客户分类维护 |

客户模块当前是真实后端数据。新增客户前后端都有校验，联系电话要求 11 位手机号。

### 10.4 销售单和收款

| 页面 | 说明 |
| --- | --- |
| `pages/orders/index` | 销售单列表、筛选、懒加载 |
| `pages/order-detail/index` | 销售单详情 |
| `pages/order-receipt/index` | 销售单收款 |
| `pages/fund-detail/index` | 资金流水详情 |

销售单创建会扣减库存、写库存流水、回写客户金额。销售单收款会生成收款单、收款分摊、资金流水，并回写销售单和客户余额。

### 10.5 更多、产品、供应商、采购、库存

| 页面 | 说明 |
| --- | --- |
| `pages/more/index` | 更多入口，按权限展示 |
| `pages/products/*` | 产品列表、编辑、分类、导入，部分仍有本地 store 兼容 |
| `pages/suppliers/*` | 供应商列表、编辑、详情 |
| `pages/purchase-orders/*` | 采购单列表、编辑、详情 |
| `pages/purchase-returns/*` | 采购退货列表、编辑、详情 |
| `pages/warehouses/*` | 仓库列表、编辑 |
| `pages/stock-summary/index` | 库存总览 |
| `pages/stock-adjust/index` | 库存调整 |

供应商、采购、采购退货、仓库、库存已经接真实后端。采购单提交会增加库存，库存调整会写库存流水。

### 10.6 我的、组织、员工、消息

| 页面 | 说明 |
| --- | --- |
| `pages/profile/index` | 我的页面，展示当前组织、角色、仓库权限 |
| `pages/org-switch/index` | 组织切换 |
| `pages/org-receipt-code/index` | 组织收款码设置 |
| `pages/employees/index` | 员工管理 |
| `pages/employee-edit/index` | 新增/编辑员工 |
| `pages/employee-roles/index` | 角色权限查看 |
| `pages/profile/message-center` | 消息中心 |
| `pages/profile/message-detail` | 消息详情 |

消息中心会展示：

- 库存预警。
- 打印消息。
- 组织切换提醒。

## 11. 关键业务链路

### 11.1 客户链路

```text
客户分类维护 -> 新增/编辑客户 -> 客户列表/详情 -> 客户整体收款 -> 资金流水
```

真实后端涉及：

- `CustomerCategory`
- `Customer`
- `ReceiptOrder`
- `ReceiptOrderItem`
- `FundRecord`

### 11.2 销售链路

```text
首页识别 -> 购物车 -> 确认下单 -> 销售单 -> 收款 -> 打印 -> 客户/资金/库存回写
```

下单后：

- 创建 `SalesOrder`
- 创建 `SalesOrderItem`
- 扣减 `InventoryBalance`
- 写 `InventoryLedger`，类型 `sales_out`
- 回写客户合同金额、未收金额等

收款后：

- 创建 `ReceiptOrder`
- 创建 `ReceiptOrderItem`
- 创建 `FundRecord`
- 回写销售单收款状态
- 回写客户余额

### 11.3 退货链路

```text
销售单 -> 退货单 -> 退货入库 -> 退款/计入预收 -> 客户/资金/库存回写
```

当前销售退货已接真实后端：

- 退货会增加库存。
- 如果选择退款，会生成负数收款单和负数资金流水。
- 如果选择计入预收，会增加客户预收余额。

### 11.4 采购和库存链路

```text
供应商 -> 采购单 -> 提交采购 -> 库存增加 -> 库存总览/调整/预警
```

采购单提交后：

- 写采购单和明细。
- 增加 `InventoryBalance`。
- 写 `InventoryLedger`，类型 `purchase_in`。
- 回写供应商采购金额。

库存调整后：

- 更新 `InventoryBalance`。
- 写 `InventoryLedger`，类型 `adjustment`。
- 不允许调整后库存小于 0。

库存预警：

- 库存页默认规则：库存大于 0 且小于等于 20 时，如果没有配置下限，则按低库存处理。
- 消息中心会按同一规则生成库存预警消息。

## 12. 导入导出、审计日志、AI 识别

### 12.1 客户导入导出

页面：`pages/customer-import/index`

接口：

- `GET /customers/import-export`
- `GET /customers/import-template`
- `GET /customers/export`
- `POST /customers/import-tasks`
- `GET /customers/import-tasks/:taskId`
- `PUT /customers/import-tasks/:taskId`

当前客户导入支持：

- CSV
- XLSX

导出当前为 CSV，Excel 可直接打开。

### 12.2 通用导入导出任务

接口：

- `GET /import-export/tasks`
- `POST /import-export/tasks`
- `GET /import-export/templates/:type`

当前主要用于留出系统级任务框架，真实批量解析主要还在客户模块里。

### 12.3 审计日志

接口：

- `GET /audit-logs`

帮助函数：`backend/src/audit-log.js`

目前已写入审计的操作包括：

- 组织切换。
- 销售单打印。
- 退货保存。
- 导入导出任务创建。

后续建议把客户、销售单、采购、库存调整等写操作也统一写审计。

### 12.4 AI 识别接口

接口：

- `POST /ai/sales-intent`

当前实现是后端规则识别，不是外部大模型。它会读取当前组织的客户、产品、规格数据，尝试从文本中匹配客户和商品，并返回首页购物车可用的数据结构。

后续如果接 OpenAI、通义、微信云托管等模型，建议保持接口入参与出参不变，只替换 `backend/src/routes/ai.js` 内部识别逻辑。

## 13. UI 和交互规范

已有设计规范：

- `docs/design-foundations.md`
- `docs/wechat-design-application-rules.md`
- `docs/miniprogram-development-rules.md`

当前约定：

1. 页面背景统一 `#F6F7F9`。
2. 业务对象使用白色卡片。
3. 蓝色只用于主操作、当前选中、链接，不要给普通列表卡片整圈蓝边。
4. 列表页要支持懒加载。
5. 列表页有回到顶部按钮，避免遮住自定义 tabBar。
6. 自定义 tabBar 已做权限动态显示，样式在 `custom-tab-bar/`。
7. 输入和编辑页必须做前后端校验。

## 14. 当前完成度

### 14.1 基本完成

| 模块 | 状态 |
| --- | --- |
| 登录模拟账号 | 已完成 |
| 多租户/组织/员工/角色 | 已完成基础链路 |
| 权限控制 | 已完成前端 tab 和后端接口拦截 |
| 客户 | 已真实后端化 |
| 客户分类 | 已真实后端化 |
| 客户收款 | 已真实后端化 |
| 销售单 | 已真实后端化 |
| 销售单收款 | 已真实后端化 |
| 销售退货 | 已真实后端化 |
| 供应商 | 已真实后端化 |
| 采购单 | 已真实后端化 |
| 采购退货 | 已真实后端化 |
| 仓库 | 已真实后端化 |
| 库存总览 | 已真实后端化 |
| 库存调整 | 已真实后端化 |
| 组织收款码 | 已按组织维度实现 |
| 员工管理 | 已实现基础维护 |
| 消息中心 | 已实现库存预警/打印/组织提醒 |
| 审计日志 | 已有基础接口和部分写入 |
| 客户导入导出 | 已实现 CSV/XLSX 导入、CSV 导出 |

### 14.2 部分完成或需要继续完善

| 模块 | 说明 |
| --- | --- |
| 产品管理 | 数据库有 `Product/ProductVariant`，AI 和库存使用真实产品；但产品管理页面仍有 `services/product-store.js` 兼容痕迹，需要继续梳理是否全部接真实接口 |
| 真正 AI 识别 | 当前是后端规则识别接口，未接外部大模型 |
| Excel 导出 | 当前客户导出是 CSV，Excel 可打开；如果要求 `.xlsx` 文件，需要继续用 `exceljs` 生成二进制并处理小程序下载 |
| 审计日志 | 只有部分写操作写审计，建议所有写操作统一接入 |
| 接口文档 | `docs/backend-api-reference.md` 已按当前真实后端路由补齐，产品独立路由、真正 AI、正式微信授权等后续项已单独标注 |
| 正式微信授权 | 页面和接口骨架有，本地阶段主要用模拟登录；正式发布前要配置微信 AppID/AppSecret 和合法域名 |

## 15. 继续开发注意事项

1. 不要再新增 mock 接口。当前 `api/adapters/mock-adapter.js` 和 `backend/src/routes/mock-bridge.js` 已删除。
2. `services/*-store.js` 里还有一些旧本地数据和兜底逻辑，新增真实模块时要逐步替换，而不是继续扩展 store。
3. 新增接口必须走 `ok()` / `fail()` 统一响应。
4. 写接口必须同时做后端校验，前端校验只负责用户体验。
5. 所有组织数据必须带 `orgId` 或从登录 session 的当前组织解析。
6. 多角色员工的权限是并集，不能只看 `employee.roleId`。
7. 仓库权限要看 `warehouseIds`，采购/库存/仓库相关接口尤其要注意。
8. 金额在数据库多为 Decimal 元，前端展示/兼容字段里有整数分，新增字段时要写清楚单位。
9. 列表接口必须支持分页，不能一次性加载全量。
10. 真机调试时本机 IP 变化后，要更新 `config/env.js`。

## 16. 常见问题

### 16.1 微信开发者工具提示 502

原因通常是本地后端没跑或退出了。

检查：

```bash
lsof -nP -iTCP:3000 -sTCP:LISTEN
curl http://192.168.1.172:3000/health
```

如果没有监听，重新启动后端。

### 16.2 真机提示连接失败

检查：

1. 手机和电脑是否同一 Wi-Fi。
2. `config/env.js` 是否是电脑当前局域网 IP。
3. 微信开发者工具是否开启局域网模式。
4. 后端是否监听 `0.0.0.0` 或当前局域网地址。当前日志中应能看到 `Server listening at http://192.168.1.172:3000`。

### 16.3 `Route ... not found`

说明前端请求到了后端，但当前后端进程里没有这个路由。一般是后端旧进程未重启。

处理：

```bash
launchctl remove textile-ai-billing-backend
npm run backend:dev
```

或者重新按 4.5 的常驻方式启动。

### 16.4 tabBar 根据权限显示不对

检查：

- 登录接口返回的 `permissions` 是否正确。
- `utils/auth-session.js` 是否缓存了新登录态。
- `utils/tabbar.js` 的 `tabItems` 权限是否需要调整。
- 页面 `onShow` 是否调用了 `guardTabAccess` 或刷新 tabBar。

### 16.5 客户/订单/库存数据和当前组织不一致

检查：

- 是否刚切换组织但没有刷新页面。
- `AuthSession` 的 `orgId` 是否更新。
- 请求 header 中 `Authorization` 是否是最新 token。
- 前端是否仍有 store 兜底数据参与展示。

## 17. 已有文档索引

| 文档 | 说明 |
| --- | --- |
| `README.md` | 页面和接口整体草案，内容较多，部分可能是早期规划 |
| `backend/README.md` | 后端本地说明 |
| `docs/backend-api-reference.md` | 后端接口文档 |
| `docs/backend-api-development-standard.md` | 后端接口开发规范，部分 mock-bridge 描述已过时 |
| `docs/database-requirement-gap.md` | 数据库字段和需求说明书差异 |
| `docs/design-foundations.md` | 当前 UI 基础规范 |
| `docs/collaboration.md` | 多人协作说明 |
| `docs/wechat-design-application-rules.md` | 微信小程序设计应用规则 |

## 18. 建议交接顺序

给下一位开发者交接时，建议按这个顺序讲：

1. 先讲业务链路：客户 -> 首页下单 -> 销售单 -> 收款 -> 退货 -> 库存。
2. 再讲登录和权限：租户、组织、员工、角色、动态 tab。
3. 然后讲数据库模型和后端路由。
4. 再演示本地启动、模拟登录和真机调试。
5. 最后说明仍需完善的部分：产品管理全真实化、真正 AI、审计全覆盖、正式微信授权。

## 19. 当前接手人优先检查清单

接手后建议先做这几件事：

1. 跑 `npm run wx:check`。
2. 跑 `npm run backend:smoke`。
3. 用老板账号 `1358270496` 登录，检查首页、订单、客户、更多、我的。
4. 用采购账号 `13333333332` 登录，检查 tab 权限和采购/库存链路。
5. 用财务账号 `13333333333` 登录，检查客户、订单、收款权限。
6. 新增一个客户，确认列表和数据库都能看到。
7. 从首页下一个销售单，确认库存扣减。
8. 对销售单收款，确认资金流水。
9. 做一笔退货退款，确认负数收款单和库存回补。
10. 提交一笔采购单，确认库存增加。
