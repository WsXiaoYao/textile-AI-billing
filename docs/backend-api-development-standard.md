# 后端接口开发规范

本文档用于统一小程序后端接口开发方式，避免前端、小程序本地后端、正式后端字段不一致，也减少多人本地开发后的合并冲突。

## 当前后端构成

当前后端目录在 `backend/`，技术栈是：

| 层 | 文件/目录 | 说明 |
| --- | --- | --- |
| HTTP 服务 | `backend/src/server.js` | 启动 Fastify 服务 |
| 应用注册 | `backend/src/app.js` | 注册插件、路由、Prisma |
| 环境配置 | `backend/src/env.js` | 读取 `.env`，设置数据库和服务端口 |
| 数据库访问 | `backend/src/prisma.js` | 创建 Prisma Client |
| 统一响应 | `backend/src/response.js` | 输出 `{ code, message, data, traceId }` |
| 路由模块 | `backend/src/routes/*.js` | 按业务模块拆分接口 |
| 数据模型 | `backend/prisma/schema.prisma` | Prisma 数据模型 |
| 脚本 | `backend/scripts/*.js` | 数据初始化、中文注释、中文视图、烟测 |
| mock 兜底 | `backend/src/routes/mock-bridge.js` | 未真实化的接口继续走小程序 mock store |

当前真实化程度：

| 模块 | 状态 |
| --- | --- |
| 登录授权 | 已有真实本地后端骨架 |
| 客户 | 已接真实表 `customers` |
| 客户分类 | 已接真实表 `customer_categories` |
| 收款账户 | 已接真实表 `accounts` |
| 客户收款 | 已生成 `receipt_orders`、`receipt_order_items`、`fund_records` |
| 其他业务接口 | 暂由 `mock-bridge` 兜底 |

## 路由注册规则

所有接口统一挂在 `/api/v1` 下。

路由注册集中在 `backend/src/app.js`：

```js
app.register(authRoutes, { prefix: '/api/v1' })
app.register(accountRoutes, { prefix: '/api/v1' })
app.register(customerCategoryRoutes, { prefix: '/api/v1' })
app.register(customerRoutes, { prefix: '/api/v1' })
app.register(mockBridgeRoutes, { prefix: '/api/v1' })
```

新增真实接口时：

1. 在 `backend/src/routes/` 新建或修改对应模块文件。
2. 在 `backend/src/app.js` 注册路由。
3. 真实路由必须注册在 `mockBridgeRoutes` 前面。
4. 不要把新业务接口直接写进 `mock-bridge.js`。

## 文件拆分规则

一个业务模块一个路由文件：

| 业务 | 后端路由文件 | 前端 API 门面 |
| --- | --- | --- |
| 客户 | `backend/src/routes/customers.js` | `api/customer-api.js` |
| 客户分类 | `backend/src/routes/customer-categories.js` | `api/customer-category-api.js` |
| 收款账户 | `backend/src/routes/accounts.js` | `api/account-api.js` |
| 登录 | `backend/src/routes/auth.js` | `api/auth-api.js` |

新增模块建议同样成对增加：

```text
backend/src/routes/sales-orders.js
api/order-api.js
```

前端页面不直接拼 `wx.request`，统一走 `api/*-api.js`。

## 接口命名规则

路径使用 REST 风格，统一小写中划线，复数资源名。

| 动作 | 方法 | 路径示例 |
| --- | --- | --- |
| 列表 | `GET` | `/customers` |
| 详情 | `GET` | `/customers/:id` |
| 新增 | `POST` | `/customers` |
| 修改 | `PUT` | `/customers/:id` |
| 子资源列表 | `GET` | `/customers/:id/fund-records` |
| 业务动作 | `POST` | `/customers/:id/receipts` |
| 汇总 | `GET` | `/customers/summary` |

不要随意新增多个含义相近的路径，例如同一件事不要同时存在：

```text
POST /addCustomer
POST /customer/create
POST /customers
```

统一使用 `POST /customers`。

## 通用请求头

| Header | 必填 | 说明 |
| --- | --- | --- |
| `Authorization` | 登录后必填 | `Bearer <token>` |
| `X-Org-Id` | 必填 | 当前组织 ID 或组织 code |
| `X-Request-Id` | 写操作建议必填 | 前端生成，用于后续幂等 |

当前本地开发默认组织是 `org-main`。

## 统一响应格式

成功响应：

```json
{
  "code": 0,
  "message": "ok",
  "data": {},
  "traceId": "req-1"
}
```

失败响应：

```json
{
  "code": 400,
  "message": "请输入11位手机号",
  "data": {
    "errors": ["请输入11位手机号"]
  },
  "traceId": "req-1"
}
```

所有路由必须使用：

