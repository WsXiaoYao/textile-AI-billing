const { prisma } = require('../src/prisma')

async function main() {
  await prisma.$executeRawUnsafe('DROP VIEW IF EXISTS public.receipt_order_items_cn')
  await prisma.$executeRawUnsafe('DROP VIEW IF EXISTS public.receipt_orders_cn')
  await prisma.$executeRawUnsafe('DROP VIEW IF EXISTS public.accounts_cn')
  await prisma.$executeRawUnsafe('DROP VIEW IF EXISTS public.customer_categories_cn')
  await prisma.$executeRawUnsafe('DROP VIEW IF EXISTS public.customers_cn')
  await prisma.$executeRawUnsafe(`
    CREATE VIEW public.customers_cn AS
    SELECT
      id AS "ID",
      org_id AS "组织ID",
      customer_category_id AS "客户分类ID",
      customer_name AS "客户名称",
      customer_category AS "客户分类",
      phone AS "电话",
      backup_phone AS "备用电话",
      fax AS "传真",
      remark AS "备注",
      address_short AS "地址简称",
      province AS "省份地区",
      city AS "城市",
      district AS "区县",
      detail_address AS "详细地址",
      address_remark AS "地址备注",
      zipcode AS "邮编",
      opening_debt AS "期初欠款",
      contract_amount AS "合同金额汇总",
      delivered_amount AS "发货金额汇总",
      prepaid_amount AS "预收金额",
      unpaid_amount AS "未收金额",
      paid_amount AS "已收金额",
      is_active AS "是否启用",
      source_file AS "来源文件",
      source_sheet AS "来源工作表",
      source_row_no AS "来源行号",
      customer_name_normalized AS "客户名称标准化",
      customer_name_pinyin AS "客户名称拼音",
      customer_name_initials AS "客户名称首字母",
      created_at AS "创建时间",
      updated_at AS "更新时间"
    FROM public.customers;
  `)

  await prisma.$executeRawUnsafe(`COMMENT ON VIEW public.customers_cn IS '客户表中文字段视图，只用于查看数据，不作为业务写入入口'`)
  await prisma.$executeRawUnsafe(`
    CREATE VIEW public.customer_categories_cn AS
    SELECT
      id AS "ID",
      org_id AS "组织ID",
      name AS "分类名称",
      sort_order AS "排序",
      is_active AS "是否启用",
      is_default AS "是否默认分类",
      created_at AS "创建时间",
      updated_at AS "更新时间"
    FROM public.customer_categories;
  `)
  await prisma.$executeRawUnsafe(`COMMENT ON VIEW public.customer_categories_cn IS '客户分类中文字段视图，只用于查看数据，不作为业务写入入口'`)

  await prisma.$executeRawUnsafe(`
    CREATE VIEW public.accounts_cn AS
    SELECT
      id AS "ID",
      org_id AS "组织ID",
      account_name AS "账户名称",
      init_balance AS "期初余额",
      current_balance AS "当前余额",
      remark AS "备注",
      status AS "状态",
      created_at AS "创建时间",
      updated_at AS "更新时间"
    FROM public.accounts;
  `)
  await prisma.$executeRawUnsafe(`COMMENT ON VIEW public.accounts_cn IS '收款账户中文字段视图，只用于查看数据，不作为业务写入入口'`)

  await prisma.$executeRawUnsafe(`
    CREATE VIEW public.receipt_orders_cn AS
    SELECT
      id AS "ID",
      org_id AS "组织ID",
      receipt_no AS "收款单号",
      customer_id AS "客户ID",
      receipt_date AS "收款日期",
      account_id AS "收款账户ID",
      account_name_snapshot AS "收款账户名称快照",
      receipt_amount AS "收款金额",
      prepay_mode AS "是否预收款",
      creator_user_id AS "创建人ID",
      remark AS "备注",
      created_at AS "创建时间",
      updated_at AS "更新时间"
    FROM public.receipt_orders;
  `)
  await prisma.$executeRawUnsafe(`COMMENT ON VIEW public.receipt_orders_cn IS '收款单中文字段视图，只用于查看数据，不作为业务写入入口'`)

  await prisma.$executeRawUnsafe(`
    CREATE VIEW public.receipt_order_items_cn AS
    SELECT
      id AS "ID",
      org_id AS "组织ID",
      receipt_id AS "收款单ID",
      sales_order_id AS "销售单ID",
      contract_amount AS "合同金额",
      received_amount_before AS "本次收款前已收金额",
      unreceived_amount_before AS "本次收款前未收金额",
      current_receive_amount AS "本次收款金额",
      created_at AS "创建时间"
    FROM public.receipt_order_items;
  `)
  await prisma.$executeRawUnsafe(`COMMENT ON VIEW public.receipt_order_items_cn IS '收款单明细中文字段视图，只用于查看数据，不作为业务写入入口'`)

  console.log('[create-customers-cn-view] ok views=customers_cn,customer_categories_cn,accounts_cn,receipt_orders_cn,receipt_order_items_cn')
}

main()
  .catch(error => {
    console.error('[create-customers-cn-view] failed')
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
