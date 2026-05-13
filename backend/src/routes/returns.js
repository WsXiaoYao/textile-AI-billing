const { ok, fail } = require('../response')
const { applyInventoryChange } = require('./inventory')
const { resolveOrgId: resolveRequestOrgId } = require('../request-context')
const { canAccessWarehouse, isWarehouseScoped } = require('../permissions')
const { writeAudit } = require('../audit-log')

const defaultOrgCode = 'org-main'

function normalizeText(value) {
  return String(value || '').trim()
}

function amountToCents(value) {
  return Math.round(Number(value || 0) * 100)
}

function centsToAmount(cents) {
  return (Number(cents || 0) / 100).toFixed(2)
}

function formatMoney(cents) {
  const absCents = Math.abs(Number(cents || 0))
  const yuan = Math.floor(absCents / 100)
  const fen = absCents % 100
  const sign = Number(cents || 0) < 0 ? '-' : ''
  return `${sign}¥${String(yuan).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}${fen ? `.${String(fen).padStart(2, '0')}` : ''}`
}

function formatAmountInput(cents) {
  return centsToAmount(cents)
}

function formatNumber(value) {
  const number = Number(value || 0)
  if (Number.isInteger(number)) return String(number)
  return String(Number(number.toFixed(2)))
}

function formatDate(value) {
  if (!value) return ''
  if (typeof value === 'string') return value.slice(0, 10)
  return value.toISOString().slice(0, 10)
}

function parseDate(value, fallback = new Date()) {
  const text = normalizeText(value)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return fallback
  return new Date(`${text}T00:00:00.000Z`)
}

function parseQty(value) {
  const number = Number(String(value || '').replace(/[^\d.]/g, ''))
  return Number.isFinite(number) ? number : 0
}

function parseCents(payload, centsKey, amountKey, fallback = 0) {
  if (payload && payload[centsKey] !== undefined) return Number(payload[centsKey] || 0)
  if (payload && payload[amountKey] !== undefined) return amountToCents(payload[amountKey])
  return fallback
}

async function resolveOrgId(prisma, request) {
  return resolveRequestOrgId(prisma, request)
}

function makeReturnNo() {
  const date = new Date()
  const ymd = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
  ].join('')
  return `TH${ymd}${String(Date.now()).slice(-4)}`
}

function makeReceiptNo() {
  const date = new Date()
  const ymd = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
  ].join('')
  return `SK${ymd}${String(Date.now()).slice(-4)}`
}

function getCustomerAddress(customer) {
  if (!customer) return ''
  return customer.detail_address || customer.address_short || [
    customer.province,
    customer.city,
    customer.district
  ].filter(Boolean).join('')
}

function stateMeta(state) {
  if (state === 'partial') return { statusKey: 'partial', statusText: '部分退款', statusTone: 'warning' }
  if (state === 'prepay') return { statusKey: 'prepay', statusText: '计入预收', statusTone: 'primary' }
  if (state === 'refunded') return { statusKey: 'refunded', statusText: '已退款', statusTone: 'success' }
  return { statusKey: 'pending', statusText: '未退款', statusTone: 'danger' }
}

function toReturnLineDto(item, index = 0) {
  const quantity = Number(item.quantity || 0)
  const unitPriceCents = Number(item.unitCents || 0)
  const amountCents = Number(item.amountCents || Math.round(quantity * unitPriceCents))
  const product = item.product || {}
  const variant = item.variant || {}
  const unit = item.unit || variant.unit || product.defaultUnit || '件'
  const stockQty = Number(item.stockQty !== undefined ? item.stockQty : variant.openingStock || 0)
  return {
    id: item.id || `${item.productId || 'item'}-${item.variantId || index}`,
    productId: String(item.productId || product.id || ''),
    variantId: String(item.variantId || variant.id || ''),
    productName: item.productName || product.productName || '退货品项',
    color: item.color || variant.skuValue || '默认',
    unit,
    stockQty,
    quantity,
    quantityInput: formatNumber(quantity),
    quantityText: `${formatNumber(quantity)} ${unit}`,
    unitPriceCents,
    unitPriceInput: formatAmountInput(unitPriceCents),
    unitPriceText: formatMoney(unitPriceCents),
    stockText: `库存 ${formatNumber(stockQty)}${unit}`,
    amountCents,
    amountText: formatMoney(amountCents)
  }
}

