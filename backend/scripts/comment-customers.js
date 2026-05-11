const { prisma } = require('../src/prisma')

const comments = [
  ['TABLE', 'customers', '客户表'],
  ['COLUMN', 'customers.id', '主键'],
  ['COLUMN', 'customers.org_id', '组织ID'],
  ['COLUMN', 'customers.customer_category_id', '客户分类ID'],
  ['COLUMN', 'customers.customer_name', '客户名称'],
  ['COLUMN', 'customers.customer_category', '客户分类'],
  ['COLUMN', 'customers.phone', '电话'],
  ['COLUMN', 'customers.backup_phone', '备用电话'],
  ['COLUMN', 'customers.fax', '传真'],
  ['COLUMN', 'customers.remark', '备注'],
  ['COLUMN', 'customers.address_short', '地址简称'],
  ['COLUMN', 'customers.province', '省份/地区'],
  ['COLUMN', 'customers.city', '城市'],
  ['COLUMN', 'customers.district', '区县'],
  ['COLUMN', 'customers.detail_address', '详细地址'],
  ['COLUMN', 'customers.address_remark', '地址备注'],
  ['COLUMN', 'customers.zipcode', '邮编'],
  ['COLUMN', 'customers.opening_debt', '期初欠款'],
  ['COLUMN', 'customers.contract_amount', '合同金额汇总'],
  ['COLUMN', 'customers.delivered_amount', '发货金额汇总'],
  ['COLUMN', 'customers.prepaid_amount', '预收金额'],
  ['COLUMN', 'customers.unpaid_amount', '未收金额'],
  ['COLUMN', 'customers.paid_amount', '已收金额'],
  ['COLUMN', 'customers.is_active', '是否启用'],
  ['COLUMN', 'customers.source_file', '来源文件'],
  ['COLUMN', 'customers.source_sheet', '来源工作表'],
  ['COLUMN', 'customers.source_row_no', '来源行号'],
  ['COLUMN', 'customers.customer_name_normalized', '客户名称标准化'],
  ['COLUMN', 'customers.customer_name_pinyin', '客户名称拼音'],
  ['COLUMN', 'customers.customer_name_initials', '客户名称首字母'],
  ['COLUMN', 'customers.created_at', '创建时间'],
  ['COLUMN', 'customers.updated_at', '更新时间']
]

const categoryComments = [
  ['TABLE', 'customer_categories', '客户分类表'],
  ['COLUMN', 'customer_categories.id', '主键'],
  ['COLUMN', 'customer_categories.org_id', '组织ID'],
  ['COLUMN', 'customer_categories.name', '分类名称'],
  ['COLUMN', 'customer_categories.sort_order', '排序'],
  ['COLUMN', 'customer_categories.is_active', '是否启用'],
  ['COLUMN', 'customer_categories.is_default', '是否默认分类'],
  ['COLUMN', 'customer_categories.created_at', '创建时间'],
  ['COLUMN', 'customer_categories.updated_at', '更新时间']
]

const financeComments = [
  ['TABLE', 'accounts', '收款账户表'],
  ['COLUMN', 'accounts.id', '主键'],
  ['COLUMN', 'accounts.org_id', '组织ID'],
  ['COLUMN', 'accounts.account_name', '账户名称'],
  ['COLUMN', 'accounts.init_balance', '期初余额'],
  ['COLUMN', 'accounts.current_balance', '当前余额'],
  ['COLUMN', 'accounts.remark', '备注'],
  ['COLUMN', 'accounts.status', '状态'],
  ['COLUMN', 'accounts.created_at', '创建时间'],
  ['COLUMN', 'accounts.updated_at', '更新时间'],
  ['TABLE', 'receipt_orders', '收款单表'],
  ['COLUMN', 'receipt_orders.id', '主键'],
  ['COLUMN', 'receipt_orders.org_id', '组织ID'],
  ['COLUMN', 'receipt_orders.receipt_no', '收款单号'],
  ['COLUMN', 'receipt_orders.customer_id', '客户ID'],
  ['COLUMN', 'receipt_orders.receipt_date', '收款日期'],
  ['COLUMN', 'receipt_orders.account_id', '收款账户ID'],
  ['COLUMN', 'receipt_orders.account_name_snapshot', '收款账户名称快照'],
  ['COLUMN', 'receipt_orders.receipt_amount', '收款金额'],
  ['COLUMN', 'receipt_orders.prepay_mode', '是否预收款'],
  ['COLUMN', 'receipt_orders.creator_user_id', '创建人ID'],
  ['COLUMN', 'receipt_orders.remark', '备注'],
  ['COLUMN', 'receipt_orders.created_at', '创建时间'],
  ['COLUMN', 'receipt_orders.updated_at', '更新时间'],
  ['TABLE', 'receipt_order_items', '收款单明细表'],
  ['COLUMN', 'receipt_order_items.id', '主键'],
  ['COLUMN', 'receipt_order_items.org_id', '组织ID'],
  ['COLUMN', 'receipt_order_items.receipt_id', '收款单ID'],
  ['COLUMN', 'receipt_order_items.sales_order_id', '销售单ID'],
  ['COLUMN', 'receipt_order_items.contract_amount', '合同金额'],
  ['COLUMN', 'receipt_order_items.received_amount_before', '本次收款前已收金额'],
  ['COLUMN', 'receipt_order_items.unreceived_amount_before', '本次收款前未收金额'],
  ['COLUMN', 'receipt_order_items.current_receive_amount', '本次收款金额'],
  ['COLUMN', 'receipt_order_items.created_at', '创建时间']
]

function escapeComment(value) {
  return String(value).replace(/'/g, "''")
}

async function main() {
  const allComments = comments.concat(categoryComments, financeComments)
  for (const [kind, target, comment] of allComments) {
    await prisma.$executeRawUnsafe(`COMMENT ON ${kind} ${target} IS '${escapeComment(comment)}'`)
  }
  console.log(`[comment-customers] ok comments=${allComments.length}`)
}

main()
  .catch(error => {
    console.error('[comment-customers] failed')
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
