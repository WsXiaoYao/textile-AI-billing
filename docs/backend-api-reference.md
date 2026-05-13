# 聚云掌柜小程序后端接口文档

版本：v0.2  
更新时间：2026-05-13  
适用项目：`纺织开单小工具` 微信小程序本地后端  
服务目录：`backend/`  
接口前缀：`/api/v1`

本文档用于前端、小程序本地后端、正式后端同事之间统一接口约定。接口文档结构参考 REST API 文档常见写法：先定义全局约定，再按资源模块列出接口、参数、响应和错误格式。

参考资料：

- [Postman REST API Best Practices](https://blog.postman.com/rest-api-best-practices/)
- [SPS REST API Standards - Request & Response](https://spscommerce.github.io/sps-api-standards/standards/request-response.html)
- [OpenAPI Specification](https://swagger.io/specification/)

## 1. 环境信息

| 项 | 本地开发值 |
| --- | --- |
| Base URL | `http://127.0.0.1:3000/api/v1` 或局域网 IP，例如 `http://192.168.1.172:3000/api/v1` |
| Health URL | `http://127.0.0.1:3000/health` |
| 数据库 | PostgreSQL |
| ORM | Prisma |
| 默认组织 | `org-main` |
| 响应格式 | `{ code, message, data, traceId }` |

前端配置位置：

```js
// config/env.js
API_BASE_URL: 'http://127.0.0.1:3000/api/v1'
DEFAULT_ORG_ID: 'org-main'
```

真机调试时必须把 `API_BASE_URL` 改成电脑当前局域网 IP，不能使用手机无法访问的 `127.0.0.1`。

微信开发者工具本地联调时，需要勾选：

```text
不校验合法域名、web-view、TLS 版本以及 HTTPS 证书
```

## 2. 通用请求头

| Header | 必填 | 示例 | 说明 |
| --- | --- | --- | --- |
| `content-type` | 是 | `application/json` | 当前接口统一使用 JSON |
| `X-Org-Id` | 是 | `org-main` | 当前组织 ID 或组织 code |
| `X-Request-Id` | 建议 | `req_202605110001` | 请求追踪，后续可扩展幂等 |
| `Authorization` | 登录后必填 | `Bearer <token>` | 登录态接口使用 |

前端已经在 `api/adapters/http-adapter.js` 中统一携带 `X-Org-Id`、`X-Request-Id` 和登录 token，页面不要直接写 `wx.request`。

## 3. 通用响应格式

### 3.1 成功响应

```json
{
  "code": 0,
  "message": "ok",
  "data": {},
  "traceId": "req-1"
}
```

前端 `dataRequest` 会自动返回 `response.data`，因此页面里拿到的是 `data` 内容，不是外层 envelope。

### 3.2 失败响应

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

### 3.3 HTTP 状态码

| 状态码 | 场景 |
| --- | --- |
| `200` | 请求成功 |
| `400` | 参数校验失败或业务规则不满足 |
| `401` | 未登录或 token 过期 |
| `403` | 没有权限 |
| `404` | 资源不存在 |
| `409` | 唯一键冲突，例如名称重复 |
| `500` | 服务端异常 |

## 4. 通用分页格式

列表入参：

| 参数 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `page` | number | `1` | 页码，从 1 开始 |
| `pageSize` | number | `20` | 每页数量 |
| `keyword` | string | 空 | 搜索关键字 |

列表出参：

```json
{
  "page": 1,
  "pageSize": 20,
  "total": 2275,
  "hasMore": true,
  "list": []
}
```

## 5. 字段和金额约定

### 5.1 字段命名

数据库字段以真实表结构为准，接口返回时允许同时返回数据库字段和前端展示字段。

示例：

```json
{
  "customer_name": "黔西-龙凤",
  "name": "黔西-龙凤",
  "customer_category_id": "cmp0ueee7000eys5ovtn8vnsy",
  "categoryId": "cmp0ueee7000eys5ovtn8vnsy"
}
```

新增接口规则：

- 数据库真实字段不能丢。
- 前端兼容字段可以保留，但不能只返回临时字段。
- 同一业务字段不能在不同接口里换名字。

### 5.2 金额

| 层 | 规则 |
| --- | --- |
| 数据库 Decimal 字段 | 单位：元，保留 2 位小数 |
| 前端 cents 字段 | 单位：分，整数 |
| 展示文本 | `¥88.66` |

示例：

```json
{
  "unpaid_amount": "88.66",
  "receivableCents": 8866,
  "receivableText": "¥88.66"
}
```

### 5.3 数量

库存、销售明细、采购明细数量使用数字，数据库存 Decimal。

```json
{
  "quantity": 12.5,
  "quantityText": "12.5 米"
}
```

## 6. 健康检查

### GET `/health`

用于检查服务和数据库是否正常。

响应示例：

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "service": "textile-ai-billing-backend",
    "status": "ok",
    "database": "ok",
    "time": "2026-05-11T13:51:34.535Z"
  },
  "traceId": "req-1"
}
```

## 7. 登录认证

### GET `/auth/mock-options`

获取本地模拟登录可选租户和账号。用于 `pages/login/index` 的租户/账号下拉列表。

响应 `data`：

```json
{
  "enabled": true,
  "tenants": [
    {
      "code": "tenant-juyun-main",
      "name": "聚云掌柜主租户",
      "orgCode": "org-main",
      "orgName": "聚云掌柜",
      "accounts": [
        {
          "label": "老板账号",
          "phone": "1358270496",
          "role": "老板",
          "org": "聚云掌柜",
          "tenantCode": "tenant-juyun-main",
          "desc": "绑定仓库 1"
        }
      ]
    }
  ]
}
```

### POST `/auth/wechat-phone-login`

微信手机号授权登录。本地开发允许 mock 手机号。

请求体：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `phoneCode` | string | 否 | 微信手机号授权 code |
| `loginCode` | string | 否 | `wx.login` 返回 code |
| `mockPhone` | string | 否 | 本地 mock 手机号 |
| `phone` | string | 否 | 本地 mock 手机号 |
| `tenantCode` | string | 否 | 本地模拟登录时指定租户 |
| `orgCode` | string | 否 | 本地模拟登录时指定组织 |

请求示例：

```json
{
  "mockPhone": "1358270496",
  "tenantCode": "tenant-juyun-main",
  "loginCode": "local"
}
```

响应 `data` 关键字段：

| 字段 | 说明 |
| --- | --- |
| `token` | 后续接口 `Authorization` 使用 |
| `expiresAt` | token 过期时间 |
| `user` | 当前用户 |
| `currentOrg` | 当前组织 |
| `employee` | 员工信息 |
| `permissions` | 权限列表 |

### GET `/auth/me`

获取当前登录态。

请求头：

```text
Authorization: Bearer <token>
```

### POST `/auth/logout`

退出登录。

响应 `data`：

```json
{
  "loggedOut": true
}
```

## 8. 客户分类

### GET `/customer-categories`

查询客户分类。

Query：

| 参数 | 类型 | 说明 |
| --- | --- | --- |
| `keyword` | string | 分类名称搜索 |
| `includeInactive` | boolean | 是否包含停用分类 |

响应 `data`：

```json
{
  "summary": {
    "categoryCount": 11,
    "activeCount": 11,
    "customerCount": 2275
  },
  "list": [
    {
      "id": "cmp0ueee7000eys5ovtn8vnsy",
      "name": "贵州客户",
      "sortOrder": 10,
      "isActive": true,
      "isDefault": false,
      "customerCount": 120
    }
  ]
}
```

### POST `/customer-categories`

新增客户分类。

请求体：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `name` | string | 是 | 分类名称 |
| `sortOrder` / `sort_order` | number | 否 | 排序 |
| `isActive` / `is_active` | boolean | 否 | 是否启用 |
| `isDefault` / `is_default` | boolean | 否 | 是否默认 |

### PUT `/customer-categories/:id`

编辑客户分类。字段同新增。

## 9. 客户

### GET `/customers/summary`

客户汇总统计。

常用 Query：

| 参数 | 说明 |
| --- | --- |
| `keyword` | 客户名、电话、地区搜索 |
| `statusKey` | `all`、`debt`、`settled`、`prepaid` |
| `dateFrom` / `dateTo` | 最近下单日期区间 |

### GET `/customers`

客户列表。

常用 Query：

| 参数 | 类型 | 说明 |
| --- | --- | --- |
| `page` | number | 页码 |
| `pageSize` | number | 每页数量 |
| `keyword` | string | 客户名、电话、地区 |
| `statusKey` | string | 客户款项状态 |
| `sortKey` | string | 排序 |
| `categoryId` | string | 客户分类 ID |

响应 `data.list[]` 关键字段：

| 字段 | 说明 |
| --- | --- |
| `id` | 客户 ID |
| `customer_name` / `name` | 客户名称 |
| `customer_category_id` / `categoryId` | 客户分类 ID |
| `customer_category` / `category` | 客户分类名称 |
| `phone` | 联系电话，11 位手机号 |
| `detail_address` / `address` | 详细地址 |
| `opening_debt` | 期初欠款，元 |
| `receivableCents` | 未收款，分 |
| `receivedCents` | 已收款，分 |
| `prepaidCents` | 预收款，分 |

### GET `/customers/:id`

客户详情。

### POST `/customers`

新增客户。

请求体关键字段：

| 字段 | 类型 | 必填 | 校验 |
| --- | --- | --- | --- |
| `customer_name` / `name` | string | 是 | 1-120 字 |
| `phone` | string | 否 | 非空时必须是 11 位手机号 |
| `customer_category_id` / `categoryId` | string | 是 | 必须是已存在且启用的分类 |
| `detail_address` / `address` | string | 否 | 最多 255 字 |
| `remark` | string | 否 | 最多 500 字 |
| `opening_debt` / `openingReceivable` | string/number | 否 | 非负金额，最多 2 位小数 |

请求示例：

```json
{
  "name": "测试客户",
  "phone": "13800138000",
  "categoryId": "cmp0ueee7000eys5ovtn8vnsy",
  "address": "贵州省贵阳市白云区",
  "openingReceivable": "120.50",
  "remark": "门店客户"
}
```

### PUT `/customers/:id`

编辑客户。字段同新增，支持部分字段更新。

### GET `/customers/:id/sales-orders`

客户销售记录。

Query：

| 参数 | 说明 |
| --- | --- |
| `type` | `all`、`sales`、`return`、`receivable` |

### GET `/customers/:id/fund-records`

客户资金流水。

### GET `/customers/:id/receipt-context`

客户收款前置上下文，用于收款页面初始化。

### POST `/customers/:id/receipts`

客户整体收款。

请求体关键字段：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `amount` / `amountCents` | number | 是 | 本次收款金额 |
| `accountId` | string | 是 | 收款账户 |
| `date` / `receiptDate` | string | 否 | 收款日期 |
| `remark` | string | 否 | 备注 |

### GET `/fund-records/:id`

资金流水详情。

### 导入导出接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/customers/import-export` | 导入导出中心数据 |
| `GET` | `/customers/import-template` | 导入模板 |
| `GET` | `/customers/export` | 导出客户 |
| `POST` | `/customers/import-tasks` | 新增导入任务 |
| `GET` | `/customers/import-tasks/:taskId` | 导入任务详情 |
| `PUT` | `/customers/import-tasks/:taskId` | 更新导入任务 |

## 10. 销售单

### GET `/sales-orders/summary`

销售单汇总统计。

### GET `/sales-orders`

销售单列表。

常用 Query：

| 参数 | 说明 |
| --- | --- |
| `page` / `pageSize` | 分页 |
| `keyword` | 单号、客户、制单人、产品 |
| `statusKey` | 款项状态 |
| `dateFrom` / `dateTo` | 销售日期 |

### GET `/sales-orders/:id`

销售单详情。

### POST `/sales-orders`

创建销售单。创建后会：

- 写入 `sales_orders`、`sales_order_items`
- 回写客户往来金额
- 扣减库存余额 `inventory_balances`
- 写入库存流水 `inventory_ledgers`，类型为 `sales_out`

请求体关键字段：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `customerId` | string/number | 是 | 客户 ID |
| `warehouseId` | string | 否 | 仓库 ID |
| `warehouseName` / `warehouse` | string | 否 | 仓库名称，默认 `默认仓` |
| `orderDate` / `saleDate` | string | 否 | `YYYY-MM-DD` |
| `discountCents` / `discountAmount` | number | 否 | 优惠金额 |
| `usePrepaidCents` / `usePrepaidAmount` | number | 否 | 使用预收款 |
| `items` | array | 是 | 销售明细 |
| `remark` | string | 否 | 最多 500 字 |

`items[]`：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `productId` | string/number | 是 | 产品 ID |
| `variantId` | string/number | 是 | 规格 ID |
| `qty` / `quantity` | number | 是 | 数量 |
| `unitPriceCents` / `unitPrice` | number | 是 | 单价 |
| `productName` | string | 否 | 产品名快照 |
| `colorName` / `color` | string | 否 | 颜色快照 |

### GET `/sales-orders/:id/receipt-context`

销售单收款上下文。

### POST `/sales-orders/:id/receipts`

销售单收款。会写入收款单、资金流水，并回写销售单和客户余额。

### POST `/sales-orders/:id/print`

标记销售单已打印。

## 11. 销售退货

销售退货接口在 `backend/src/routes/returns.js`，前端门面是 `api/return-api.js`。

当前退货会真实写入：

- `return_orders`
- `return_order_items`
- `inventory_balances`
- `inventory_ledgers`
- 退款场景会生成负数 `receipt_orders`、`receipt_order_items`、`fund_records`
- 计入预收场景会增加客户预收余额

### 11.1 退货选项接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/return-options/customers` | 退货客户选择项 |
| `GET` | `/return-options/warehouses` | 退货仓库选择项 |
| `GET` | `/return-options/products` | 退货产品规格选择项 |

`GET /return-options/products` Query：

| 参数 | 类型 | 说明 |
| --- | --- | --- |
| `keyword` | string | 产品名、编号、颜色搜索 |
| `customerId` | string/number | 可选，用于按客户相关商品收敛 |
| `limit` | number | 返回数量 |

### GET `/return-orders`

退货单列表。

Query：

| 参数 | 类型 | 说明 |
| --- | --- | --- |
| `page` / `pageSize` | number | 分页 |
| `keyword` | string | 退货单号、客户、商品搜索 |
| `statusKey` | string | `all`、`unrefunded`、`partial`、`prepay`、`refunded` |
| `dateRange` | string | 例如 `today`、`week`、`month` |
| `dateFrom` / `dateTo` | string | 自定义日期范围 |

### GET `/return-orders/summary`

退货单汇总统计，Query 同列表。

响应 `data` 关键字段：

```json
{
  "returnAmountText": "¥120.00",
  "pendingCount": 3,
  "prepayAmountText": "¥50.00"
}
```

### GET `/return-orders/:id/form`

退货单编辑表单数据。新增时可传 `new`，例如 `/return-orders/new/form`。

Query：

| 参数 | 类型 | 说明 |
| --- | --- | --- |
| `customerId` | string/number | 预选客户 |
| `orderId` | string | 关联销售单 |

### GET `/return-orders/:id`

退货单详情。

### POST `/return-orders`

保存退货单。当前保存即会执行业务回写，不再只是本地 mock。

### PUT `/return-orders/:id`

编辑退货单。会先回滚旧库存和旧资金影响，再按新内容重写。

### POST `/return-orders/submit`

提交退货单。当前与保存接口共用同一套保存逻辑。

请求体关键字段：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `customerId` | string/number | 是 | 客户 ID |
| `orderId` / `salesOrderId` | string | 否 | 关联销售单 |
| `warehouseId` | string | 否 | 仓库 ID |
| `orderDate` / `returnDate` | string | 否 | 退货日期 |
| `refundCents` / `refundAmount` | number | 否 | 退款金额 |
| `receivedToPrepay` / `returnToPrepay` | boolean | 否 | 是否计入预收 |
| `statusKey` | string | 否 | `partial` / `refunded` |
| `items` | array | 是 | 退货明细 |
| `remark` | string | 否 | 备注 |

`items[]`：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `productId` | string/number | 是 | 产品 ID |
| `variantId` | string/number | 是 | 规格 ID |
| `quantity` / `qty` | number | 是 | 退货数量 |
| `unitPriceCents` / `unitPrice` | number | 是 | 退货单价 |
| `productName` | string | 否 | 产品名快照 |
| `color` / `colorName` | string | 否 | 颜色快照 |

业务规则：

- 退货数量必须大于 0。
- 退款金额不能小于 0。
- 如果不是计入预收，退款会生成负数收款单和负数资金流水。
- 退货会增加对应仓库库存，并写 `inventory_ledgers`。

## 12. 收款账户

### GET `/accounts`

收款账户列表。

Query：

| 参数 | 说明 |
| --- | --- |
| `keyword` | 账户名称搜索 |
| `includeDisabled` | 是否包含停用账户 |

### POST `/accounts`

新增账户。

请求体：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `accountName` / `account_name` | string | 是 | 账户名称 |
| `initBalance` / `init_balance` | number | 否 | 初始余额，元 |
| `remark` | string | 否 | 备注 |
| `status` | string | 否 | `enabled` / `disabled` |

### PUT `/accounts/:id`

编辑账户。

## 13. 供应商

### GET `/suppliers`

供应商列表。

Query：

| 参数 | 说明 |
| --- | --- |
| `keyword` | 名称、电话、地址搜索 |
| `statusKey` | `all`、`enabled`、`disabled` |

### GET `/suppliers/:id/form`

供应商表单数据。

### GET `/suppliers/:id`

供应商详情。

### POST `/suppliers`

新增供应商。

请求体：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `name` | string | 是 | 供应商名称 |
| `phone` | string | 否 | 手机号，非空时 11 位 |
| `address` | string | 否 | 地址 |
| `remark` | string | 否 | 备注 |
| `isFrequent` / `isCommon` | boolean | 否 | 常用供应商 |
| `statusKey` | string | 否 | `enabled` / `disabled` |

### PUT `/suppliers/:id`

编辑供应商。

### POST `/suppliers/:id/status`

启用/停用供应商。

## 14. 采购单

### 14.1 采购选项接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/purchase-options/suppliers` | 供应商选择项 |
| `GET` | `/purchase-options/warehouses` | 仓库选择项 |
| `GET` | `/purchase-options/products` | 产品规格选择项 |

`/purchase-options/products` Query：

| 参数 | 说明 |
| --- | --- |
| `keyword` | 产品名、编号、颜色搜索 |
| `limit` | 返回数量 |

### GET `/purchase-orders`

采购单列表。

Query：

| 参数 | 说明 |
| --- | --- |
| `keyword` | 单号、供应商、产品 |
| `statusKey` | `all`、`draft`、`submitted` |
| `supplierId` | 供应商筛选 |
| `warehouseName` | 仓库筛选 |

### GET `/purchase-orders/:id/form`

采购单表单数据。

### GET `/purchase-orders/:id`

采购单详情。

### POST `/purchase-orders`

保存采购单草稿，不入库。

### PUT `/purchase-orders/:id`

编辑采购单草稿。

### POST `/purchase-orders/submit`

提交采购单。提交后会：

- 写入或更新采购单
- 写入采购明细
- 增加库存余额 `inventory_balances`
- 写入库存流水 `inventory_ledgers`，类型为 `purchase_in`
- 回写供应商采购金额

请求体关键字段：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `supplierId` | string | 是 | 供应商 ID |
| `warehouseId` | string | 否 | 仓库 ID |
| `date` / `orderDate` | string | 否 | 采购日期 |
| `discountCents` | number | 否 | 优惠金额 |
| `items` | array | 是 | 采购明细 |
| `remark` | string | 否 | 最多 120 字 |

`items[]`：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `productId` | string/number | 是 | 产品 ID |
| `variantId` | string/number | 是 | 规格 ID |
| `quantity` | number | 是 | 数量 |
| `unitPriceCents` / `unitCents` | number | 是 | 单价，分 |

## 15. 仓库

### GET `/warehouses`

仓库列表。

Query：

| 参数 | 说明 |
| --- | --- |
| `keyword` | 仓库名、仓管、地址、状态搜索 |

响应 `data[]`：

```json
[
  {
    "id": "cmp19cn6q0002ysi84bj0uxff",
    "name": "默认仓",
    "keeper": "王姐",
    "manager": "王姐",
    "address": "默认仓库",
    "isDefault": true,
    "defaultText": "默认仓",
    "statusKey": "enabled",
    "statusText": "启用",
    "statusTone": "success"
  }
]
```

### GET `/warehouses/summary`

仓库汇总。

响应 `data`：

```json
{
  "warehouseCount": 1,
  "enabledCount": 1,
  "defaultName": "默认仓"
}
```

### GET `/warehouses/names`

返回启用仓库名称数组。

### GET `/warehouses/:id/form`

仓库编辑表单数据。

### GET `/warehouses/:id`

仓库详情。

### POST `/warehouses`

新增仓库。

请求体：

| 字段 | 类型 | 必填 | 校验 |
| --- | --- | --- | --- |
| `name` | string | 是 | 1-50 字，组织内唯一 |
| `keeper` / `manager` | string | 否 | 最多 30 字 |
| `address` | string | 否 | 最多 120 字 |
| `isDefault` | boolean | 否 | 设为默认会取消其他默认仓 |
| `statusKey` | string | 否 | `enabled` / `disabled` |

### PUT `/warehouses/:id`

编辑仓库。字段同新增。

### POST `/warehouses/:id/status`

启用/停用仓库。

业务规则：

- 默认仓不可停用。
- 设为默认仓时状态强制为启用。

## 16. 库存

库存以 `InventoryBalance` 为余额表，`InventoryLedger` 为流水表。

当前库存来源：

- 产品规格初始化库存写入 `inventory_balances`
- 销售单创建时扣减库存，流水类型 `sales_out`
- 采购单提交时增加库存，流水类型 `purchase_in`
- 库存调整时修改库存，流水类型 `adjustment`

### GET `/inventory-options/warehouses`

库存页面仓库筛选项。

响应 `data`：

```json
["全部", "默认仓"]
```

### GET `/inventory`

库存列表。

Query：

| 参数 | 类型 | 说明 |
| --- | --- | --- |
| `keyword` | string | 产品名、编号、颜色、仓库、单位 |
| `warehouseName` | string | `全部` 或仓库名 |
| `statusKey` | string | `all`、`low`、`empty`、`positive`、`normal` |
| `sortKey` | string | `lowFirst`、`stockAsc`、`stockDesc`、`valueDesc`、`nameAsc` |

响应 `data`：

```json
{
  "list": [
    {
      "id": "cmp19cn6q0002ysi84bj0uxff::3605",
      "balanceId": "cmxxx",
      "productId": "1001",
      "variantId": "3605",
      "productName": "6公分拼色织带",
      "productNo": "P-001",
      "category": "织带",
      "color": "蓝色",
      "warehouseId": "cmp19cn6q0002ysi84bj0uxff",
      "warehouseName": "默认仓",
      "unit": "条",
      "stockQty": 8,
      "availableQty": 8,
      "lowerLimitQty": 20,
      "statusKey": "low",
      "statusText": "低库存",
      "stockText": "8条",
      "lowerLimitText": "20条",
      "stockValueText": "¥120.00"
    }
  ],
  "total": 22
}
```

### GET `/inventory/summary`

库存汇总。

Query 同 `/inventory`。

响应 `data`：

```json
{
  "itemCount": 2844,
  "totalStock": 12559670.5,
  "totalStockText": "12559670.5",
  "totalValueCents": 17556643510,
  "totalValueText": "¥175566435.10",
  "availableText": "12559670.5",
  "stockedCount": 416,
  "lowCount": 22,
  "emptyCount": 2428,
  "normalCount": 394
}
```

### GET `/inventory/:id`

库存详情。

`id` 格式：

```text
<warehouseId>::<variantId>
```

### GET `/inventory/:id/adjust-context`

库存调整页面上下文。

响应 `data`：

```json
{
  "item": {},
  "recentRecords": [
    {
      "id": "cmxxx",
      "operator": "王姐",
      "time": "2026-05-11 21:40",
      "beforeQty": 8,
      "deltaQty": 5,
      "afterQty": 13,
      "beforeText": "8条",
      "deltaText": "+5条",
      "afterText": "13条",
      "note": "仓库盘点修正"
    }
  ]
}
```

### POST `/inventory/adjustments`

保存库存调整。

请求体：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `itemId` | string | 是 | 库存 ID，格式 `<warehouseId>::<variantId>` |
| `adjustQty` | number/string | 是 | 调整数量，正数增加，负数减少 |
| `note` / `reason` | string | 否 | 调整原因，最多 120 字 |
| `operator` | string | 否 | 操作人，默认 `王姐` |

请求示例：

```json
{
  "itemId": "cmp19cn6q0002ysi84bj0uxff::3605",
  "adjustQty": "5",
  "note": "仓库盘点修正",
  "operator": "王姐"
}
```

响应 `data`：

```json
{
  "ok": true,
  "record": {
    "id": "cmxxx",
    "deltaText": "+5条",
    "afterText": "13条"
  },
  "item": {
    "id": "cmp19cn6q0002ysi84bj0uxff::3605",
    "stockQty": 13,
    "stockText": "13条"
  },
  "recentRecords": []
}
```

业务规则：

- 调整数量不能为 0。
- 调整后库存不能小于 0。
- 每次调整必须写入 `inventory_ledgers`。
- 调整后会同步产品规格 `openingStock`，便于旧页面兼容。

## 17. 组织、我的、收款码

组织接口在 `backend/src/routes/organizations.js`，前端门面是 `api/profile-api.js`。

### GET `/organizations/current`

获取当前组织简要信息。

响应 `data`：

```json
{
  "id": "cmowoemdy0001ysu91c4w08me",
  "name": "聚云掌柜",
  "code": "org-main",
  "tenantId": "cmp2e7ihm0000ys8kmowh9ogy",
  "role": "老板",
  "permissionText": "1 个仓库"
}
```

### GET `/organizations`

获取当前登录用户可切换的组织列表。

Query：

| 参数 | 类型 | 说明 |
| --- | --- | --- |
| `keyword` | string | 组织名称、组织 code、角色搜索 |

响应 `data`：

```json
{
  "list": [
    {
      "id": "cmowoemdy0001ysu91c4w08me",
      "name": "聚云掌柜",
      "code": "org-main",
      "desc": "聚云掌柜 · 老板",
      "role": "老板",
      "roleNames": ["老板"],
      "warehouseCount": 1,
      "permissionText": "1 个仓库",
      "active": true,
      "actionText": "当前"
    }
  ],
  "total": 1
}
```

### POST `/organizations/switch`

切换组织。后端会更新当前 `AuthSession` 的 `tenantId/orgId/employeeId`，并返回新的登录上下文。前端需要同步更新 `utils/auth-session.js` 的缓存。

请求体：

```json
{
  "orgId": "cmowoemdy0001ysu91c4w08me"
}
```

响应 `data` 关键字段同登录接口：

| 字段 | 说明 |
| --- | --- |
| `token` | 沿用当前 token |
| `currentOrg` | 切换后的组织 |
| `employee` | 当前组织下的员工 |
| `permissions` | 当前员工权限 |
| `switched` | 是否切换成功 |

### GET `/profile/home`

我的页面首页资料。该接口要求登录，但不要求具体业务权限。

响应 `data`：

```json
{
  "user": {
    "id": "cmxxx",
    "name": "老板账号",
    "phone": "1358270496",
    "role": "老板",
    "avatarText": "老"
  },
  "org": {
    "id": "cmxxx",
    "name": "聚云掌柜",
    "code": "org-main",
    "role": "老板",
    "permissionText": "1 个仓库"
  },
  "settings": [
    {
      "key": "receipt-code",
      "title": "收款码设置",
      "badge": 0
    }
  ],
  "helps": []
}
```

### GET `/organizations/receipt-settings`

获取当前组织收款码设置。收款码是组织维度，不是个人维度。

响应 `data`：

```json
{
  "org": {
    "id": "cmxxx",
    "name": "聚云掌柜",
    "code": "org-main"
  },
  "imagePath": "/api/v1/uploads/receipt-codes/xxx.jpg",
  "paymentQrcodeUrl": "/api/v1/uploads/receipt-codes/xxx.jpg",
  "note": "门店统一收款码",
  "qrcodeRemark": "门店统一收款码"
}
```

### PUT `/organizations/receipt-settings`

保存当前组织收款码设置。

请求体：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `imagePath` / `paymentQrcodeUrl` | string | 否 | 收款码图片地址，最多 500 字 |
| `note` / `qrcodeRemark` | string | 否 | 备注，最多 500 字 |

### POST `/organizations/receipt-code-image`

上传组织收款码图片。当前保存到本地 `backend/uploads/receipt-codes/`。

请求体：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `imageBase64` / `base64` | string | 是 | 图片 base64，可含 `data:image/...;base64,` 前缀 |
| `ext` / `fileExt` | string | 否 | `png` / `jpg` / `webp` |

限制：

- 图片大小不能超过 5MB。
- 请求体上限 16MB。

### GET `/uploads/receipt-codes/:filename`

读取本地收款码图片。

## 18. 员工与角色权限

员工接口在 `backend/src/routes/employees.js`，前端门面是 `api/employee-api.js`。

### GET `/employees/roles`

获取角色权限列表。

响应 `data`：

```json
{
  "list": [
    {
      "id": "cmxxx",
      "name": "老板",
      "description": "全模块 · 全组织数据 · 可管理员工权限",
      "permissions": ["customers:read", "sales:read"],
      "permissionLabels": ["查看客户", "查看销售单"],
      "dataScope": "all"
    }
  ]
}
```

### GET `/employees/warehouse-options`

获取员工可绑定仓库选项。

### GET `/employees`

员工列表。

Query：

| 参数 | 类型 | 说明 |
| --- | --- | --- |
| `keyword` | string | 员工姓名、手机号搜索 |
| `statusKey` | string | `all`、`enabled`、`disabled` |
| `roleName` | string | 角色筛选 |

### GET `/employees/:id`

员工详情。

### GET `/employees/:id/form`

员工编辑表单数据。新增时可传 `new`。

### POST `/employees`

新增员工。

### PUT `/employees/:id`

编辑员工。

请求体关键字段：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `name` | string | 是 | 员工姓名，1-30 字 |
| `phone` | string | 是 | 11 位手机号 |
| `roleId` | string | 否 | 主角色 ID |
| `roleIds` | array | 否 | 多角色 ID 列表 |
| `warehouseIds` | array | 否 | 绑定仓库 ID 列表 |
| `statusKey` / `status` | string | 否 | `enabled` / `disabled` |
| `remark` | string | 否 | 备注 |

多角色规则：

- 一个员工可以有多个角色。
- 后端权限取角色权限并集。
- 数据范围也会合并；如果任一角色是 `all`，则视为全量数据。

### POST `/employees/:id/status`

启用/禁用员工。

请求体：

```json
{
  "statusKey": "disabled"
}
```

## 19. 消息中心

消息接口在 `backend/src/routes/messages.js`，前端门面是 `api/message-api.js`。

消息类型：

| 后端 `type` | 前端类型 | 说明 |
| --- | --- | --- |
| `inventory_warning` | `inventory` | 库存预警 |
| `print_result` | `print` | 打印消息 |
| `organization_notice` | `system` | 组织消息 |

### GET `/messages`

消息列表。请求时会自动检查库存低库存项，并按天去重生成库存预警消息。

Query：

| 参数 | 类型 | 说明 |
| --- | --- | --- |
| `filter` | string | `unread`、`read`、`inventory`、`print`、`system` |

响应 `data`：

```json
{
  "list": [
    {
      "id": "cmxxx",
      "type": "inventory",
      "typeText": "库存预警",
      "title": "库存预警 · 6公分拼色织带 / 蓝色",
      "summary": "默认仓库存 8，低于下限 20。",
      "time": "2026-05-13 12:15",
      "status": "unread",
      "statusText": "未读",
      "priority": "warning",
      "actionText": "查看库存详情",
      "actionUrl": "/pages/stock-adjust/index?id=..."
    }
  ],
  "total": 1
}
```

### GET `/messages/stats`

消息统计。

响应 `data`：

```json
{
  "total": 42,
  "unread": 42
}
```

### GET `/messages/:id`

消息详情。

### POST `/messages/:id/read`

标记单条消息已读。

### POST `/messages/read-all`

全部标记已读。

## 20. 系统接口：审计日志、导入导出

系统接口在 `backend/src/routes/system.js`。

### GET `/audit-logs`

查询审计日志。

Query：

| 参数 | 类型 | 说明 |
| --- | --- | --- |
| `entity` | string | 实体筛选，例如 `sales_order`、`return_order` |
| `limit` | number | 返回数量，最大 200 |

响应 `data`：

```json
{
  "list": [
    {
      "id": "cmxxx",
      "actorId": "cmxxx",
      "action": "create",
      "entity": "import_export_task",
      "entityId": "cmxxx",
      "before": null,
      "after": {
        "type": "customer_export",
        "status": "success"
      },
      "createdAt": "2026-05-13T06:00:00.000Z"
    }
  ],
  "total": 1
}
```

当前已写入审计的场景：

- 组织切换。
- 销售单打印。
- 退货保存。
- 导入导出任务创建。

### GET `/import-export/tasks`

查询导入导出任务。

Query：

| 参数 | 类型 | 说明 |
| --- | --- | --- |
| `type` | string | `customer_import`、`customer_export`、`product_import`、`product_export`、`category_import` |
| `limit` | number | 返回数量 |

### POST `/import-export/tasks`

创建通用导入导出任务。

请求体：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `type` | string | 是 | 任务类型 |
| `fileName` | string | 否 | 文件名，最多 120 字 |
| `totalRows` | number | 否 | 总行数 |

说明：

- 通用任务接口目前主要作为系统任务框架。
- 客户真实 CSV/XLSX 导入导出主要走 `/customers/import-*` 和 `/customers/export`。

### GET `/import-export/templates/:type`

获取通用模板。

路径参数：

| `type` | 说明 |
| --- | --- |
| `customers` | 客户模板 |
| `products` | 产品模板 |
| `categories` | 分类模板 |

响应 `data`：

```json
{
  "fileName": "customers-template.csv",
  "headers": ["客户名称", "联系电话", "客户分类"],
  "csv": "客户名称,联系电话,客户分类\n"
}
```

## 21. AI 开单识别

AI 接口在 `backend/src/routes/ai.js`，前端门面是 `api/ai-api.js`。

### POST `/ai/sales-intent`

识别首页输入文本，返回匹配到的客户和商品明细。

请求体：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `text` | string | 是 | 用户输入的开单文本，最多 1000 字 |

请求示例：

```json
{
  "text": "黔西-龙凤 25玛寸布米色2米"
}
```

响应 `data`：

```json
{
  "input": "黔西-龙凤 25玛寸布米色2米",
  "customer": {
    "id": "1",
    "name": "黔西-龙凤",
    "phone": "19984477803"
  },
  "items": [
    {
      "id": "ai-1778652671-0",
      "productId": "1001",
      "variantId": "3605",
      "name": "25玛寸布",
      "color": "米色",
      "spec": "米色",
      "category": "布料",
      "quantityValue": 2,
      "unit": "米",
      "unitPriceCents": 1200,
      "stockQty": 100
    }
  ],
  "warnings": []
}
```

说明：

- 当前实现是后端规则识别，不是外部大模型。
- 接口已经是真实后端接口，后续接 OpenAI/通义/微信云托管时建议保持入参与出参不变，只替换内部识别逻辑。

## 22. 产品接口当前状态

当前数据库已有 `Product`、`ProductVariant`，采购、库存、AI 识别都在使用真实产品表。

但需要注意：`api/product-api.js` 已经定义了 `/products/*`、`/product-categories/*` 等接口门面，当前后端 `backend/src/routes/` 还没有独立的 `products.js` 路由注册。因此产品管理页面仍可能有 `services/product-store.js` 兼容逻辑。

后续补产品接口时建议覆盖：

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/products` | 产品列表 |
| `GET` | `/products/summary` | 产品汇总 |
| `GET` | `/products/search` | 产品搜索 |
| `GET` | `/products/:id` | 产品详情 |
| `GET` | `/products/:id/form` | 产品编辑表单 |
| `POST` | `/products` | 新增产品 |
| `PUT` | `/products/:id` | 编辑产品 |
| `POST` | `/products/:productId/variants/:variantId/stock` | 更新规格库存 |
| `GET` | `/product-categories` | 产品分类列表 |
| `GET` | `/product-categories/tree` | 产品分类树 |
| `POST` | `/product-categories` | 新增产品分类 |
| `PUT` | `/product-categories/:key` | 编辑产品分类 |

## 23. 前端 API 门面对照

| 模块 | 前端文件 | 后端资源 |
| --- | --- | --- |
| 登录 | `api/auth-api.js` | `/auth/*` |
| AI 识别 | `api/ai-api.js` | `/ai/*` |
| 客户 | `api/customer-api.js` | `/customers/*`、`/fund-records/*` |
| 客户分类 | `api/customer-category-api.js` | `/customer-categories/*` |
| 销售单 | `api/order-api.js` | `/sales-orders/*` |
| 销售退货 | `api/return-api.js` | `/return-orders/*`、`/return-options/*` |
| 账户 | `api/account-api.js` | `/accounts/*` |
| 供应商 | `api/supplier-api.js` | `/suppliers/*` |
| 采购单 | `api/purchase-api.js` | `/purchase-orders/*`、`/purchase-options/*` |
| 仓库 | `api/warehouse-api.js` | `/warehouses/*` |
| 库存 | `api/inventory-api.js` | `/inventory/*`、`/inventory-options/*` |
| 我的/组织 | `api/profile-api.js` | `/profile/*`、`/organizations/*` |
| 员工 | `api/employee-api.js` | `/employees/*` |
| 消息 | `api/message-api.js` | `/messages/*` |
| 产品 | `api/product-api.js` | 前端门面存在，后端独立产品路由待补 |

## 24. 权限要求速查

后端权限拦截在 `backend/src/app.js`，角色定义在 `backend/src/permissions.js`。

| 路径 | 读权限 | 写权限 |
| --- | --- | --- |
| `/customers`、`/customer-categories` | `customers:read` | `customers:write` |
| `/sales-orders` | `sales:read` | `sales:write` |
| `/sales-orders/*/receipts` | `receipts:read` | `receipts:write` |
| `/return-orders` | `returns:read` | `returns:write` |
| `/suppliers` | `suppliers:read` | `suppliers:write` |
| `/purchase-orders` | `purchase:read` | `purchase:write` |
| `/inventory` | `inventory:read` | `inventory:write` |
| `/warehouses` | `warehouses:read` | `warehouses:write` |
| `/accounts` | `accounts:read` | `accounts:write` |
| `/employees`、`/organizations` | `settings:read` | `settings:write` |
| `/messages` | `messages:read` | `messages:read` |
| `/ai` | `sales:write` | `sales:write` |
| `/audit-logs` | `settings:read` | - |
| `/import-export` | `settings:read` | `settings:write` |

特殊说明：

- `/auth/*` 是公开登录接口。
- `/health` 是公开健康检查。
- `/profile/home` 只要求登录，不要求具体业务权限。
- 仓库相关接口还会检查 `warehouseIds` 数据权限。

## 25. 本地验证命令

```bash
# 后端烟测
npm run backend:smoke

# 小程序静态检查
npm run wx:check

# 初始化库存余额
npm run backend:setup:inventory

# 启动后端
npm run backend:start
```

快速 curl：

```bash
curl http://127.0.0.1:3000/health
curl 'http://127.0.0.1:3000/api/v1/customers?page=1&pageSize=2'
curl 'http://127.0.0.1:3000/api/v1/inventory/summary'
curl 'http://127.0.0.1:3000/api/v1/warehouses'
```

带登录 token 的 curl 示例：

```bash
TOKEN=$(curl -s -X POST http://127.0.0.1:3000/api/v1/auth/wechat-phone-login \
  -H 'Content-Type: application/json' \
  --data '{"mockPhone":"1358270496","loginCode":"local"}' \
  | node -e "let s='';process.stdin.on('data',d=>s+=d);process.stdin.on('end',()=>console.log(JSON.parse(s).data.token))")

curl -H "Authorization: Bearer $TOKEN" \
  'http://127.0.0.1:3000/api/v1/profile/home'
```

## 26. 新增接口开发要求

新增接口时按这个顺序处理：

1. 先确认数据库字段和业务规则。
2. 在 `backend/src/routes/` 按模块新增路由。
3. 所有接口使用 `ok()` / `fail()` 返回统一结构。
4. 写操作必须做后端校验，前端也要做用户体验校验。
5. 涉及多表写入必须用 Prisma transaction。
6. 金额字段同时考虑 Decimal 元和 cents 分的兼容。
7. 页面不得直接写 `wx.request`，必须经过 `api/*-api.js`。
8. 完成后跑 `npm run backend:smoke` 和 `npm run wx:check`。

## 27. 当前仍需后续完善

以下内容不是完全未做，而是后续接正式后端或交付前建议继续完善：

| 模块 | 当前状态 |
| --- | --- |
| 产品管理 | 数据库已有产品/规格，采购、库存、AI 使用真实产品；独立 `/products/*` 后端路由仍待补齐 |
| 真正 AI 识别 | 当前是后端规则识别，未接外部大模型 |
| Excel 导出 | 客户导出当前为 CSV，Excel 可打开；若要求 `.xlsx`，需用 `exceljs` 生成 xlsx |
| 审计日志 | 已有基础接口和部分写入，建议所有写操作统一接入 |
| 图片上传 | 组织收款码当前保存在本地 `backend/uploads`，正式环境应接对象存储 |
| 正式微信授权 | 本地主要用模拟登录；正式发布需配置微信 AppID/AppSecret、合法域名和手机号授权 |
| Swagger / OpenAPI | 当前是 Markdown 文档，后续可生成 `openapi.yaml` |
