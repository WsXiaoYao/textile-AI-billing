const { prisma } = require('../src/prisma')

const comments = [
  ['TABLE', 'sales_orders', '销售单表'],
  ['COLUMN', 'sales_orders.id', '主键'],
  ['COLUMN', 'sales_orders.org_id', '组织ID'],
  ['COLUMN', 'sales_orders.order_no', '销售单号'],
  ['COLUMN', 'sales_orders.customer_id', '客户ID'],
  ['COLUMN', 'sales_orders.warehouse_id', '仓库ID'],
  ['COLUMN', 'sales_orders.warehouse_name', '仓库名称'],
  ['COLUMN', 'sales_orders.order_date', '销售日期'],
  ['COLUMN', 'sales_orders.order_amount', '订单金额'],
  ['COLUMN', 'sales_orders.discount_amount', '优惠金额'],
  ['COLUMN', 'sales_orders.contract_amount', '合同金额'],
  ['COLUMN', 'sales_orders.received_amount', '已收金额'],
  ['COLUMN', 'sales_orders.unreceived_amount', '未收金额'],
  ['COLUMN', 'sales_orders.pay_status', '收款状态'],
  ['COLUMN', 'sales_orders.shipping_status', '送货状态'],
  ['COLUMN', 'sales_orders.print_status', '打印状态'],
  ['COLUMN', 'sales_orders.creator_user_id', '制单人ID'],
  ['COLUMN', 'sales_orders.creator_name', '制单人名称'],
  ['COLUMN', 'sales_orders.remark', '备注'],
  ['COLUMN', 'sales_orders.created_at', '创建时间'],
  ['COLUMN', 'sales_orders.updated_at', '更新时间'],
  ['TABLE', 'sales_order_items', '销售单明细表'],
  ['COLUMN', 'sales_order_items.id', '主键'],
  ['COLUMN', 'sales_order_items.org_id', '组织ID'],
  ['COLUMN', 'sales_order_items.order_id', '销售单ID'],
  ['COLUMN', 'sales_order_items.product_id', '产品ID'],
  ['COLUMN', 'sales_order_items.variant_id', 'SKU ID'],
  ['COLUMN', 'sales_order_items.product_name', '产品名称快照'],
  ['COLUMN', 'sales_order_items.color_name', '颜色/SKU值'],
  ['COLUMN', 'sales_order_items.stock_qty_snapshot', '下单时库存快照'],
  ['COLUMN', 'sales_order_items.qty', '数量'],
  ['COLUMN', 'sales_order_items.unit_name', '单位'],
  ['COLUMN', 'sales_order_items.unit_price', '单价'],
  ['COLUMN', 'sales_order_items.amount', '金额'],
  ['COLUMN', 'sales_order_items.created_at', '创建时间']
]

function escapeComment(value) {
  return String(value).replace(/'/g, "''")
}

async function main() {
  await prisma.$executeRawUnsafe('DROP VIEW IF EXISTS public.sales_order_items_cn')
  await prisma.$executeRawUnsafe('DROP VIEW IF EXISTS public.sales_orders_cn')
  await prisma.$executeRawUnsafe(`
    CREATE VIEW public.sales_orders_cn AS
    SELECT
      o.id AS "ID",
      o.org_id AS "组织ID",
      o.order_no AS "销售单号",
      o.customer_id AS "客户ID",
      c.customer_name AS "客户名称",
      o.warehouse_id AS "仓库ID",
      o.warehouse_name AS "仓库名称",
      o.order_date AS "销售日期",
      o.order_amount AS "订单金额",
      o.discount_amount AS "优惠金额",
      o.contract_amount AS "合同金额",
      o.received_amount AS "已收金额",
      o.unreceived_amount AS "未收金额",
      o.pay_status AS "收款状态",
      o.shipping_status AS "送货状态",
      o.print_status AS "打印状态",
      o.creator_user_id AS "制单人ID",
      o.creator_name AS "制单人名称",
      o.remark AS "备注",
      o.created_at AS "创建时间",
      o.updated_at AS "更新时间"
    FROM public.sales_orders o
    LEFT JOIN public.customers c ON c.id = o.customer_id;
  `)
  await prisma.$executeRawUnsafe(`COMMENT ON VIEW public.sales_orders_cn IS '销售单中文字段视图，只用于查看数据，不作为业务写入入口'`)

  await prisma.$executeRawUnsafe(`
    CREATE VIEW public.sales_order_items_cn AS
    SELECT
      i.id AS "ID",
      i.org_id AS "组织ID",
      i.order_id AS "销售单ID",
      o.order_no AS "销售单号",
      i.product_id AS "产品ID",
      i.variant_id AS "SKU ID",
      i.product_name AS "产品名称",
      i.color_name AS "颜色/SKU值",
      i.stock_qty_snapshot AS "下单时库存",
      i.qty AS "数量",
      i.unit_name AS "单位",
      i.unit_price AS "单价",
      i.amount AS "金额",
      i.created_at AS "创建时间"
    FROM public.sales_order_items i
    LEFT JOIN public.sales_orders o ON o.id = i.order_id;
  `)
  await prisma.$executeRawUnsafe(`COMMENT ON VIEW public.sales_order_items_cn IS '销售单明细中文字段视图，只用于查看数据，不作为业务写入入口'`)

  for (const [kind, target, comment] of comments) {
    await prisma.$executeRawUnsafe(`COMMENT ON ${kind} ${target} IS '${escapeComment(comment)}'`)
  }
  console.log(`[setup-sales-orders-db] ok views=sales_orders_cn,sales_order_items_cn comments=${comments.length}`)
}

main()
  .catch(error => {
    console.error('[setup-sales-orders-db] failed')
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
