# 纺织开单小工具

聚云掌柜微信小程序项目，用于把 Figma 设计稿逐步落地为可维护的小程序页面、组件和业务交互。

当前前端已加入 `api/` 统一请求层，默认通过 `mockAdapter` 复用 `services/*-store.js` 和 `data/*-seed.js` 返回本地模拟数据。后续接入后端时，页面和组件不需要直接改业务结构，只需要把 `config/env.js` 的 `API_MODE` 切到 `http` 并配置真实 `API_BASE_URL`，后端按本文档接口契约实现即可。

## 接口约定

接口前缀建议使用 `/api/v1`。所有金额字段建议用整数分传输，例如 `47250` 表示 `¥472.50`，前端负责格式化展示。

## 前端请求适配层

小程序不能依赖本机 localhost mock 服务。当前项目采用小程序内置适配层：

```text
api/
├── request.js                  # 统一请求入口，按配置选择 mock/http
├── adapters/
│   ├── mock-adapter.js          # 本地 mock，异步返回，模拟后端接口
│   └── http-adapter.js          # 真实后端，基于 wx.request
├── order-api.js                 # 销售单接口门面
├── customer-api.js              # 客户接口门面
├── product-api.js               # 产品接口门面
├── inventory-api.js             # 库存接口门面
├── warehouse-api.js             # 仓库接口门面
├── supplier-api.js              # 供应商接口门面
├── purchase-api.js              # 采购单接口门面
├── return-api.js                # 退货单接口门面
├── profile-api.js               # 我的/组织接口门面
├── employee-api.js              # 员工/角色接口门面
└── message-api.js               # 消息接口门面
```

运行模式在 `config/env.js` 中配置：

```js
module.exports = {
  API_MODE: 'mock',
  API_BASE_URL: '',
  API_TIMEOUT: 15000,
  MOCK_DELAY: 80,
  DEFAULT_ORG_ID: 'org-main'
}
```

接入真实后端时改为：

```js
API_MODE: 'http',
API_BASE_URL: 'https://api.example.com/api/v1'
```

注意事项：

| 项目 | 说明 |
| --- | --- |
| 请求方式 | 真实后端统一走 `wx.request`，不要在小程序里访问 `localhost` |
| 合法域名 | `API_BASE_URL` 域名需要配置到微信公众平台的小程序 `request 合法域名` |
| 响应格式 | 后端建议返回 `{ code, message, data }`，`code = 0` 表示成功 |
| 金额字段 | 前后端统一用整数分，例如 `32000` 表示 `¥320.00` |
| 幂等 | 写操作使用 `X-Request-Id`，后端需要支持防重复提交 |
| 组织隔离 | 请求头包含 `X-Org-Id`，后端需要按组织隔离数据 |

页面后续接 API 时统一从 `api/index.js` 或具体业务 API 引入，例如：

```js
const api = require('../../api')

async loadOrders() {
  const result = await api.order.listOrders({ page: 1, pageSize: 20 })
  this.setData({ orders: result.list })
}
```

接口层冒烟检查：

```bash
npm run api:smoke
```

通用响应：

```json
{
  "code": 0,
  "message": "ok",
  "data": {},
  "traceId": "req_20260430_001"
}
```

