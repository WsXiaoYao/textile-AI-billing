const { PrismaClient } = require('@prisma/client')
require('../src/env')

const prisma = new PrismaClient()
const defaultOrgCode = 'org-main'
const seedMark = '[seed:sales-orders]'

const creators = ['王姐', '涛', '邓', '航', '旺']
const payStatuses = ['unpaid', 'partial', 'paid', 'overpaid', 'prepaid', 'refunded']
const shippingStatuses = ['unshipped', 'partial', 'delivered', 'overdelivered', 'refused']
const printStatuses = ['unprinted', 'printed']

function amountToCents(value) {
  return Math.round(Number(value || 0) * 100)
}

function centsToAmount(cents) {
  return (Number(cents || 0) / 100).toFixed(2)
}

function dateText(date) {
  return date.toISOString().slice(0, 10)
}

function seededRandom(seed) {
  let value = seed % 2147483647
  if (value <= 0) value += 2147483646
  return () => {
    value = value * 16807 % 2147483647
    return (value - 1) / 2147483646
  }
}

function pick(list, random) {
  return list[Math.floor(random() * list.length) % list.length]
}

function addDays(date, days) {
  const next = new Date(date)
  next.setUTCDate(next.getUTCDate() + days)
  return next
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

async function ensureAccount(orgId) {
  const existing = await prisma.account.findFirst({
    where: { orgId, status: 'enabled' },
    orderBy: { createdAt: 'asc' }
  })
  if (existing) return existing
  return prisma.account.create({
    data: {
      orgId,
      accountName: '默认收款账户',
      initBalance: '0.00',
      currentBalance: '0.00',
      remark: '销售单种子数据默认账户。'
    }
  })
}

async function cleanupPreviousSeed(orgId) {
  const orders = await prisma.salesOrder.findMany({
    where: {
      orgId,
      remark: {
        startsWith: seedMark
      }
    },
    select: {
      id: true,
      customerId: true,
      contractAmount: true,
      receivedAmount: true,
      unreceivedAmount: true
    }
  })
  if (!orders.length) return

  const orderIds = orders.map(order => order.id)
  const receiptItems = await prisma.receiptOrderItem.findMany({
    where: {
      salesOrderId: {
        in: orderIds
      }
    },
    select: {
      receiptId: true
    }
  })
  const receiptIds = [...new Set(receiptItems.map(item => item.receiptId))]

  const customerDelta = new Map()
  orders.forEach(order => {
    const key = String(order.customerId)
    const existing = customerDelta.get(key) || { contract: 0, paid: 0, unpaid: 0 }
    existing.contract += amountToCents(order.contractAmount)
    existing.paid += amountToCents(order.receivedAmount)
    existing.unpaid += amountToCents(order.unreceivedAmount)
    customerDelta.set(key, existing)
  })

  await prisma.$transaction(async tx => {
    await tx.receiptOrderItem.deleteMany({ where: { salesOrderId: { in: orderIds } } })
    await tx.fundRecord.deleteMany({ where: { orderId: { in: orderIds } } })
    await tx.salesOrderItem.deleteMany({ where: { orderId: { in: orderIds } } })
    await tx.salesOrder.deleteMany({ where: { id: { in: orderIds } } })
    if (receiptIds.length) {
      await tx.receiptOrder.deleteMany({ where: { id: { in: receiptIds } } })
    }
    for (const [customerId, delta] of customerDelta.entries()) {
      const customer = await tx.customer.findUnique({ where: { id: BigInt(customerId) } })
      if (!customer) continue
      await tx.customer.update({
        where: { id: BigInt(customerId) },
        data: {
          contract_amount: centsToAmount(Math.max(amountToCents(customer.contract_amount) - delta.contract, 0)),
          paid_amount: centsToAmount(Math.max(amountToCents(customer.paid_amount) - delta.paid, 0)),
          unpaid_amount: centsToAmount(Math.max(amountToCents(customer.unpaid_amount) - delta.unpaid, 0))
        }
      })
    }
  })
}

function buildStatusAmounts(status, contractCents, random) {
  if (status === 'unpaid') return { receivedCents: 0, unreceivedCents: contractCents }
  if (status === 'partial') {
    const rate = 0.2 + random() * 0.55
    const receivedCents = Math.max(Math.round(contractCents * rate), 1)
    return { receivedCents, unreceivedCents: Math.max(contractCents - receivedCents, 0) }
  }
  if (status === 'overpaid') {
    const receivedCents = contractCents + Math.round((20 + random() * 300) * 100)
    return { receivedCents, unreceivedCents: 0 }
  }
  return { receivedCents: contractCents, unreceivedCents: 0 }
}

async function main() {
  const org = await resolveOrg()
  const account = await ensureAccount(org.id)
  await cleanupPreviousSeed(org.id)

  const customers = await prisma.customer.findMany({
    where: {
      org_id: org.id,
      is_active: true
    },
    orderBy: { id: 'asc' },
    take: 80
  })
  const products = await prisma.product.findMany({
    where: {
      variants: {
        some: {}
      }
    },
    include: {
      variants: {
        orderBy: { id: 'asc' }
      }
    },
    orderBy: { id: 'asc' },
    take: 160
  })
  if (!customers.length || !products.length) {
    throw new Error('缺少客户或产品数据，请先导入 customers/product 数据')
  }

  const random = seededRandom(20260511)
  const startDate = new Date('2026-02-17T00:00:00.000Z')
  const orderCount = 160
  const customerDelta = new Map()
  let totalReceiptCents = 0

  for (let index = 0; index < orderCount; index += 1) {
    const customer = customers[index % customers.length]
    const orderDate = addDays(startDate, Math.floor(random() * 84))
    const ymd = dateText(orderDate).replace(/-/g, '')
    const orderNo = `XS${ymd}${String(index + 1).padStart(4, '0')}`
    const itemCount = 1 + Math.floor(random() * 4)
    const used = new Set()
    const items = []
    for (let line = 0; line < itemCount; line += 1) {
      const product = products[(index * 7 + line * 13) % products.length]
      const variants = product.variants.length ? product.variants : []
      if (!variants.length) continue
      const variant = variants[(index + line) % variants.length]
      const key = `${product.id}-${variant.id}`
      if (used.has(key)) continue
      used.add(key)
      const qty = Number((1 + random() * 48).toFixed(2))
      const basePriceCents = Math.max(amountToCents(variant.salePrice), 100)
      const unitPriceCents = Math.max(Math.round(basePriceCents * (0.9 + random() * 0.35)), 1)
      const amountCents = Math.round(qty * unitPriceCents)
      items.push({
        product,
        variant,
        qty,
        unitPriceCents,
        amountCents
      })
    }
    if (!items.length) continue

    const orderAmountCents = items.reduce((sum, item) => sum + item.amountCents, 0)
    const discountCents = index % 5 === 0 ? Math.round(orderAmountCents * (0.02 + random() * 0.05)) : 0
    const contractCents = Math.max(orderAmountCents - discountCents, 0)
    const payStatus = payStatuses[index % payStatuses.length]
    const { receivedCents, unreceivedCents } = buildStatusAmounts(payStatus, contractCents, random)
    const shippingStatus = shippingStatuses[(index + Math.floor(random() * 3)) % shippingStatuses.length]
    const printStatus = printStatuses[(index + Math.floor(random() * 2)) % printStatuses.length]
    const creatorName = creators[index % creators.length]

    await prisma.$transaction(async tx => {
      const order = await tx.salesOrder.create({
        data: {
          orgId: org.id,
          orderNo,
          customerId: customer.id,
          warehouseName: index % 9 === 0 ? '二号仓' : '默认仓',
          orderDate,
          orderAmount: centsToAmount(orderAmountCents),
          discountAmount: centsToAmount(discountCents),
          contractAmount: centsToAmount(contractCents),
          receivedAmount: centsToAmount(receivedCents),
          unreceivedAmount: centsToAmount(unreceivedCents),
          payStatus,
          shippingStatus,
          printStatus,
          creatorName,
          remark: `${seedMark} ${customer.customer_name} 历史销售单`
        }
      })
      await tx.salesOrderItem.createMany({
        data: items.map(item => ({
          orgId: org.id,
          orderId: order.id,
          productId: item.product.id,
          variantId: item.variant.id,
          productName: item.product.productName,
          colorName: item.variant.skuValue || item.variant.skuCode || '默认',
          stockQtySnapshot: centsToAmount(Math.round(Number(item.variant.openingStock || 0) * 100)),
          qty: item.qty.toFixed(2),
          unitName: item.variant.unit || item.product.defaultUnit || '件',
          unitPrice: centsToAmount(item.unitPriceCents),
          amount: centsToAmount(item.amountCents)
        }))
      })
      if (receivedCents > 0) {
        const receipt = await tx.receiptOrder.create({
          data: {
            orgId: org.id,
            receiptNo: `SK${ymd}${String(index + 1).padStart(4, '0')}`,
            customerId: customer.id,
            receiptDate: orderDate,
            accountId: account.id,
            accountNameSnapshot: account.accountName,
            receiptAmount: centsToAmount(receivedCents),
            prepayMode: payStatus === 'prepaid',
            remark: payStatus === 'prepaid' ? '种子数据：预收款冲抵销售单' : '种子数据：销售单收款'
          }
        })
        await tx.receiptOrderItem.create({
          data: {
            orgId: org.id,
            receiptId: receipt.id,
            salesOrderId: order.id,
            contractAmount: centsToAmount(contractCents),
            receivedAmountBefore: '0.00',
            unreceivedAmountBefore: centsToAmount(contractCents),
            currentReceiveAmount: centsToAmount(receivedCents)
          }
        })
        await tx.fundRecord.create({
          data: {
            orgId: org.id,
            customerId: customer.id,
            orderId: order.id,
            type: payStatus === 'prepaid' ? 'prepayment_offset' : 'sales_receipt',
            amountCents: receivedCents,
            balanceCents: unreceivedCents,
            note: `${seedMark} ${orderNo}`
          }
        })
      }
    })

    totalReceiptCents += receivedCents
    const customerKey = String(customer.id)
    const existing = customerDelta.get(customerKey) || { customer, contract: 0, paid: 0, unpaid: 0 }
    existing.contract += contractCents
    existing.paid += receivedCents
    existing.unpaid += unreceivedCents
    customerDelta.set(customerKey, existing)
  }

  for (const entry of customerDelta.values()) {
    const latest = await prisma.customer.findUnique({ where: { id: entry.customer.id } })
    await prisma.customer.update({
      where: { id: entry.customer.id },
      data: {
        contract_amount: centsToAmount(amountToCents(latest.contract_amount) + entry.contract),
        paid_amount: centsToAmount(amountToCents(latest.paid_amount) + entry.paid),
        unpaid_amount: centsToAmount(amountToCents(latest.unpaid_amount) + entry.unpaid)
      }
    })
  }
  await prisma.account.update({
    where: { id: account.id },
    data: {
      currentBalance: {
        increment: centsToAmount(totalReceiptCents)
      }
    }
  })

  console.log(`[seed-sales-orders] ok orders=${orderCount} customers=${customerDelta.size} receipts=${centsToAmount(totalReceiptCents)}`)
}

main()
  .catch(error => {
    console.error('[seed-sales-orders] failed')
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