```js
const { ok, fail } = require('../response')
```

不要直接返回散乱结构：

```js
return { success: true }
```

## 分页格式

列表接口统一入参：

| 字段 | 说明 |
| --- | --- |
| `page` | 页码，从 1 开始 |
| `pageSize` | 每页数量，后端限制最大值 |
| `keyword` | 搜索关键字 |

列表接口统一出参：

```json
{
  "page": 1,
  "pageSize": 20,
  "total": 120,
  "hasMore": true,
  "list": []
}
```

## 字段命名规则

数据库真实字段优先使用后端表结构约定：

- 数据库列名：`snake_case`
- API 主字段：优先返回数据库真实字段，例如 `customer_name`
- 前端兼容字段：可额外返回 `name/category/receivableCents`，但只能作为展示兼容

客户模块当前规则：

| 数据库字段 | API 主字段 | 前端兼容字段 |
| --- | --- | --- |
| `customer_name` | `customer_name` | `name` |
| `customer_category_id` | `customer_category_id` | `categoryId` |
| `customer_category` | `customer_category` | `category/tag` |
| `opening_debt` | `opening_debt` | `openingReceivable` |
| `unpaid_amount` | `unpaid_amount` | `receivableCents/receivableText` |

新增接口不能只返回前端临时字段，必须保留真实字段。

## 金额规则

当前项目同时存在两种金额口径：

| 层 | 规则 |
| --- | --- |
| 数据库客户真实表 | `Decimal(18,2)`，单位是元 |
| 小程序展示和旧接口兼容字段 | 整数分，例如 `8866` 表示 `¥88.66` |

后端返回给小程序时，建议同时提供：

```json
{
  "unpaid_amount": "88.66",
  "receivableCents": 8866,
  "receivableText": "¥88.66"
}
```

写入时：

- 如果前端传 `openingReceivable: "88.66"`，后端写入 `opening_debt = 88.66`。
- 如果前端传 `openingReceivableCents: 8866`，后端转换为 `opening_debt = 88.66`。
- 新增客户时，期初欠款要同步初始化 `unpaid_amount`。

## 校验规则

前后端必须都有校验。

前端校验用于用户体验，后端校验用于数据安全。不能只做一边。

客户新增/编辑当前规则：

| 字段 | 前端校验 | 后端校验 |
| --- | --- | --- |
| 客户名称 | 必填，最多 120 字 | 必填，最多 120 字 |
| 联系电话 | 可空；填写时必须是 11 位手机号 | 同前端 |
| 客户分类 | 必选 | 必须存在且启用 |
| 详细地址 | 最多 255 字 | 最多 255 字 |
| 期初欠款 | 非负金额，最多 2 位小数 | 同前端 |
| 备注 | 最多 500 字 | 最多 500 字 |

后端校验函数建议放在同模块路由文件顶部，例如：

```js
async function validateCustomerPayload(prisma, orgId, payload, options = {}) {
  return { errors, payload }
}
```

写接口处理方式：

```js
const validation = await validateCustomerPayload(app.prisma, orgId, payload)
if (validation.errors.length) {
  reply.code(400)
  return fail(validation.errors[0], {
    code: 400,
    data: { errors: validation.errors },
    traceId: request.id
  })
}
```

## 组织隔离规则

所有业务数据查询必须带组织条件。

当前项目用 `X-Org-Id` 解析当前组织：

```js
const orgId = await resolveOrgId(app.prisma, request)
```

查询必须带组织：

```js
where: {
  org_id: orgId,
  is_active: true
}
```

禁止只按 ID 查询业务数据：

```js
where: { id: request.params.id }
```

正确写法：

```js
where: {
  id: BigInt(request.params.id),
  org_id: orgId
}
```

后续如果补 `tenant_id`，同样要变成 `tenant_id + org_id` 双条件。

## DTO 转换规则

数据库对象不要直接返回给前端。每个模块要有自己的 DTO 函数。

示例：

```js
function buildCustomerDto(customer) {
  return {
    id: String(customer.id),
    customer_name: customer.customer_name,
    name: customer.customer_name
  }
}
```

DTO 里做三件事：

1. BigInt 转字符串。
2. Decimal 转字符串或金额分。
3. 补前端展示兼容字段。

## 写操作事务规则

涉及多张表的写操作必须使用事务。

例如客户收款会同时更新：

- `customers`
- `accounts`
- `receipt_orders`
- `receipt_order_items`
- `fund_records`

必须写成：

```js
await app.prisma.$transaction(async tx => {
  await tx.customer.update(...)
  await tx.receiptOrder.create(...)
})
```

不要拆成多个独立 `await`，否则中间失败会出现脏数据。

## 数据库变更规则

当前本地阶段使用 Prisma：

