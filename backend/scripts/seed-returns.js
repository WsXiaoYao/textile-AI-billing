const { prisma } = require('../src/prisma')
const { applyInventoryChange } = require('../src/routes/inventory')

const defaultOrgCode = 'org-main'

function amountToCents(value) {
  return Math.round(Number(value || 0) * 100)
}

function centsToAmount(cents) {
  return (Number(cents || 0) / 100).toFixed(2)
}

function makeDate(offset) {
  const date = new Date('2026-05-12T00:00:00.000Z')
  date.setUTCDate(date.getUTCDate() - offset)
  return date
}

async function resolveOrg() {
  return prisma.organization.upsert({
    where: { code: defaultOrgCode },
    update: {},
    create: {
      code: defaultOrgCode,
      name: '聚云掌柜'
    }
  })
}

async function getDefaultWarehouse(orgId) {
  const existing = await prisma.warehouse.findFirst({
    where: { orgId, status: 'enabled' },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }]
  })
  if (existing) return existing
  return prisma.warehouse.create({
    data: {
      orgId,
      name: '默认仓',
      manager: '王姐',
      address: '默认仓库',
      isDefault: true,
      status: 'enabled'
    }
  })
}

async function adjustCustomerPrepay(tx, orgId, customerId, amountCents, orderNo, occurredAt) {
  const customer = await tx.customer.findFirst({ where: { id: customerId, org_id: orgId } })
  if (!customer || amountCents <= 0) return
  const nextPrepaidCents = amountToCents(customer.prepaid_amount) + amountCents
  const unpaidCents = amountToCents(customer.unpaid_amount)
  await tx.customer.update({
    where: { id: customer.id },
    data: { prepaid_amount: centsToAmount(nextPrepaidCents) }
  })
  await tx.fundRecord.create({
    data: {
      orgId,
      customerId: customer.id,
      type: 'prepayment',
      amountCents,
      balanceCents: nextPrepaidCents - unpaidCents,
      occurredAt,
      note: `种子退货单 ${orderNo} 金额计入客户预收。`
    }
  })
}

async function main() {
  const org = await resolveOrg()
  const warehouse = await getDefaultWarehouse(org.id)
  const existingCount = await prisma.returnOrder.count({ where: { orgId: org.id } })
  if (existingCount > 0) {
    console.log(`[seed-returns] skipped, existing return orders: ${existingCount}`)
    return
  }

  const [customers, variants] = await Promise.all([
    prisma.customer.findMany({
      where: { org_id: org.id, is_active: true },
      orderBy: [{ updated_at: 'desc' }, { customer_name: 'asc' }],
      take: 48
    }),
    prisma.productVariant.findMany({
      include: { product: true },
      orderBy: { id: 'asc' },
      take: 96
    })
  ])

  if (!customers.length || !variants.length) {
    throw new Error('缺少客户或产品数据，请先导入客户和产品。')
  }

  const states = ['pending', 'partial', 'prepay', 'refunded']
  let created = 0
  for (let index = 0; index < 36; index += 1) {
    const no = `TH202605${String(1101 + index).padStart(4, '0')}`
    const customer = customers[index % customers.length]
    const orderDate = makeDate(index * 2)
    const lineCount = 1 + (index % 3)
    const rows = []
    for (let lineIndex = 0; lineIndex < lineCount; lineIndex += 1) {
      const variant = variants[(index * 3 + lineIndex * 7) % variants.length]
      const quantity = Number(((index % 4) + 1 + lineIndex * 0.5).toFixed(2))
      const unitCents = Math.max(amountToCents(variant.salePrice), 100)
      rows.push({
        productId: variant.product.id,
        variantId: variant.id,
        productName: variant.product.productName,
        color: variant.skuValue || '默认',
        unit: variant.unit || variant.product.defaultUnit || '件',
        quantity,
        unitCents,
        amountCents: Math.round(quantity * unitCents)
      })
    }
    const itemAmountCents = rows.reduce((sum, item) => sum + item.amountCents, 0)
    const state = states[index % states.length]
    const returnCents = state === 'partial' ? Math.max(Math.round(itemAmountCents * 0.55), 100) : itemAmountCents

    await prisma.$transaction(async tx => {
      const order = await tx.returnOrder.create({
        data: {
          orgId: org.id,
          no,
          customerId: customer.id,
          warehouseId: warehouse.id,
          orderDate,
          returnCents,
          receivedToPrepay: state === 'prepay',
          state,
          remark: index % 5 === 0 ? '客户退回，已检查可重新入库。' : ''
        }
      })
      await tx.returnOrderItem.createMany({
        data: rows.map(item => ({
          orderId: order.id,
          productId: item.productId,
          variantId: item.variantId,
          productName: item.productName,
          color: item.color,
          unit: item.unit,
          quantity: item.quantity.toFixed(2),
          unitCents: item.unitCents,
          amountCents: item.amountCents
        }))
      })
      for (const item of rows) {
        await applyInventoryChange(tx, {
          orgId: org.id,
          warehouseId: warehouse.id,
          warehouseName: warehouse.name,
          productId: item.productId,
          variantId: item.variantId,
          changeQty: item.quantity,
          type: 'return_in',
          refType: 'return_order',
          refId: order.id,
          reason: `退货入库 ${order.no}`,
          operator: '王姐'
        })
      }
      if (state === 'prepay') {
        await adjustCustomerPrepay(tx, org.id, customer.id, returnCents, no, orderDate)
      }
    })
    created += 1
  }

  console.log(`[seed-returns] created ${created} return orders`)
}

main()
  .catch(error => {
    console.error('[seed-returns] failed')
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