function toReturnOrderDto(order) {
  const items = (order.items || []).map(toReturnLineDto)
  const itemAmountCents = items.reduce((sum, item) => sum + item.amountCents, 0)
  const refundCents = Number(order.returnCents || itemAmountCents)
  const customer = order.customer || {}
  const salesOrder = order.salesOrder || {}
  const customerName = customer.customer_name || order.customerName || '未选择客户'
  const warehouseName = order.warehouse ? order.warehouse.name : order.warehouseName || '默认仓'
  const status = stateMeta(order.state)
  return {
    id: order.id,
    no: order.no,
    salesOrderId: order.salesOrderId ? String(order.salesOrderId) : '',
    salesOrderNo: salesOrder.orderNo || '',
    sourceText: salesOrder.orderNo ? `关联销售单 ${salesOrder.orderNo}` : '未关联销售单',
    customerId: String(order.customerId || ''),
    customerName,
    customerPhone: customer.phone || '',
    customerAddress: getCustomerAddress(customer),
    date: formatDate(order.orderDate),
    warehouseId: order.warehouseId || '',
    warehouseName,
    refundCents,
    refundInput: formatAmountInput(refundCents),
    refundText: formatMoney(refundCents),
    itemAmountCents,
    itemAmountText: formatMoney(itemAmountCents),
    returnToPrepay: Boolean(order.receivedToPrepay),
    receivedToPrepay: Boolean(order.receivedToPrepay),
    refundDirectionText: order.receivedToPrepay ? '退货款计入客户预收余额。' : '退货款待线下退款确认。',
    remark: order.remark || '',
    stockApplied: true,
    prepayApplied: Boolean(order.receivedToPrepay),
    items,
    itemCount: items.length,
    itemSummary: items.length ? `${items[0].productName} 等${items.length}条明细` : '无退货明细',
    searchText: [
      order.no,
      salesOrder.orderNo,
      customerName,
      customer.phone,
      warehouseName,
      items.map(item => `${item.productName} ${item.color}`).join(' ')
    ].join(' ').toLowerCase(),
    ...status
  }
}

function buildSummary(orders) {
  const list = orders || []
  const pendingCount = list.filter(item => item.statusKey === 'pending' || item.statusKey === 'partial').length
  const prepayCents = list.filter(item => item.returnToPrepay).reduce((sum, item) => sum + item.refundCents, 0)
  const refundCents = list.reduce((sum, item) => sum + item.refundCents, 0)
  return {
    pendingCount,
    prepayCents,
    refundCents,
    pendingText: `${pendingCount}单`,
    prepayText: formatMoney(prepayCents),
    refundText: formatMoney(refundCents)
  }
}