```bash
npm --prefix backend run db:generate
npm --prefix backend run db:push
```

多人协作时建议：

1. 数据结构统一先改 `backend/prisma/schema.prisma`。
2. 字段名确定后再改接口和前端。
3. 表字段尽量使用 `snake_case` 映射，和后端同事 SQL 保持一致。
4. 不能随手删字段；需要兼容旧接口一段时间。
5. 涉及已有数据的字段改名，不要用重置数据库；要写迁移脚本或手动 `ALTER TABLE RENAME COLUMN`。

当前中文查看视图只用于查数据：

| 视图 | 说明 |
| --- | --- |
| `customers_cn` | 客户中文视图 |
| `customer_categories_cn` | 客户分类中文视图 |
| `accounts_cn` | 收款账户中文视图 |
| `receipt_orders_cn` | 收款单中文视图 |
| `receipt_order_items_cn` | 收款明细中文视图 |

视图不作为写入入口，不在 Navicat 里通过视图新增、删除、修改数据。

## 前后端联调规则

前端统一在 `config/env.js` 切换：

```js
API_MODE: 'http',
API_BASE_URL: 'http://127.0.0.1:3000/api/v1'
```

后端接口对应前端门面：

```js
// api/customer-api.js
listCustomers(params) {
  return dataRequest({ method: 'GET', url: '/customers', data: params })
}
```

页面只能调用 `api/*-api.js`，不能直接写请求路径。

## Mock 兜底规则

`mock-bridge` 的作用是让未真实化接口还能跑起来。

接口真实化时：

1. 新建真实路由。
2. 在 `app.js` 注册到 `mockBridgeRoutes` 前面。
3. 保持返回结构和前端当前期望一致。
4. 确认页面正常后，再逐步清理 mock store 里的旧逻辑。

不要在 `mock-bridge.js` 里继续堆真实业务。

## 测试与验收

每次改接口后至少跑：

```bash
npm run backend:smoke
npm run api:smoke
npm run wx:check
```

如果改了 Prisma schema：

```bash
npm --prefix backend run db:generate
npm --prefix backend run db:push
```

如果改了客户/分类/账户等中文字段：

```bash
npm run backend:comment:customers
npm run backend:view:customers-cn
```

如果改了产品表、SKU 表、产品中文视图或产品搜索索引：

```bash
npm run backend:setup:products
```

如果改了销售单、销售单明细或销售单中文视图：

```bash
npm run backend:setup:sales-orders
```

如果需要重置本地销售单模拟数据：

```bash
npm run backend:seed:sales-orders
```

新增写接口建议补一个 `app.inject` 验证脚本，至少验证：

1. 错误入参会返回 400。
2. 正确入参能写入。
3. 写入后能通过详情接口读到。
4. 测试数据会清理。

## 合并冲突约定

为了减少冲突，建议按模块分工：

| 同事 | 建议负责范围 |
| --- | --- |
| A | `backend/src/routes/customers.js`、`api/customer-api.js`、客户页面 |
| B | `backend/src/routes/sales-orders.js`、`api/order-api.js`、订单页面 |
| C | `backend/src/routes/products.js`、`api/product-api.js`、商品页面 |
| D | `backend/prisma/schema.prisma`、数据库脚本 |

协作规则：

1. 同一时间尽量不要多人同时改 `schema.prisma`。
2. 改 `app.js` 注册路由时，只追加自己的 `app.register` 一行。
3. 不要格式化整份大文件，只改自己负责的模块。
4. 新增字段先写到本规范或数据库差异文档，再改代码。
5. 提交前跑三件套：`backend:smoke`、`api:smoke`、`wx:check`。

## 新增接口 checklist

新增一个接口前，按这个顺序做：

1. 确认需求字段和数据库字段。
2. 如果需要新表或新字段，先改 `schema.prisma`。
3. 运行 `db:generate` 和 `db:push`。
4. 在 `backend/src/routes/<module>.js` 写路由。
5. 使用 `ok/fail` 返回统一格式。
6. 所有查询加组织条件。
7. 写接口加前后端校验。
8. 多表写入使用事务。
9. 写 DTO，不直接返回 Prisma 对象。
10. 在 `api/<module>-api.js` 增加前端门面。
11. 页面只调 API 门面。
12. 跑 smoke 和静态检查。

## 当前下一步建议

后端正式协作前，建议优先做三件事：

1. 把 `resolveOrgId`、金额转换、分页参数解析抽到公共工具，减少每个路由重复实现。
2. 把客户模块的校验规则整理成可复用 schema，后续产品、订单也照这个模式走。
3. 在补销售单真实接口前，先确认销售单字段命名是否按需求说明书统一为 `order_no/order_amount/contract_amount` 这一套。