分页响应：

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "page": 1,
    "pageSize": 20,
    "total": 120,
    "hasMore": true,
    "list": []
  }
}
```

通用请求头：

| 名称 | 说明 |
| --- | --- |
| `Authorization` | 登录态，例如 `Bearer <token>` |
| `X-Org-Id` | 当前组织 ID |
| `X-Request-Id` | 写操作幂等键，前端生成，后端用于防重复提交 |

通用分页入参：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `page` | number | 页码，从 1 开始 |
| `pageSize` | number | 每页数量，建议默认 20 |
| `keyword` | string | 搜索关键字，按页面含义匹配客户、单号、商品、电话等 |

通用写操作出参建议返回更新后的业务快照，避免前端二次猜状态。例如收款成功后返回 `order`、`customer`、`fundRecord`，库存调整成功后返回 `inventoryItem` 和 `adjustmentRecord`。

## 状态枚举

销售收款状态：

| 值 | 说明 |
| --- | --- |
| `unpaid` | 未收款 |
| `partial` | 部分收款 |
| `paid` | 已收款 |
| `overpaid` | 超收款 |
| `prepaid` | 计入预收 |
| `refunded` | 已退款 |

送货状态：

| 值 | 说明 |
| --- | --- |
| `unshipped` | 未送货 |
| `partial` | 部分送货 |
| `delivered` | 全部送货 |
| `overdelivered` | 超送货 |
| `refused` | 拒收 |

打印状态：

| 值 | 说明 |
| --- | --- |
| `unprinted` | 未打印 |
| `printed` | 已打印 |

采购单状态：

| 值 | 说明 |
| --- | --- |
| `draft` | 草稿 |
| `submitted` | 已提交 |

退货单状态：

| 值 | 说明 |
| --- | --- |
| `pending` | 未退款 |
| `partial` | 部分退款 |
| `prepay` | 计入预收 |
| `refunded` | 已退款 |

库存状态：

| 值 | 说明 |
| --- | --- |
| `normal` | 正常 |
| `low` | 低库存 |
| `empty` | 无库存 |

## 项目结构

```text
.
├── app.js
├── app.json
├── app.wxss
├── package.json
├── project.config.json
├── sitemap.json
├── api/
│   ├── adapters/
│   ├── customer-api.js
│   ├── employee-api.js
│   ├── index.js
│   ├── inventory-api.js
│   ├── message-api.js
│   ├── order-api.js
│   ├── product-api.js
│   ├── profile-api.js
│   ├── purchase-api.js
│   ├── request.js
│   ├── return-api.js
│   ├── supplier-api.js
│   ├── utils.js
│   └── warehouse-api.js
├── assets/
│   ├── icons/
│   ├── products/
│   └── tabbar/
├── config/
│   └── env.js
├── components/
│   ├── chat-bubble/
│   ├── customer-list-card/
│   ├── customer-summary-card/
│   ├── customer-switcher/
│   ├── order-composer/
│   ├── order-filter-bar/
│   ├── order-summary-card/
│   ├── recognized-order-card/
│   └── sales-order-card/
├── data/
│   ├── customer-seed.js
│   └── product-seed.js
├── docs/
│   ├── collaboration.md
│   ├── design-foundations.md
│   ├── icon-assets.md
│   ├── miniprogram-development-rules.md
│   ├── wechat-design-application-rules.md
│   └── wechat-miniprogram-research.md
├── pages/
│   ├── index/
│   │   ├── index.*                 # 首页对话开单
│   │   └── order-confirm.*         # 确认下单
│   ├── orders/
│   │   └── index.*                 # 销售单列表
│   ├── order-detail/
│   │   └── index.*                 # 销售单详情
│   ├── order-receipt/
│   │   └── index.*                 # 销售单收款
│   ├── customers/
│   │   └── index.*                 # 客户列表
│   ├── customer-detail/
│   │   └── index.*                 # 客户详情
│   ├── customer-receipt/
│   │   └── index.*                 # 客户整体收款
│   ├── fund-detail/
│   │   └── index.*                 # 资金流水详情
│   ├── customer-edit/
│   │   └── index.*                 # 新增/编辑客户
│   ├── customer-import/
│   │   └── index.*                 # 客户导入导出
│   ├── more/
│   │   └── index.*                 # 更多入口
│   ├── products/
│   │   └── index.*                 # 产品列表
│   ├── product-detail/
│   │   └── index.*                 # 产品详情
│   ├── product-edit/
│   │   └── index.*                 # 新增/编辑产品
│   ├── product-import/
│   │   └── index.*                 # 产品导入导出
│   ├── product-categories/
│   │   └── index.*                 # 产品分类
│   ├── warehouses/
│   │   └── index.*                 # 仓库列表
│   ├── warehouse-edit/
│   │   └── index.*                 # 新增/编辑仓库
│   ├── stock-summary/
│   │   └── index.*                 # 库存总览
│   ├── stock-adjust/
│   │   └── index.*                 # 库存调整
│   ├── suppliers/
│   │   └── index.*                 # 供应商列表
│   ├── supplier-detail/
│   │   └── index.*                 # 供应商详情
│   ├── supplier-edit/
│   │   └── index.*                 # 新增/编辑供应商
│   ├── purchase-orders/
│   │   └── index.*                 # 采购单列表
│   ├── purchase-order-edit/
│   │   └── index.*                 # 新增/编辑采购单
│   ├── purchase-order-detail/
│   │   └── index.*                 # 采购单详情
│   ├── purchase-returns/
│   │   └── index.*                 # 退货单列表
│   ├── purchase-return-edit/
│   │   └── index.*                 # 新增/编辑退货单
│   ├── purchase-return-detail/
│   │   └── index.*                 # 退货单详情
│   ├── org-switch/
│   │   └── index.*                 # 组织切换
│   ├── org-receipt-code/
│   │   └── index.*                 # 组织收款码设置
│   ├── employees/
│   │   └── index.*                 # 员工管理
│   ├── employee-edit/
│   │   └── index.*                 # 新增/编辑员工
│   ├── employee-roles/
│   │   └── index.*                 # 角色权限
│   └── profile/
│       ├── index.*                 # 我的
│       ├── message-center.*        # 消息中心
│       └── message-detail.*        # 消息详情
├── services/
│   ├── employee-store.js
│   ├── inventory-store.js
│   ├── message-store.js
│   ├── order-store.js
│   ├── product-store.js
│   ├── profile-store.js
│   ├── purchase-store.js
│   ├── return-store.js
│   ├── supplier-store.js
│   └── warehouse-store.js
├── styles/
└── tools/
    ├── prepare-lucide-icons.js
    └── wx-static-check.js
