# 数据库字段与需求说明书差异

本文对照 `/Users/xiaoyao/Documents/codex - 工作文件/纺织开单小工具/开单助手小程序SAAS需求说明书V1.3.md` 的 `4.3 关键数据表设计`，记录当前小程序后端数据库的实现状态。

## 已对齐

### 客户主档

当前 `customers` 表已经按后端同事提供的 `customers.sql` 作为主口径，并保留小程序展示兼容字段。

| 需求字段 | 当前字段 | 状态 |
| --- | --- | --- |
| `customer_name` | `customer_name` | 已对齐 |
| `phone` | `phone` | 已对齐 |
| `address` | `province/city/district/detail_address/address_short` | 已覆盖，当前比需求更细 |
| `remark` | `remark` | 已对齐 |
| `init_ar_amount` | `opening_debt` | 已覆盖，字段名沿用客户 SQL |
| `total_contract_amount` | `contract_amount` | 已覆盖，字段名沿用客户 SQL |
| `total_received_amount` | `paid_amount` | 已覆盖，字段名沿用客户 SQL |
| `total_unreceived_amount` | `unpaid_amount` | 已覆盖，字段名沿用客户 SQL |

### 客户分类

需求说明书没有单列客户分类表，但业务上客户分类需要每个用户/组织自行维护。当前已补充：

| 表 | 用途 | 状态 |
| --- | --- | --- |
| `customer_categories` | 维护客户分类名称、排序、启停用、默认分类 | 已补充 |
| `customers.customer_category_id` | 客户关联分类表 | 已补充 |
| `customers.customer_category` | 分类名称快照，便于导入和历史兼容 | 已保留 |

### 账户与收款

已按需求补齐账户表、收款主单、收款分摊明细表，并统一数据库列名为 snake_case。

| 需求表 | 当前表 | 状态 |
| --- | --- | --- |
| `account` | `accounts` | 已补充 |
| `receipt_order` | `receipt_orders` | 已补充 |
| `receipt_order_item` | `receipt_order_items` | 已补充 |

当前客户维度收款提交会生成：

| 写入对象 | 当前行为 |
| --- | --- |
| `receipt_orders` | 生成收款单号、客户、收款日期、账户快照、收款金额 |
| `receipt_order_items` | 记录本次客户维度分摊快照 |
| `fund_records` | 保留旧资金流水兼容层，供现有客户详情页展示 |
| `accounts.current_balance` | 按收款金额增加账户余额 |
| `customers` 汇总金额 | 更新已收、未收、预收金额 |

### 中文查看

为了方便在 Navicat 等数据库工具查看，已创建中文字段视图：

| 视图 | 对应表 |
| --- | --- |
| `customers_cn` | `customers` |
| `customer_categories_cn` | `customer_categories` |
| `accounts_cn` | `accounts` |
| `receipt_orders_cn` | `receipt_orders` |
| `receipt_order_items_cn` | `receipt_order_items` |

## 仍有差异

### 租户字段

需求要求所有业务数据都有 `tenant_id` 和 `org_id`。当前项目还没有独立 `tenant` 表，主要使用 `organizations` 和 `orgId/org_id` 隔离数据。

建议后续单独做一次租户迁移：

| 需求 | 当前状态 | 建议 |
| --- | --- | --- |
| `tenant` 表 | 未建 | 新增 `Tenant` 模型 |
| `org.tenant_id` | 未建 | `Organization` 增加 `tenantId` |
| 业务表 `tenant_id` | 未建 | 分批迁移，先基础资料后单据 |
| 用户组织关系 `user_org_rel` | 未建 | 当前用 `Employee/AuthSession` 过渡 |

这一步影响全库权限、登录态和数据隔离，不建议和客户字段调整混在一次小改里直接硬改。

### 组织设置

需求有 `org_setting.payment_qrcode_url/qrcode_remark`，当前还没有独立组织设置表。

建议后续新增：

| 表 | 字段 |
| --- | --- |
| `org_settings` | `org_id/payment_qrcode_url/qrcode_remark/created_at/updated_at` |

### 销售单字段

当前销售单仍是早期小程序字段，接口能跑通，但字段名还没有完全按需求说明书收敛。

| 需求字段 | 当前字段 | 差异 |
| --- | --- | --- |
| `order_no` | `no` | 名称不同 |
| `order_amount` | `orderCents` | 当前按分存整数 |
| `discount_amount` | `discountCents` | 当前按分存整数 |
| `contract_amount` | `contractCents` | 当前按分存整数 |
| `received_amount` | `receivedCents` | 当前按分存整数 |
| `unreceived_amount` | `unpaidCents` | 当前按分存整数 |
| `pay_status` | `paymentState` | 枚举名不同 |
| `print_status` | `printState` | 枚举名不同 |
| `creator_user_id` | `creator` | 当前只是文本 |

### 销售单明细字段

| 需求字段 | 当前字段 | 差异 |
| --- | --- | --- |
| `color_name` | `color` | 名称不同 |
| `stock_qty_snapshot` | 未建 | 缺少下单时库存快照 |
| `qty` | `quantity` | 名称不同 |
| `unit_name` | `unit` | 名称不同 |
| `unit_price` | `unitCents` | 当前按分存整数 |
| `amount` | `amountCents` | 当前按分存整数 |

### 退货单字段

当前 `ReturnOrder` 能表达基础退货，但比需求少退款账户和退款金额拆分。

| 需求字段 | 当前字段 | 差异 |
| --- | --- | --- |
| `return_no` | `no` | 名称不同 |
| `return_date` | `orderDate` | 名称不同 |
| `refund_amount` | 未建 | 缺少 |
| `refund_account_id` | 未建 | 缺少 |
| `refund_account_snapshot` | 未建 | 缺少 |
| `return_amount` | `returnCents` | 当前按分存整数 |
| `discount_amount` | 未建 | 缺少 |
| `payable_amount` | 未建 | 缺少 |
| `creator_user_id` | 未建 | 缺少 |
| `receivedToPrepay` | `receivedToPrepay` | 已覆盖“计入预收”语义 |

### 库存台账字段

当前库存拆成 `InventoryBalance` 和 `InventoryLedger`，比需求多了流水追踪，但字段名没有完全按需求统一。

| 需求字段 | 当前字段 | 差异 |
| --- | --- | --- |
| `product_id` | `variantId` 关联到颜色规格 | 当前通过规格反查产品 |
| `color_name` | `ProductVariant.color` | 颜色在规格表 |
| `qty` | `stockQty` | 名称不同 |
| `lower_limit_qty` | `ProductVariant.stockLowerQty` | 下限在规格表 |

## 后续处理顺序

建议继续按这个顺序做，降低返工：

1. 补 `tenant` 和 `org_setting`，统一 SaaS 数据边界。
2. 将销售单、销售单明细字段映射到需求命名，同时保留接口兼容层。
3. 将收款分摊从“客户汇总级”升级为“真实销售单逐单分摊”。
4. 补退货单退款账户、退款金额、实际应付等字段。
5. 最后再清理旧兼容字段和 mock 数据口径。