async function getDefaultWarehouse(prisma, orgId) {
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

async function normalizeReturnItems(prisma, items = []) {
  const errors = []
  const rows = []
  for (const [index, raw] of items.entries()) {
    const productIdText = normalizeText(raw.productId)
    const variantIdText = normalizeText(raw.variantId)
    const productId = /^\d+$/.test(productIdText) ? BigInt(productIdText) : null
    const variantId = /^\d+$/.test(variantIdText) ? BigInt(variantIdText) : null
    const variant = variantId ? await prisma.productVariant.findUnique({
      where: { id: variantId },
      include: { product: true }
    }) : null
    const product = variant ? variant.product : productId ? await prisma.product.findUnique({ where: { id: productId } }) : null
    if (!product || !variant) {
      errors.push(`第${index + 1}条退货明细请选择有效产品`)
      continue
    }
    const quantity = parseQty(raw.quantity || raw.qty || raw.quantityInput)
    const unitCents = parseCents(raw, 'unitPriceCents', 'unitPrice', amountToCents(variant.salePrice))
    if (quantity <= 0) errors.push(`第${index + 1}条退货数量必须大于0`)
    if (unitCents <= 0) errors.push(`第${index + 1}条退货单价必须大于0`)
    rows.push({
      productId: product.id,
      variantId: variant.id,
      productName: product.productName,
      color: normalizeText(raw.color) || variant.skuValue || '默认',
      unit: normalizeText(raw.unit) || variant.unit || product.defaultUnit || '件',
      quantity,
      unitCents,
      amountCents: Math.round(quantity * unitCents)
    })
  }
  return { errors, rows }
}

async function adjustCustomerPrepay(tx, orgId, customerId, deltaCents, note, occurredAt) {
  if (!customerId || !deltaCents) return null
  const customer = await tx.customer.findFirst({ where: { id: customerId, org_id: orgId } })
  if (!customer) return null
  const nextPrepaidCents = Math.max(amountToCents(customer.prepaid_amount) + deltaCents, 0)
  const unpaidCents = amountToCents(customer.unpaid_amount)
  await tx.customer.update({
    where: { id: customer.id },
    data: { prepaid_amount: centsToAmount(nextPrepaidCents) }
  })
  await tx.fundRecord.create({
    data: {
      orgId,
      customerId: customer.id,
      type: deltaCents > 0 ? 'prepayment' : 'prepayment_offset',
      amountCents: Math.abs(deltaCents),
      balanceCents: nextPrepaidCents - unpaidCents,
      occurredAt,
      note
    }
  })
  return nextPrepaidCents
}

async function ensureDefaultAccount(tx, orgId) {
  const existing = await tx.account.findFirst({
    where: { orgId, status: 'enabled' },
    orderBy: { createdAt: 'asc' }
  })
  if (existing) return existing
  return tx.account.create({
    data: {
      orgId,
      accountName: '默认收款账户',
      initBalance: '0.00',
      currentBalance: '0.00',
      remark: '系统自动创建，用于退货退款记录。'
    }
  })
}

async function deleteReturnRefundRecords(tx, orgId, returnId) {
  const marker = `[return:${returnId}]`
  const receipts = await tx.receiptOrder.findMany({
    where: {
      orgId,
      remark: { startsWith: marker }
    },
    select: { id: true }
  })
  const receiptIds = receipts.map(item => item.id)
  if (receiptIds.length) {
    await tx.receiptOrderItem.deleteMany({ where: { orgId, receiptId: { in: receiptIds } } })
    await tx.receiptOrder.deleteMany({ where: { orgId, id: { in: receiptIds } } })
  }
  await tx.fundRecord.deleteMany({
    where: {
      orgId,
      note: { startsWith: marker }
    }
  })
}

async function createReturnRefundReceipt(tx, orgId, customer, order, refundCents, orderDate, creatorUserId) {
  if (!refundCents) return null
  const account = await ensureDefaultAccount(tx, orgId)
  const marker = `[return:${order.id}]`
  const receipt = await tx.receiptOrder.create({
    data: {
      orgId,
      receiptNo: makeReceiptNo(),
      customerId: customer.id,
      receiptDate: orderDate,
      accountId: account.id,
      accountNameSnapshot: account.accountName,
      receiptAmount: centsToAmount(-refundCents),
      prepayMode: false,
      creatorUserId: creatorUserId || null,
      remark: `${marker} 退货单 ${order.no} 退款`
    }
  })
  await tx.receiptOrderItem.create({
    data: {
      orgId,
      receiptId: receipt.id,
      salesOrderId: order.salesOrderId || null,
      contractAmount: centsToAmount(-refundCents),
      receivedAmountBefore: '0.00',
      unreceivedAmountBefore: '0.00',
      currentReceiveAmount: centsToAmount(-refundCents)
    }
  })
  const nextPaidCents = amountToCents(customer.paid_amount) - refundCents
  await tx.customer.update({
    where: { id: customer.id },
    data: {
      paid_amount: centsToAmount(nextPaidCents)
    }
  })
  await tx.fundRecord.create({
    data: {
      orgId,
      customerId: customer.id,
      orderId: order.salesOrderId || null,
      type: 'refund',
      amountCents: -refundCents,
      balanceCents: amountToCents(customer.prepaid_amount) - amountToCents(customer.unpaid_amount),
      occurredAt: orderDate,
      note: `${marker} 退货单 ${order.no} 退款 ${formatMoney(refundCents)}`
    }
  })
  return receipt
}

async function loadOrder(prisma, orgId, id) {
  return prisma.returnOrder.findFirst({
    where: { id: String(id || ''), orgId },
    include: {
      customer: true,
      salesOrder: true,
      warehouse: true,
      items: {
        include: { product: true, variant: true },
        orderBy: { createdAt: 'asc' }
      }
    }
  })
}

async function loadSalesOrder(prisma, orgId, id) {
  const text = normalizeText(id)
  if (!/^\d+$/.test(text)) return null
  return prisma.salesOrder.findFirst({
    where: {
      id: BigInt(text),
      orgId
    },
    include: {
      customer: true,
      items: {
        orderBy: { id: 'asc' }
      }
    }
  })
}

function buildReturnLinesFromSalesOrder(salesOrder) {
  return (salesOrder.items || []).map((item, index) => {
    const quantity = Number(item.qty || 0)
    const unitCents = amountToCents(item.unitPrice)
    return toReturnLineDto({
      id: `sales-${item.id}-${index}`,
      productId: item.productId,
      variantId: item.variantId,
      productName: item.productName,
      color: item.colorName,
      unit: item.unitName,
      quantity,
      unitCents,
      amountCents: amountToCents(item.amount)
    }, index)
  })
}

function validateAgainstSalesOrder(errors, rows, salesOrder) {
  if (!salesOrder) return
  const soldMap = new Map()
  ;(salesOrder.items || []).forEach(item => {
    const key = String(item.variantId)
    soldMap.set(key, (soldMap.get(key) || 0) + Number(item.qty || 0))
  })
  rows.forEach((item, index) => {
    const soldQty = soldMap.get(String(item.variantId)) || 0
    if (soldQty <= 0) errors.push(`第${index + 1}条退货明细不属于关联销售单`)
    if (Number(item.quantity || 0) > soldQty) errors.push(`第${index + 1}条退货数量不能大于原销售数量`)
  })
}

async function returnRoutes(app) {
  app.get('/return-options/customers', async request => {
    const orgId = await resolveOrgId(app.prisma, request)
    const customers = await app.prisma.customer.findMany({
      where: { org_id: orgId, is_active: true },
      orderBy: [{ updated_at: 'desc' }, { customer_name: 'asc' }],
      take: 300
    })
    return ok(customers.map(customer => ({
      id: String(customer.id),
      name: customer.customer_name,
      phone: customer.phone || '',
      address: getCustomerAddress(customer),
      tag: customer.customer_category || ''
    })), request.id)
  })

  app.get('/return-options/warehouses', async request => {
    const orgId = await resolveOrgId(app.prisma, request)
    const ids = isWarehouseScoped(request.orgContext, 'returns') ? request.orgContext.warehouseIds || [] : []
    const warehouses = await app.prisma.warehouse.findMany({
      where: { orgId, status: 'enabled', ...(ids.length ? { id: { in: ids } } : {}) },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }]
    })
    if (!warehouses.length) {
      const warehouse = await getDefaultWarehouse(app.prisma, orgId)
      return ok([{ id: warehouse.id, name: warehouse.name }], request.id)
    }
    return ok(warehouses.map(warehouse => ({ id: warehouse.id, name: warehouse.name })), request.id)
  })

  app.get('/return-options/products', async request => {
    const orgId = await resolveOrgId(app.prisma, request)
    const query = request.query || {}
    const keyword = normalizeText(query.keyword)
    const take = Math.min(Math.max(Number(query.limit || 180), 1), 260)
    const where = keyword ? {
      OR: [
        { productName: { contains: keyword, mode: 'insensitive' } },
        { productCode: { contains: keyword, mode: 'insensitive' } },
        { categoryName: { contains: keyword, mode: 'insensitive' } }
      ]
    } : {}
    const products = await app.prisma.product.findMany({
      where,
      include: {
        variants: {
          include: {
            inventoryBalances: {
              where: { orgId },
              include: { warehouse: true }
            }
          },
          orderBy: { id: 'asc' },
          take: 20
        }
      },
      orderBy: { id: 'desc' },
      take
    })
    const options = []
    products.forEach(product => {
      product.variants.forEach(variant => {
        const balance = variant.inventoryBalances[0]
        const unit = variant.unit || product.defaultUnit || '件'
        const stockQty = balance ? Number(balance.stockQty || 0) : Number(variant.openingStock || 0)
        const priceCents = Math.max(amountToCents(variant.salePrice), 0)
        options.push({
          id: `${product.id}__${variant.id}`,
          productId: String(product.id),
          variantId: String(variant.id),
          productName: product.productName,
          productNo: product.productCode || '',
          color: variant.skuValue || '默认',
          unit,
          stockQty,
          priceCents,
          categoryPathText: product.categoryName || '',
          categoryLeaf: product.categoryName || '',
          warehouseName: balance && balance.warehouse ? balance.warehouse.name : variant.warehouseName || '默认仓',
          searchText: [
            product.productName,
            product.productCode,
            product.categoryName,
            variant.skuValue,
            variant.skuCode,
            variant.warehouseName,
            unit
          ].join(' ').toLowerCase()
        })
      })
    })
    return ok(options, request.id)
  })

  app.get('/return-orders', async request => {
    const orgId = await resolveOrgId(app.prisma, request)
    const query = request.query || {}
    const where = { orgId }
    const ids = isWarehouseScoped(request.orgContext, 'returns') ? request.orgContext.warehouseIds || [] : []
    if (ids.length) where.warehouseId = { in: ids }
    if (query.status && query.status !== 'all') where.state = query.status
    if (query.customerId) where.customerId = BigInt(String(query.customerId))
    if (query.warehouseId) where.warehouseId = String(query.warehouseId)
    const orders = await app.prisma.returnOrder.findMany({
      where,
      include: {
        customer: true,
        salesOrder: true,
        warehouse: true,
        items: {
          include: { product: true, variant: true },
          orderBy: { createdAt: 'asc' }
        }
      },
      orderBy: [{ orderDate: 'desc' }, { no: 'desc' }]
    })
    return ok({
      page: 1,
      pageSize: orders.length,
      total: orders.length,
      hasMore: false,
      list: orders.map(toReturnOrderDto)
    }, request.id)
  })

  app.get('/return-orders/summary', async request => {
    const orgId = await resolveOrgId(app.prisma, request)
    const orders = await app.prisma.returnOrder.findMany({
      where: { orgId },
      include: {
        customer: true,
        salesOrder: true,
        warehouse: true,
        items: { include: { product: true, variant: true } }
      }
    })
    return ok(buildSummary(orders.map(toReturnOrderDto)), request.id)
  })

  app.get('/return-orders/:id/form', async (request, reply) => {
    const orgId = await resolveOrgId(app.prisma, request)
    const id = normalizeText(request.params.id)
    if (!id || id === 'undefined') {
      const salesOrder = await loadSalesOrder(app.prisma, orgId, request.query && request.query.salesOrderId)
      const [fallbackCustomer, warehouse] = await Promise.all([
        salesOrder ? null : app.prisma.customer.findFirst({ where: { org_id: orgId, is_active: true }, orderBy: [{ updated_at: 'desc' }] }),
        getDefaultWarehouse(app.prisma, orgId)
      ])
      const customer = salesOrder && salesOrder.customer ? salesOrder.customer : fallbackCustomer
      const items = salesOrder ? buildReturnLinesFromSalesOrder(salesOrder) : []
      const itemAmountCents = items.reduce((sum, item) => sum + item.amountCents, 0)
      return ok({
        mode: 'create',
        id: '',
        no: makeReturnNo(),
        salesOrderId: salesOrder ? String(salesOrder.id) : '',
        salesOrderNo: salesOrder ? salesOrder.orderNo : '',
        sourceText: salesOrder ? `关联销售单 ${salesOrder.orderNo}` : '未关联销售单',
        customerId: customer ? String(customer.id) : '',
        customerName: customer ? customer.customer_name : '',
        customerPhone: customer ? customer.phone || '' : '',
        customerAddress: customer ? getCustomerAddress(customer) : '',
        date: formatDate(new Date()),
        warehouseId: salesOrder && salesOrder.warehouseId ? salesOrder.warehouseId : warehouse.id,
        warehouseName: salesOrder && salesOrder.warehouseName ? salesOrder.warehouseName : warehouse.name,
        refundCents: itemAmountCents,
        refundInput: formatAmountInput(itemAmountCents),
        refundText: formatMoney(itemAmountCents),
        returnToPrepay: false,
        receivedToPrepay: false,
        remark: salesOrder ? `关联销售单 ${salesOrder.orderNo} 发起退货。` : '',
        items,
        itemAmountCents,
        itemAmountText: formatMoney(itemAmountCents),
        statusKey: 'pending',
        statusText: '未退款',
        statusTone: 'danger'
      }, request.id)
    }
    const order = await loadOrder(app.prisma, orgId, id)
    if (!order) {
      reply.code(404)
      return fail('退货单不存在', { code: 404, traceId: request.id })
    }
    return ok({ ...toReturnOrderDto(order), mode: 'edit' }, request.id)
  })

  app.get('/return-orders/:id', async (request, reply) => {
    const orgId = await resolveOrgId(app.prisma, request)
    const order = await loadOrder(app.prisma, orgId, request.params.id)
    if (!order) {
      reply.code(404)
      return fail('退货单不存在', { code: 404, traceId: request.id })
    }
    return ok(toReturnOrderDto(order), request.id)
  })

  async function saveOrder(request, reply) {
    const orgId = await resolveOrgId(app.prisma, request)
    const payload = request.body || {}
    const salesOrder = await loadSalesOrder(app.prisma, orgId, payload.salesOrderId)
    if (payload.salesOrderId && !salesOrder) {
      reply.code(400)
      return fail('关联销售单不存在', { code: 400, traceId: request.id })
    }
    const customerIdText = normalizeText(payload.customerId)
    const customerId = /^\d+$/.test(customerIdText) ? BigInt(customerIdText) : salesOrder ? salesOrder.customerId : null
    const customer = customerId ? await app.prisma.customer.findFirst({ where: { id: customerId, org_id: orgId, is_active: true } }) : null
    if (!customer) {
      reply.code(400)
      return fail('请选择有效客户', { code: 400, traceId: request.id })
    }
    if (salesOrder && salesOrder.customerId !== customer.id) {
      reply.code(400)
      return fail('退货客户必须与关联销售单客户一致', { code: 400, traceId: request.id })
    }
    const warehouse = payload.warehouseId
      ? await app.prisma.warehouse.findFirst({ where: { id: String(payload.warehouseId), orgId, status: 'enabled' } })
      : payload.warehouseName
        ? await app.prisma.warehouse.findFirst({ where: { orgId, name: normalizeText(payload.warehouseName), status: 'enabled' } })
        : await getDefaultWarehouse(app.prisma, orgId)
    if (!warehouse) {
      reply.code(400)
      return fail('请选择有效仓库', { code: 400, traceId: request.id })
    }
    if (!canAccessWarehouse(request.orgContext, warehouse.id)) {
      reply.code(403)
      return fail('当前账号没有该仓库数据权限', { code: 403, traceId: request.id })
    }
    const normalizedItems = await normalizeReturnItems(app.prisma, payload.items || [])
    if (!normalizedItems.rows.length) normalizedItems.errors.push('请添加退货明细')
    validateAgainstSalesOrder(normalizedItems.errors, normalizedItems.rows, salesOrder)
    const itemAmountCents = normalizedItems.rows.reduce((sum, item) => sum + item.amountCents, 0)
    const refundCents = parseCents(payload, 'refundCents', 'refundAmount', itemAmountCents)
    if (refundCents <= 0) normalizedItems.errors.push('退款金额必须大于0')
    if (refundCents > itemAmountCents) normalizedItems.errors.push('退款金额不能大于明细金额')
    if (normalizeText(payload.remark).length > 120) normalizedItems.errors.push('备注不能超过120字')
    if (normalizedItems.errors.length) {
      reply.code(400)
      return fail(normalizedItems.errors[0], { code: 400, data: { errors: normalizedItems.errors }, traceId: request.id })
    }

    const existing = payload.id ? await loadOrder(app.prisma, orgId, payload.id) : null
    const orderNo = normalizeText(payload.no) || makeReturnNo()
    const orderDate = parseDate(payload.date || payload.orderDate, new Date())
    const requestedState = ['partial', 'refunded'].includes(payload.statusKey) ? payload.statusKey : ''
    const state = payload.returnToPrepay || payload.receivedToPrepay
      ? 'prepay'
      : requestedState || (refundCents < itemAmountCents ? 'partial' : 'refunded')
    const result = await app.prisma.$transaction(async tx => {
      let order
      if (existing) {
        for (const item of existing.items) {
          await applyInventoryChange(tx, {
            orgId,
            warehouseId: existing.warehouseId || undefined,
            warehouseName: existing.warehouse ? existing.warehouse.name : '默认仓',
            productId: item.productId,
            variantId: item.variantId,
            changeQty: -Number(item.quantity || 0),
            type: 'return_in',
            refType: 'return_order',
            refId: existing.id,
            reason: `退货单修改回滚 ${existing.no}`,
            operator: '王姐'
          })
        }
        if (existing.receivedToPrepay) {
          await adjustCustomerPrepay(tx, orgId, existing.customerId, -Number(existing.returnCents || 0), `退货单 ${existing.no} 修改，冲回原预收。`, orderDate)
        } else {
          await deleteReturnRefundRecords(tx, orgId, existing.id)
        }
        await tx.returnOrderItem.deleteMany({ where: { orderId: existing.id } })
        order = await tx.returnOrder.update({
          where: { id: existing.id },
          data: {
            no: orderNo,
            customerId: customer.id,
            salesOrderId: salesOrder ? salesOrder.id : null,
            warehouseId: warehouse.id,
            orderDate,
            returnCents: refundCents,
            receivedToPrepay: state === 'prepay',
            state,
            remark: normalizeText(payload.remark)
          }
        })
      } else {
        order = await tx.returnOrder.create({
          data: {
            orgId,
            no: orderNo,
            customerId: customer.id,
            salesOrderId: salesOrder ? salesOrder.id : null,
            warehouseId: warehouse.id,
            orderDate,
            returnCents: refundCents,
            receivedToPrepay: state === 'prepay',
            state,
            remark: normalizeText(payload.remark)
          }
        })
      }
      await tx.returnOrderItem.createMany({
        data: normalizedItems.rows.map(item => ({
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
      for (const item of normalizedItems.rows) {
        await applyInventoryChange(tx, {
          orgId,
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
        await adjustCustomerPrepay(tx, orgId, customer.id, refundCents, `退货单 ${order.no} 金额计入客户预收。`, orderDate)
      } else {
        await createReturnRefundReceipt(tx, orgId, customer, order, refundCents, orderDate, request.orgContext && request.orgContext.userId)
      }
      await writeAudit(tx, request.orgContext, {
        action: existing ? 'update' : 'create',
        entity: 'return_order',
        entityId: order.id,
        before: existing ? { no: existing.no, returnCents: existing.returnCents, state: existing.state } : null,
        after: { no: order.no, returnCents: refundCents, state }
      })
      return tx.returnOrder.findUnique({
        where: { id: order.id },
        include: {
          customer: true,
          salesOrder: true,
          warehouse: true,
          items: {
            include: { product: true, variant: true },
            orderBy: { createdAt: 'asc' }
          }
        }
      })
    })
    return ok({ ok: true, order: toReturnOrderDto(result), ...toReturnOrderDto(result) }, request.id)
  }

  app.post('/return-orders', saveOrder)
  app.put('/return-orders/:id', (request, reply) => {
    request.body = { ...(request.body || {}), id: request.params.id }
    return saveOrder(request, reply)
  })
  app.post('/return-orders/submit', saveOrder)
}

module.exports = {
  returnRoutes
}