```

## 核心数据模型

### Customer

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | 客户 ID，当前 mock 使用客户名 |
| `name` | string | 客户名称 |
| `phone` | string | 联系电话 |
| `address` | string | 地址 |
| `category` | string | 客户分类 |
| `area` | string | 区域 |
| `level` | string | `normal` / `key` |
| `contractCents` | number | 合同累计金额 |
| `receivedCents` | number | 已收累计金额 |
| `receivableCents` | number | 欠款金额 |
| `prepaidCents` | number | 预收余额 |
| `orderCount` | number | 销售单数量 |
| `lastOrderDate` | string | 最近下单日期 |

### SalesOrder

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | 销售单 ID |
| `no` | string | 销售单号，例如 `XS202604180003` |
| `customer` | CustomerLite | 客户快照 |
| `saleDate` | string | 销售日期 |
| `warehouse` | string | 仓库 |
| `creator` | string | 制单人 |
| `paymentState` | string | 收款状态 |
| `deliveryState` | string | 送货状态 |
| `printState` | string | 打印状态 |
| `orderCents` | number | 订单金额 |
| `discountCents` | number | 优惠金额 |
| `contractCents` | number | 合同金额 |
| `receivedCents` | number | 已收金额 |
| `refundCents` | number | 已退金额 |
| `prepaidBalanceCents` | number | 计入/使用预收金额 |
| `products` | SaleOrderItem[] | 产品明细 |
| `receiptRecords` | FundRecord[] | 收款流水 |

### Product

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | 产品 ID |
| `name` | string | 产品名称 |
| `no` | string | 产品编号 |
| `imageUrl` | string | 产品图片 |
| `categoryPath` | string[] | 最多三级分类路径 |
| `warehouse` | string | 默认仓库 |
| `remark` | string | 备注 |
| `variants` | ProductVariant[] | 颜色/规格维度 |

### ProductVariant

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | 颜色规格 ID |
| `color` | string | 颜色/规格名称 |
| `unit` | string | 单位，跟随颜色规格 |
| `imageUrl` | string | 颜色图片，未上传则展示默认图 |
| `stockQty` | number | 库存数量 |
| `lowerLimitQty` | number | 库存下限 |
| `priceCents` | number | 售价 |
| `costPriceCents` | number | 进价 |

### InventoryItem

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | 建议为 `${productId}::${variantId}` |
| `productId` | string | 产品 ID |
| `variantId` | string | 颜色规格 ID |
| `productName` | string | 产品名称 |
| `color` | string | 颜色 |
| `warehouseName` | string | 仓库 |
| `unit` | string | 单位 |
| `stockQty` | number | 库存 |
| `availableQty` | number | 可用库存 |
| `inTransitQty` | number | 在途库存 |
| `lowerLimitQty` | number | 库存下限 |
| `statusKey` | string | `normal` / `low` / `empty` |
| `stockValueCents` | number | 库存金额 |

### FundRecord

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | 流水 ID |
| `no` | string | 流水单号 |
| `customerId` | string | 客户 ID |
| `orderId` | string | 关联销售单 ID，可为空 |
| `type` | string | `receipt` / `prepaid` / `use-prepaid` / `refund` |
| `amountCents` | number | 金额，收入为正，退款/冲抵可为负 |
| `date` | string | 日期 |
| `remark` | string | 备注 |

## 页面与接口清单

下面接口是后端接入建议契约。路径和字段可按后端规范微调，但需要保证页面拿到的数据语义一致。

### 首页开单

#### `pages/index/index` 首页对话开单

| 功能 | 接口 | 入参 | 出参 |
| --- | --- | --- | --- |
| 初始化当前客户、购物车、推荐客户 | `GET /checkout/session` | `sessionId?` | `{ sessionId, customer: Customer, cart: CheckoutCart, quickCustomers: Customer[] }` |
| 客户搜索/切换客户弹层懒加载 | `GET /customers` | `keyword, page, pageSize` | `Page<Customer>` |
| 新增客户快捷入口 | `POST /customers` | `{ name, phone, category?, address?, openingReceivableCents?, remark? }` | `{ customer: Customer }` |
| AI 识别开单文本 | `POST /ai/order/parse` | `{ text, customerId?, warehouseName? }` | `{ customer?: Customer, items: CheckoutItem[], warnings: string[], rawText }` |
| 商品搜索/更换商品弹层懒加载 | `GET /products/search` | `keyword, categoryKey?, stockState?, page, pageSize` | `Page<Product>`，每个产品带 `variants` |
| 加入/修改购物车明细 | `PUT /checkout/session/{sessionId}/cart` | `{ customerId, items: CheckoutItem[], discountCents?, usePrepaidCents? }` | `{ cart: CheckoutCart, summary: CheckoutSummary }` |
| 清空购物车 | `DELETE /checkout/session/{sessionId}/cart` | 无 | `{ cart: CheckoutCart }` |
| 生成下单预览 | `POST /sales-orders/preview` | `{ customerId, warehouseName, items, discountCents?, usePrepaidCents?, remark? }` | `{ draftId, orderPreview: SalesOrder, amountSummary }` |

`CheckoutItem`：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `productId` | string | 产品 ID |
| `variantId` | string | 颜色规格 ID |
| `name` | string | 产品名快照 |
| `color` | string | 颜色快照 |
| `unit` | string | 单位 |
| `quantity` | number | 数量 |
| `unitPriceCents` | number | 单价 |
| `amountCents` | number | 小计 |

#### `pages/index/order-confirm` 确认下单

| 功能 | 接口 | 入参 | 出参 |
| --- | --- | --- | --- |
| 获取下单预览 | `GET /sales-orders/preview/{draftId}` | `draftId` | `{ orderPreview: SalesOrder, customer: Customer, amountSummary }` |
| 修改优惠金额/备注/预收抵扣后重算 | `POST /sales-orders/preview` | `{ draftId?, customerId, warehouseName, items, discountCents, usePrepaidCents, remark }` | `{ draftId, orderPreview: SalesOrder, amountSummary }` |
| 确认下单 | `POST /sales-orders` | `{ draftId?, customerId, warehouseName, items, discountCents, usePrepaidCents, remark, requestId }` | `{ order: SalesOrder, customer: Customer, fundRecords: FundRecord[], inventoryChanges: InventoryChange[] }` |
| 分享销售单 | `POST /sales-orders/{id}/share` | `{ channel: "wechat/image" }` | `{ shareUrl?, imageUrl?, ticketId }` |
| 打印销售单 | `POST /sales-orders/{id}/print` | `{ templateId?, copies? }` | `{ taskId, printState: "printed" }` |

### 销售单

#### `pages/orders/index` 销售单列表

| 功能 | 接口 | 入参 | 出参 |
| --- | --- | --- | --- |
| 销售单分页列表 | `GET /sales-orders` | `keyword, dateStart, dateEnd, paymentState?, deliveryState?, printState?, creatorId?, customerId?, sortKey, page, pageSize` | `Page<SalesOrderListItem>` |
| 订单概览 | `GET /sales-orders/summary` | 与列表筛选一致 | `{ unpaidCents, partialCount, overpaidCount, prepaidCount, abnormalCount, totalCount }` |
| 筛选项数据 | `GET /sales-orders/filter-options` | 无 | `{ creators, paymentStates, deliveryStates, printStates, dateShortcuts, sortOptions }` |

#### `pages/order-detail/index` 销售单详情

| 功能 | 接口 | 入参 | 出参 |
| --- | --- | --- | --- |
| 销售单详情 | `GET /sales-orders/{id}` | `id` | `{ order: SalesOrder, amountRows, receiptInfo, canReceive, canPrint, canShare }` |
| 标记打印 | `POST /sales-orders/{id}/print` | `{ templateId?, copies? }` | `{ order: SalesOrder, printTaskId }` |
| 分享销售单 | `POST /sales-orders/{id}/share` | `{ channel }` | `{ shareUrl?, imageUrl?, ticketId }` |

#### `pages/order-receipt/index` 销售单收款

| 功能 | 接口 | 入参 | 出参 |
| --- | --- | --- | --- |
| 单据收款上下文 | `GET /sales-orders/{id}/receipt-context` | `id` | `{ order, defaultAmountCents, unpaidCents, receiptDate, canReceive }` |
| 提交本单收款 | `POST /sales-orders/{id}/receipts` | `{ amountCents, date, remark, requestId }` | `{ order: SalesOrder, customer: Customer, fundRecord: FundRecord }` |

### 客户

#### `pages/customers/index` 客户列表

| 功能 | 接口 | 入参 | 出参 |
| --- | --- | --- | --- |
| 客户分页列表 | `GET /customers` | `keyword, statusKey?, receivableState?, prepaidState?, recentOrderStart?, recentOrderEnd?, sortKey, page, pageSize` | `Page<Customer>` |
| 客户概览 | `GET /customers/summary` | 与列表筛选一致 | `{ receivableCustomerCount, receivableCents, prepaidCents, totalCount }` |
| 筛选项数据 | `GET /customers/filter-options` | 无 | `{ statusOptions, dateShortcuts, sortOptions, categories, areas }` |

#### `pages/customer-detail/index` 客户详情

| 功能 | 接口 | 入参 | 出参 |
| --- | --- | --- | --- |
| 客户详情 | `GET /customers/{id}` | `id` | `{ customer: Customer, amountMetrics }` |
| 销售记录分页 | `GET /customers/{id}/sales-orders` | `type?, page, pageSize` | `Page<SalesOrderListItem>` |
| 资金流水分页 | `GET /customers/{id}/fund-records` | `flowKind?, page, pageSize` | `Page<FundRecord>` |

#### `pages/customer-receipt/index` 客户整体收款

| 功能 | 接口 | 入参 | 出参 |
| --- | --- | --- | --- |
| 整体收款上下文/分摊预览 | `GET /customers/{id}/receipt-context` | `amountCents?, usePrepaid?, prepayMode?` | `{ customer, totalUnpaidCents, availablePrepaidCents, allocation: AllocationItem[], previewRows }` |
| 提交整体收款 | `POST /customers/{id}/receipts` | `{ amountCents, date, remark, usePrepaidCents?, prepayMode?, allocationMode: "oldest-first", requestId }` | `{ customer, fundRecords: FundRecord[], updatedOrders: SalesOrder[], allocation }` |

#### `pages/fund-detail/index` 资金流水详情

| 功能 | 接口 | 入参 | 出参 |
| --- | --- | --- | --- |
| 流水详情 | `GET /fund-records/{id}` | `id` | `{ fundRecord, relatedOrder?, resultRows, basicRows }` |

#### `pages/customer-edit/index` 新增/编辑客户

| 功能 | 接口 | 入参 | 出参 |
| --- | --- | --- | --- |
| 获取客户编辑表单 | `GET /customers/{id}` | `id` | `{ customer: Customer }` |
| 新增客户 | `POST /customers` | `{ name, phone?, category?, address?, openingReceivableCents?, remark? }` | `{ customer: Customer }` |
| 保存客户 | `PUT /customers/{id}` | `{ name, phone?, category?, address?, openingReceivableCents?, remark? }` | `{ customer: Customer }` |

#### `pages/customer-import/index` 客户导入导出

| 功能 | 接口 | 入参 | 出参 |
| --- | --- | --- | --- |
| 下载导入模板 | `GET /customers/import-template` | 无 | 文件流或 `{ downloadUrl }` |
| 上传客户文件 | `POST /customers/imports` | `multipart/form-data: file` | `{ taskId, status: "parsing" }` |
| 查询导入任务 | `GET /customers/imports/{taskId}` | `taskId` | `{ taskId, status, successCount, failCount, errorFileUrl?, errors[] }` |
| 创建导出任务 | `POST /customers/exports` | `{ scope: "current-filter/authorized", filters? }` | `{ taskId, status }` |
| 查询导出任务 | `GET /customers/exports/{taskId}` | `taskId` | `{ taskId, status, downloadUrl?, expireAt }` |
| 最近任务列表 | `GET /customers/import-export-tasks` | `page, pageSize` | `Page<ImportExportTask>` |

### 更多与产品库存

#### `pages/more/index` 更多入口

| 功能 | 接口 | 入参 | 出参 |
| --- | --- | --- | --- |
| 更多入口配置 | `GET /modules/more` | 无 | `{ groups: ModuleGroup[] }` |

#### `pages/products/index` 产品列表

| 功能 | 接口 | 入参 | 出参 |
| --- | --- | --- | --- |
| 产品分页列表 | `GET /products` | `keyword, categoryKey?, priceState?, stockState?, sortKey, page, pageSize` | `Page<Product>` |
| 产品概览 | `GET /products/summary` | 与列表筛选一致 | `{ productCount, variantCount, categoryCount, warningCount }` |
| 分类树 | `GET /product-categories/tree` | 无 | `{ list: CategoryNode[] }` |
| 产品筛选项 | `GET /products/filter-options` | 无 | `{ priceStates, stockStates, sortOptions, warehouses }` |

#### `pages/product-detail/index` 产品详情

| 功能 | 接口 | 入参 | 出参 |
| --- | --- | --- | --- |
| 产品详情 | `GET /products/{id}` | `id` | `{ product: Product, variants: ProductVariant[], inventorySummary }` |

#### `pages/product-edit/index` 新增/编辑产品

| 功能 | 接口 | 入参 | 出参 |
| --- | --- | --- | --- |
| 获取产品表单 | `GET /products/{id}` | `id` | `{ product: Product }` |
| 新增产品 | `POST /products` | `{ name, no?, imageUrl?, categoryKey, warehouseId, remark?, variants: ProductVariantInput[] }` | `{ product: Product }` |
| 保存产品 | `PUT /products/{id}` | `{ name, no?, imageUrl?, categoryKey, warehouseId, remark?, variants }` | `{ product: Product }` |
| 上传产品/颜色图片 | `POST /files/upload` | `multipart/form-data: file, scene` | `{ fileId, url }` |

`ProductVariantInput`：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | 编辑时传 |
| `color` | string | 颜色/规格名称 |
| `unit` | string | 单位 |
| `imageUrl` | string | 图片地址 |
| `priceCents` | number | 售价 |
| `costPriceCents` | number | 进价 |
| `stockQty` | number | 期初库存 |
| `lowerLimitQty` | number | 库存下限 |

#### `pages/product-import/index` 产品导入导出

| 功能 | 接口 | 入参 | 出参 |
| --- | --- | --- | --- |
| 下载产品模板 | `GET /products/import-template` | 无 | 文件流或 `{ downloadUrl }` |
| 上传产品文件 | `POST /products/imports` | `multipart/form-data: file` | `{ taskId, status }` |
| 查询导入任务 | `GET /products/imports/{taskId}` | `taskId` | `{ taskId, status, successCount, failCount, errorFileUrl?, errors[] }` |
| 创建导出任务 | `POST /products/exports` | `{ filters? }` | `{ taskId, status }` |
| 查询导出任务 | `GET /products/exports/{taskId}` | `taskId` | `{ taskId, status, downloadUrl?, expireAt }` |

#### `pages/product-categories/index` 产品分类

| 功能 | 接口 | 入参 | 出参 |
| --- | --- | --- | --- |
| 分类列表/树 | `GET /product-categories/tree` | `keyword?` | `{ list: CategoryNode[], summary }` |
| 新增分类 | `POST /product-categories` | `{ label, parentKey? }` | `{ category: CategoryNode }` |
| 编辑分类 | `PUT /product-categories/{key}` | `{ label, parentKey? }` | `{ category: CategoryNode, affectedProductCount }` |
| 分类导入模板 | `GET /product-categories/import-template` | 无 | 文件流或 `{ downloadUrl }` |
| 分类导入 | `POST /product-categories/imports` | `multipart/form-data: file` | `{ taskId, status }` |

#### `pages/warehouses/index` 仓库列表

| 功能 | 接口 | 入参 | 出参 |
| --- | --- | --- | --- |
| 仓库列表 | `GET /warehouses` | `keyword?, statusKey?` | `{ list: Warehouse[], summary }` |
| 停用/启用仓库 | `PATCH /warehouses/{id}/status` | `{ statusKey }` | `{ warehouse: Warehouse }` |

#### `pages/warehouse-edit/index` 新增/编辑仓库

| 功能 | 接口 | 入参 | 出参 |
| --- | --- | --- | --- |
| 获取仓库表单 | `GET /warehouses/{id}` | `id` | `{ warehouse: Warehouse }` |
| 新增仓库 | `POST /warehouses` | `{ name, keeper?, address?, isDefault?, statusKey }` | `{ warehouse: Warehouse }` |
| 保存仓库 | `PUT /warehouses/{id}` | `{ name, keeper?, address?, isDefault?, statusKey }` | `{ warehouse: Warehouse }` |

#### `pages/stock-summary/index` 库存总览

| 功能 | 接口 | 入参 | 出参 |
| --- | --- | --- | --- |
| 库存分页列表 | `GET /inventory` | `keyword, warehouseId?, statusKey?, sortKey, page, pageSize` | `Page<InventoryItem>` |
| 库存概览 | `GET /inventory/summary` | 与列表筛选一致 | `{ itemCount, totalStock, totalValueCents, lowCount, emptyCount, normalCount }` |
| 库存筛选项 | `GET /inventory/filter-options` | 无 | `{ warehouses, statusOptions, sortOptions }` |

#### `pages/stock-adjust/index` 库存调整

| 功能 | 接口 | 入参 | 出参 |
| --- | --- | --- | --- |
| 调整上下文 | `GET /inventory/{inventoryId}/adjust-context` | `inventoryId` | `{ item: InventoryItem, recentAdjustments: InventoryAdjustment[] }` |
| 保存库存调整 | `POST /inventory/adjustments` | `{ inventoryId, direction: "increase/decrease", quantity, note, requestId }` | `{ inventoryItem: InventoryItem, adjustment: InventoryAdjustment }` |

### 供应商、采购单、退货单

#### `pages/suppliers/index` 供应商列表

| 功能 | 接口 | 入参 | 出参 |
| --- | --- | --- | --- |
| 供应商列表 | `GET /suppliers` | `keyword, statusKey?, commonOnly?, page, pageSize` | `Page<Supplier>` |

#### `pages/supplier-detail/index` 供应商详情

| 功能 | 接口 | 入参 | 出参 |
| --- | --- | --- | --- |
| 供应商详情 | `GET /suppliers/{id}` | `id` | `{ supplier: Supplier, purchaseSummary }` |
| 最近采购记录 | `GET /suppliers/{id}/purchase-orders` | `page, pageSize` | `Page<PurchaseOrderListItem>` |

#### `pages/supplier-edit/index` 新增/编辑供应商

| 功能 | 接口 | 入参 | 出参 |
| --- | --- | --- | --- |
| 获取供应商表单 | `GET /suppliers/{id}` | `id` | `{ supplier: Supplier }` |
| 新增供应商 | `POST /suppliers` | `{ name, phone?, address?, remark?, isCommon?, statusKey }` | `{ supplier: Supplier }` |
| 保存供应商 | `PUT /suppliers/{id}` | `{ name, phone?, address?, remark?, isCommon?, statusKey }` | `{ supplier: Supplier }` |
| 停用/启用供应商 | `PATCH /suppliers/{id}/status` | `{ statusKey }` | `{ supplier: Supplier }` |

#### `pages/purchase-orders/index` 采购单列表

| 功能 | 接口 | 入参 | 出参 |
| --- | --- | --- | --- |
| 采购单列表 | `GET /purchase-orders` | `keyword, dateStart?, dateEnd?, supplierId?, warehouseId?, statusKey?, page, pageSize` | `Page<PurchaseOrderListItem>` |
| 采购筛选项 | `GET /purchase-orders/filter-options` | 无 | `{ suppliers, warehouses, statusOptions, dateShortcuts }` |

#### `pages/purchase-order-edit/index` 新增/编辑采购单

| 功能 | 接口 | 入参 | 出参 |
| --- | --- | --- | --- |
| 获取采购单表单 | `GET /purchase-orders/{id}` | `id` | `{ order: PurchaseOrder }` |
| 新增采购单 | `POST /purchase-orders` | `{ supplierId, date, warehouseId, remark?, discountCents?, items: PurchaseLineInput[], requestId }` | `{ order: PurchaseOrder, inventoryChanges? }` |
| 保存采购单 | `PUT /purchase-orders/{id}` | `{ supplierId, date, warehouseId, remark?, discountCents?, items }` | `{ order: PurchaseOrder, inventoryChanges? }` |
| 商品搜索选择 | `GET /products/search` | `keyword, page, pageSize` | `Page<Product>` |

`PurchaseLineInput`：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `productId` | string | 产品 ID |
| `variantId` | string | 颜色规格 ID |
| `quantity` | number | 数量 |
| `unitPriceCents` | number | 单价 |

#### `pages/purchase-order-detail/index` 采购单详情

| 功能 | 接口 | 入参 | 出参 |
| --- | --- | --- | --- |
| 采购单详情 | `GET /purchase-orders/{id}` | `id` | `{ order: PurchaseOrder, amountSummary, inventoryImpact }` |
| 采购单分享 | `POST /purchase-orders/{id}/share` | `{ channel }` | `{ shareUrl?, imageUrl? }` |

#### `pages/purchase-returns/index` 退货单列表

| 功能 | 接口 | 入参 | 出参 |
| --- | --- | --- | --- |
| 退货单列表 | `GET /purchase-returns` | `keyword, dateStart?, dateEnd?, customerId?, statusKey?, prepayApplied?, page, pageSize` | `Page<PurchaseReturnListItem>` |
| 退货概览 | `GET /purchase-returns/summary` | 与列表筛选一致 | `{ refundCents, prepayCents, pendingCents, totalCount }` |

#### `pages/purchase-return-edit/index` 新增/编辑退货单

| 功能 | 接口 | 入参 | 出参 |
| --- | --- | --- | --- |
| 获取退货单表单 | `GET /purchase-returns/{id}` | `id` | `{ returnOrder: PurchaseReturn }` |
| 新增退货单 | `POST /purchase-returns` | `{ customerId, date, warehouseId, refundCents, returnToPrepay, remark?, items: ReturnLineInput[], requestId }` | `{ returnOrder: PurchaseReturn, customer, inventoryChanges, fundRecords }` |
| 保存退货单 | `PUT /purchase-returns/{id}` | `{ customerId, date, warehouseId, refundCents, returnToPrepay, remark?, items }` | `{ returnOrder: PurchaseReturn, customer, inventoryChanges, fundRecords }` |
| 商品搜索选择 | `GET /products/search` | `keyword, page, pageSize` | `Page<Product>` |

#### `pages/purchase-return-detail/index` 退货单详情

| 功能 | 接口 | 入参 | 出参 |
| --- | --- | --- | --- |
| 退货单详情 | `GET /purchase-returns/{id}` | `id` | `{ returnOrder: PurchaseReturn, customer, amountSummary, inventoryImpact, fundRecords }` |

### 我的、组织、员工、消息

#### `pages/profile/index` 我的

| 功能 | 接口 | 入参 | 出参 |
| --- | --- | --- | --- |
| 个人中心首页 | `GET /profile/home` | 无 | `{ user, org, settings, helps, messageStats }` |

#### `pages/org-switch/index` 组织切换

| 功能 | 接口 | 入参 | 出参 |
| --- | --- | --- | --- |
| 组织列表 | `GET /organizations` | `keyword?` | `{ currentOrgId, list: Organization[] }` |
| 切换组织 | `POST /organizations/switch` | `{ orgId }` | `{ org: Organization, token?, permissions }` |

#### `pages/org-receipt-code/index` 组织收款码设置

| 功能 | 接口 | 入参 | 出参 |
| --- | --- | --- | --- |
| 获取收款码设置 | `GET /organizations/{orgId}/receipt-code` | `orgId` | `{ org, imageUrl, note }` |
| 上传收款码图片 | `POST /files/upload` | `multipart/form-data: file, scene="receipt-code"` | `{ fileId, url }` |
| 保存收款码设置 | `PUT /organizations/{orgId}/receipt-code` | `{ imageUrl, note }` | `{ org, imageUrl, note }` |

#### `pages/employees/index` 员工管理

| 功能 | 接口 | 入参 | 出参 |
| --- | --- | --- | --- |
| 员工列表 | `GET /employees` | `keyword, statusKey?, roleId?, page, pageSize` | `Page<Employee>` |
| 员工状态切换 | `PATCH /employees/{id}/status` | `{ statusKey }` | `{ employee: Employee }` |

#### `pages/employee-edit/index` 新增/编辑员工

| 功能 | 接口 | 入参 | 出参 |
| --- | --- | --- | --- |
| 获取员工表单 | `GET /employees/{id}` | `id` | `{ employee: Employee }` |
| 员工角色列表 | `GET /roles` | 无 | `{ list: Role[] }` |
| 可绑定仓库 | `GET /warehouses` | `statusKey="enabled"` | `{ list: Warehouse[] }` |
| 新增员工 | `POST /employees` | `{ name, phone, roleId, statusKey, warehouseIds, remark? }` | `{ employee: Employee }` |
| 保存员工 | `PUT /employees/{id}` | `{ name, phone, roleId, statusKey, warehouseIds, remark? }` | `{ employee: Employee }` |

#### `pages/employee-roles/index` 角色权限

| 功能 | 接口 | 入参 | 出参 |
| --- | --- | --- | --- |
| 角色权限列表 | `GET /roles` | 无 | `{ list: Role[] }` |

#### `pages/profile/message-center` 消息中心

| 功能 | 接口 | 入参 | 出参 |
| --- | --- | --- | --- |
| 消息列表 | `GET /messages` | `filter: "unread/read/inventory/print/system/all", page, pageSize` | `Page<Message>` |
| 消息统计 | `GET /messages/stats` | 无 | `{ total, unread }` |
| 全部标记已读 | `POST /messages/read-all` | 无 | `{ unread: 0 }` |

#### `pages/profile/message-detail` 消息详情

| 功能 | 接口 | 入参 | 出参 |
| --- | --- | --- | --- |
| 消息详情 | `GET /messages/{id}` | `id` | `{ message: Message }` |
| 标记单条已读 | `POST /messages/{id}/read` | 无 | `{ message: Message }` |

## 回写与一致性建议

1. 下单后：后端需要同时写入销售单、扣减库存、生成预收冲抵流水，并返回 `order`、`customer`、`inventoryChanges`、`fundRecords`。
2. 单据收款后：后端需要更新销售单 `receivedCents/paymentState`，生成资金流水，回写客户欠款/预收。
3. 客户整体收款后：后端按销售日期从旧到新自动分摊，返回分摊明细和被更新的销售单列表。
4. 采购单提交后：如业务规则要求入库，后端应写采购单并增加库存；草稿则不影响库存。
5. 退货单提交后：后端应写退货单、按 `returnToPrepay` 处理预收或退款、按仓库回写库存。
6. 库存调整后：后端应记录调整前、调整数、调整后、操作人和原因，方便追溯。
7. 所有列表接口必须支持分页；客户选择、商品选择、产品列表这类大数据弹层必须懒加载。
8. 前端当前没有真实登录流程，后端接入时需补登录态、组织权限和仓库权限过滤。

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
