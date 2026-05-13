const { ok, fail } = require('../response')
const { applyInventoryChange } = require('./inventory')
const { resolveOrgId: resolveRequestOrgId } = require('../request-context')
const { canAccessWarehouse, isWarehouseScoped } = require('../permissions')
const { writeAudit } = require('../audit-log')

const defaultOrgCode = 'org-main'
const defaultPageSize = 20

const paymentMeta = {
  unpaid: { text: '未收款', tone: 'danger', amountTone: 'danger' },
  partial: { text: '部分收款', tone: 'warning', amountTone: 'danger' },
  paid: { text: '已收款', tone: 'success', amountTone: 'success' },
  overpaid: { text: '超收款', tone: 'primary', amountTone: 'primary' },
  prepaid: { text: '计入预收', tone: 'primary', amountTone: 'success' },
  refunded: { text: '已退款', tone: 'muted', amountTone: 'muted' }
}

const shippingMeta = {
  unshipped: { text: '未送货', tone: 'muted' },
  partial: { text: '部分送货', tone: 'warning' },
  delivered: { text: '全部送货', tone: 'success' },
  overdelivered: { text: '超送货', tone: 'primary' },
  refused: { text: '拒收', tone: 'danger' }
}

const printMeta = {
  unprinted: { text: '未打印', tone: 'danger' },
  printed: { text: '已打印', tone: 'success' }
}

function decimalToNumber(value) {
  return Number(value || 0)
}

function amountToCents(value) {
  return Math.round(decimalToNumber(value) * 100)
}

function centsToAmount(cents) {
  return (Number(cents || 0) / 100).toFixed(2)
}

function formatMoney(cents, options = {}) {
  const absCents = Math.abs(Number(cents || 0))
  const yuan = Math.floor(absCents / 100)
  const fen = absCents % 100
  const sign = Number(cents || 0) < 0 ? '-' : ''
  const prefix = options.plus && cents > 0 ? '+' : ''
  return `${prefix}${sign}¥${String(yuan).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}${fen ? `.${String(fen).padStart(2, '0')}` : ''}`
}

function formatAmountInput(cents) {
  return (Number(cents || 0) / 100).toFixed(2)
}

function dateOnly(value) {
  if (!value) return ''
  if (typeof value === 'string') return value.slice(0, 10)
  return value.toISOString().slice(0, 10)
}

function parseDate(value, fallback = null) {
  const text = String(value || '').trim()
  if (!text) return fallback
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return fallback
  return new Date(`${text}T00:00:00.000Z`)
}

function normalizeText(value) {
  return String(value || '').trim()
}

function parsePositiveDecimal(value) {
  const text = String(value || '').match(/\d+(\.\d+)?/)
  const number = text ? Number(text[0]) : Number(value || 0)
  return Number.isFinite(number) ? number : 0
}

function parseCents(payload, centsKey, amountKey, fallbackCents = 0) {
  if (payload && payload[centsKey] !== undefined) return Number(payload[centsKey] || 0)
  if (payload && payload[amountKey] !== undefined) return Math.round(Number(payload[amountKey] || 0) * 100)
  return fallbackCents
}

function getPaymentState(contractCents, receivedCents, options = {}) {
  if (options.refunded) return 'refunded'
  if (options.prepaid) return 'prepaid'
  if (receivedCents > contractCents) return 'overpaid'
  if (contractCents > 0 && receivedCents >= contractCents) return 'paid'
  if (receivedCents > 0) return 'partial'
  return 'unpaid'
}

function getReceiptAmountText(order) {
  const contractCents = amountToCents(order.contractAmount)
  const receivedCents = amountToCents(order.receivedAmount)
  const unreceivedCents = amountToCents(order.unreceivedAmount)
  if (order.payStatus === 'overpaid') return formatMoney(receivedCents - contractCents)
  if (order.payStatus === 'refunded') return formatMoney(0)
  return formatMoney(unreceivedCents)
}

function getGoodsSummary(order) {
  const items = order.items || []
  if (!items.length) return '无产品明细'
  const names = items.slice(0, 2).map(item => item.productName).join('、')
  return items.length > 2 ? `${names} 等${items.length}条明细` : `${names} ${items.length}条明细`
}

function buildAmountRows(order) {
  const orderCents = amountToCents(order.orderAmount)
  const discountCents = amountToCents(order.discountAmount)
  const contractCents = amountToCents(order.contractAmount)
  const receivedCents = amountToCents(order.receivedAmount)
  const unreceivedCents = amountToCents(order.unreceivedAmount)
  const rows = [
    { key: 'orderAmount', label: '订单金额', value: formatMoney(orderCents), tone: 'normal' },
    { key: 'discountAmount', label: '优惠金额', value: formatMoney(-discountCents), tone: discountCents ? 'primary' : 'normal' },
    { key: 'contractAmount', label: '合同金额', value: formatMoney(contractCents), tone: 'danger' },
    { key: 'divider', divider: true },
    { key: 'receivedAmount', label: '已收金额', value: formatMoney(receivedCents), tone: 'success' }
  ]
  if (receivedCents > contractCents) {
    rows.push({ key: 'overpaidAmount', label: '超收金额', value: formatMoney(receivedCents - contractCents, { plus: true }), tone: 'primary' })
  }
  rows.push({
    key: 'unreceivedAmount',
    label: '未收金额',
    value: formatMoney(unreceivedCents),
    tone: unreceivedCents ? 'danger' : 'success'
  })
  return rows
}

function getAmountNote(order) {
  if (order.payStatus === 'refunded') return '退款完成后，本单不再进入待收款列表。'
  if (order.payStatus === 'prepaid') return '本单已使用客户预收款冲抵。'
  if (order.payStatus === 'overpaid') return '超收金额会进入客户往来，后续可冲抵新单。'
  if (amountToCents(order.unreceivedAmount) > 0) return '未收金额需要后续从销售单详情发起收款。'
  return '本单已完成收款，客户往来已结清。'
}

function buildReceiptInfo(order) {
  const records = order.receiptItems || []
  const latest = records[records.length - 1]
  if (!latest || !latest.receipt) {
    return {
      desc: '暂无收款记录，可从销售单详情发起收款。',
      type: '',
      no: '',
      amount: '',
      rule: '',
      remaining: amountToCents(order.unreceivedAmount) > 0 ? `仍需收款 ${formatMoney(amountToCents(order.unreceivedAmount))}` : '已结清',
      tone: amountToCents(order.unreceivedAmount) > 0 ? 'danger' : 'success',
      amountTone: amountToCents(order.unreceivedAmount) > 0 ? 'danger' : 'success',
      emptyText: '暂无收款记录',
      emptyHint: '收款后会自动回写销售单详情。'
    }
  }

  const payment = paymentMeta[order.payStatus] || paymentMeta.unpaid
  return {
    desc: order.payStatus === 'partial' ? '本单已有收款记录，剩余未收可继续收款。' : '本单收款记录已回写。',
    type: latest.receipt.prepayMode ? '冲销预收' : '销售单收款',
    no: latest.receipt.receiptNo,
    amount: formatMoney(amountToCents(latest.currentReceiveAmount)),
    rule: latest.receipt.remark || '本单收款已回写销售单详情。',
    remaining: amountToCents(order.unreceivedAmount) > 0 ? `仍需收款 ${formatMoney(amountToCents(order.unreceivedAmount))}` : '已结清',
    tone: payment.tone,
    amountTone: payment.amountTone,
    emptyText: '',
    emptyHint: ''
  }
}

function toListDto(order) {
  const payment = paymentMeta[order.payStatus] || paymentMeta.unpaid
  const shipping = shippingMeta[order.shippingStatus] || shippingMeta.unshipped
  const print = printMeta[order.printStatus] || printMeta.unprinted
  return {
    id: String(order.id),
    no: order.orderNo,
    customer: order.customer ? order.customer.customer_name : '',
    goodsSummary: getGoodsSummary(order),
    saleDate: dateOnly(order.orderDate),
    statusText: payment.text,
    statusTone: payment.tone,
    receivableText: getReceiptAmountText(order),
    amountTone: payment.amountTone,
    receivableCents: amountToCents(order.unreceivedAmount),
    creator: order.creatorName || '系统',
    paymentState: order.payStatus,
    deliveryState: order.shippingStatus,
    deliveryText: shipping.text,
    printState: order.printStatus,
    printText: print.text,
    isDraft: false,
    chips: [
      { text: shipping.text, tone: shipping.tone },
      { text: print.text, tone: print.tone },
      { text: `制单人 ${order.creatorName || '系统'}`, tone: 'muted' }
    ]
  }
}

function toDetailDto(order) {
  const listDto = toListDto(order)
  const payment = paymentMeta[order.payStatus] || paymentMeta.unpaid
  const print = printMeta[order.printStatus] || printMeta.unprinted
  const returnOrders = order.returnOrders || []
  const returnCents = returnOrders.reduce((sum, item) => sum + Number(item.returnCents || 0), 0)
  return {
    id: String(order.id),
    no: order.orderNo,
    statusText: payment.text,
    statusTone: payment.tone,
    canReceive: ['unpaid', 'partial'].includes(order.payStatus) && amountToCents(order.unreceivedAmount) > 0,
    printActionText: order.printStatus === 'printed' ? '再次打印' : '打印',
    successTitle: '销售单已生成',
    successDesc: '下单后自动更新客户往来，预收冲抵已记录。',
    customer: {
      name: order.customer ? order.customer.customer_name : '',
      phone: order.customer ? order.customer.phone || '' : '',
      address: order.customer ? order.customer.detail_address || order.customer.address_short || '' : '',
      date: dateOnly(order.orderDate),
      warehouse: order.warehouseName,
      printStatus: print.text
    },
    amounts: buildAmountRows(order),
    amountNote: getAmountNote(order),
    receipt: buildReceiptInfo(order),
    returnInfo: {
      count: returnOrders.length,
      totalText: formatMoney(returnCents),
      desc: returnOrders.length
        ? `已有 ${returnOrders.length} 张退货单，合计 ${formatMoney(returnCents)}。`
        : '从这张销售单发起退货后，会自动关联客户、商品和库存。',
      list: returnOrders.slice(0, 3).map(item => ({
        id: item.id,
        no: item.no,
        date: dateOnly(item.orderDate),
        amountText: formatMoney(Number(item.returnCents || 0)),
        statusText: item.receivedToPrepay ? '计入预收' : '待退款'
      }))
    },
    products: (order.items || []).map(item => ({
      id: String(item.id),
      productId: String(item.productId),
      variantId: String(item.variantId),
      name: item.productName,
      color: item.colorName,
      qty: `${decimalToNumber(item.qty)}${item.unitName}`,
      quantity: decimalToNumber(item.qty),
      unit: item.unitName,
      price: formatMoney(amountToCents(item.unitPrice)),
      amount: formatMoney(amountToCents(item.amount)),
      stockQtySnapshot: item.stockQtySnapshot === null ? null : decimalToNumber(item.stockQtySnapshot)
    })),
    goodsSummary: listDto.goodsSummary,
    printDesc: '保存后的销售单支持按模板分享或打印。'
  }
}

function buildPage(list, query = {}) {
  const page = Math.max(Number(query.page || 1), 1)
  const pageSize = Math.max(Number(query.pageSize || query.limit || defaultPageSize), 1)
  const start = (page - 1) * pageSize
  return {
    page,
    pageSize,
    total: list.length,
    hasMore: start + pageSize < list.length,
    list: list.slice(start, start + pageSize)
  }
}

async function resolveOrgId(prisma, request) {
  return resolveRequestOrgId(prisma, request)
}

async function ensureDefaultAccount(prisma, orgId) {
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
      remark: '系统自动创建，用于销售单收款。'
    }
  })
}

async function findOrder(prisma, orgId, idOrNo) {
  const text = String(idOrNo || '').trim()
  const id = /^\d+$/.test(text) ? BigInt(text) : null
  return prisma.salesOrder.findFirst({
    where: {
      orgId,
      OR: [
        ...(id ? [{ id }] : []),
        { orderNo: text }
      ]
    },
    include: {
      customer: true,
      items: {
        orderBy: { id: 'asc' }
      },
      receiptItems: {
        include: { receipt: true },
        orderBy: { createdAt: 'asc' }
      },
      returnOrders: {
        orderBy: { orderDate: 'desc' }
      }
    }
  })
}

function buildWhere(orgId, query = {}, context = null) {
  const keyword = normalizeText(query.keyword)
  const paymentState = normalizeText(query.paymentState || query.payStatus)
  const shippingState = normalizeText(query.deliveryState || query.shippingStatus)
  const printState = normalizeText(query.printState)
  const creator = normalizeText(query.creator)
  const customerId = normalizeText(query.customerId)
  const startDate = parseDate(query.startDate || query.dateFrom || query.start)
  const endDate = parseDate(query.endDate || query.dateTo || query.end)
  const where = { orgId }
  const warehouseIds = isWarehouseScoped(context, 'sales') && Array.isArray(context.warehouseIds) && context.warehouseIds.length
    ? context.warehouseIds
    : null

  if (warehouseIds) where.warehouseId = { in: warehouseIds }
  if (paymentState && paymentState !== 'all') where.payStatus = paymentState
  if (shippingState && shippingState !== 'all') where.shippingStatus = shippingState
  if (printState && printState !== 'all') where.printStatus = printState
  if (creator) where.creatorName = creator
  if (/^\d+$/.test(customerId)) where.customerId = BigInt(customerId)
  if (startDate || endDate) {
    where.orderDate = {}
    if (startDate) where.orderDate.gte = startDate
    if (endDate) where.orderDate.lte = endDate
  }
  if (keyword) {
    where.OR = [
      { orderNo: { contains: keyword, mode: 'insensitive' } },
      { creatorName: { contains: keyword, mode: 'insensitive' } },
      { warehouseName: { contains: keyword, mode: 'insensitive' } },
      { customer: { customer_name: { contains: keyword, mode: 'insensitive' } } },
      { customer: { phone: { contains: keyword, mode: 'insensitive' } } },
      { items: { some: { productName: { contains: keyword, mode: 'insensitive' } } } },
      { items: { some: { colorName: { contains: keyword, mode: 'insensitive' } } } }
    ]
  }
  return where
}

function sortOrders(list, sortKey) {
  const sorted = list.slice()
  sorted.sort((a, b) => {
    if (sortKey === 'dateAsc') return dateOnly(a.orderDate).localeCompare(dateOnly(b.orderDate)) || a.orderNo.localeCompare(b.orderNo)
    if (sortKey === 'receivableDesc') return amountToCents(b.unreceivedAmount) - amountToCents(a.unreceivedAmount)
    if (sortKey === 'customerAsc') {
      return String(a.customer && a.customer.customer_name || '').localeCompare(String(b.customer && b.customer.customer_name || ''), 'zh-Hans-CN')
    }
    return dateOnly(b.orderDate).localeCompare(dateOnly(a.orderDate)) || b.orderNo.localeCompare(a.orderNo)
  })
  return sorted
}

function makeOrderNo(date) {
  const dateText = dateOnly(date).replace(/-/g, '')
  return `XS${dateText}${String(Date.now()).slice(-6)}`
}

function makeReceiptNo() {
  const now = new Date()
  const ymd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
  return `SK${ymd}${String(Date.now()).slice(-8)}`
}

async function normalizeOrderItems(prisma, payloadItems) {
  const errors = []
  const rows = []
  const items = Array.isArray(payloadItems) ? payloadItems : []
  for (const [index, item] of items.entries()) {
    const productIdText = normalizeText(item.productId || item.id)
    const variantIdText = normalizeText(item.variantId)
    const color = normalizeText(item.color || item.spec || item.skuValue)
    const productId = /^\d+$/.test(productIdText) ? BigInt(productIdText) : null
    if (!productId) {
      errors.push(`第${index + 1}行请选择产品`)
      continue
    }
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        variants: {
          orderBy: { id: 'asc' }
        }
      }
    })
    if (!product) {
      errors.push(`第${index + 1}行产品不存在`)
      continue
    }
    let variant = null
    if (/^\d+$/.test(variantIdText)) {
      variant = product.variants.find(record => String(record.id) === variantIdText)
    }
    if (!variant && color) {
      variant = product.variants.find(record => [record.skuValue, record.skuCode].filter(Boolean).some(value => String(value).includes(color) || color.includes(String(value))))
    }
    if (!variant) variant = product.variants[0]
    if (!variant) {
      errors.push(`第${index + 1}行产品没有SKU`)
      continue
    }

    const qty = parsePositiveDecimal(item.quantityValue || item.quantity || item.qty || item.quantityText)
    if (qty <= 0) errors.push(`第${index + 1}行数量必须大于0`)
    const unitPriceCents = parseCents(item, 'unitPriceCents', 'unitPrice', amountToCents(variant.salePrice))
    if (unitPriceCents < 0) errors.push(`第${index + 1}行单价不能小于0`)
    const amountCents = parseCents(item, 'amountCents', 'amount', Math.round(qty * unitPriceCents))
    if (amountCents < 0) errors.push(`第${index + 1}行金额不能小于0`)

    rows.push({
      product,
      variant,
      productId: product.id,
      variantId: variant.id,
      productName: product.productName,
      colorName: color || variant.skuValue || '默认',
      stockQtySnapshot: variant.openingStock,
      qty,
      unitName: normalizeText(item.unit || variant.unit || product.defaultUnit || '件'),
      unitPriceCents,
      amountCents
    })
  }
  return { errors, rows }
}

function getCustomerPatch(customer, contractCents, receivedCents, unreceivedCents, usePrepaidCents = 0) {
  return {
    contract_amount: centsToAmount(amountToCents(customer.contract_amount) + contractCents),
    paid_amount: centsToAmount(amountToCents(customer.paid_amount) + receivedCents),
    unpaid_amount: centsToAmount(amountToCents(customer.unpaid_amount) + unreceivedCents),
    prepaid_amount: centsToAmount(Math.max(amountToCents(customer.prepaid_amount) - usePrepaidCents, 0))
  }
}

async function salesOrderRoutes(app) {
  app.get('/sales-orders/summary', async request => {
    const orgId = await resolveOrgId(app.prisma, request)
    const where = buildWhere(orgId, request.query || {}, request.orgContext)
    const orders = await app.prisma.salesOrder.findMany({ where })
    const unpaidCents = orders.reduce((sum, order) => sum + amountToCents(order.unreceivedAmount), 0)
    const specialCount = orders.filter(order => ['overpaid', 'prepaid', 'refunded'].includes(order.payStatus)).length
    const closedCount = orders.filter(order => order.payStatus === 'paid').length
    return ok({
      title: '订单概览',
      metrics: [
        { key: 'unreceived', label: '未收金额', value: formatMoney(unpaidCents), tone: 'danger' },
        { key: 'special', label: '特殊状态', value: `${specialCount}单`, tone: 'primary' },
        { key: 'closed', label: '已结清', value: `${closedCount}单`, tone: 'success' }
      ]
    }, request.id)
  })

  app.get('/sales-orders', async request => {
    const orgId = await resolveOrgId(app.prisma, request)
    const orders = await app.prisma.salesOrder.findMany({
      where: buildWhere(orgId, request.query || {}, request.orgContext),
      include: {
        customer: true,
        items: { orderBy: { id: 'asc' } }
      }
    })
    return ok(buildPage(sortOrders(orders, request.query && request.query.sortKey).map(toListDto), request.query || {}), request.id)
  })

  app.get('/sales-orders/:id', async (request, reply) => {
    const orgId = await resolveOrgId(app.prisma, request)
    const order = await findOrder(app.prisma, orgId, request.params.id)
    if (!order || !canAccessWarehouse(request.orgContext, order.warehouseId)) {
      reply.code(404)
      return fail('销售单不存在', { code: 404, traceId: request.id })
    }
    return ok(toDetailDto(order), request.id)
  })

  app.post('/sales-orders', async (request, reply) => {
    const orgId = await resolveOrgId(app.prisma, request)
    const payload = request.body || {}
    const customerPayload = payload.customer || {}
    const customerIdText = normalizeText(payload.customerId || customerPayload.id)
    const customerName = normalizeText(payload.customerName || customerPayload.name)
    const customer = /^\d+$/.test(customerIdText)
      ? await app.prisma.customer.findFirst({ where: { id: BigInt(customerIdText), org_id: orgId } })
      : await app.prisma.customer.findFirst({ where: { org_id: orgId, customer_name: customerName } })

    const errors = []
    if (!customer) errors.push('请选择有效客户')
    const orderDate = parseDate(payload.orderDate || payload.saleDate, new Date())
    const discountCents = parseCents(payload, 'discountCents', 'discountAmount', 0)
    const usePrepaidCents = parseCents(payload, 'usePrepaidCents', 'usePrepaidAmount', 0)
    const normalizedItems = await normalizeOrderItems(app.prisma, payload.items)
    errors.push(...normalizedItems.errors)
    const orderCents = parseCents(payload, 'totalCents', 'orderAmount', normalizedItems.rows.reduce((sum, item) => sum + item.amountCents, 0))
    if (discountCents < 0) errors.push('优惠金额不能小于0')
    if (discountCents > orderCents) errors.push('优惠金额不能大于订单金额')
    const contractCents = Math.max(orderCents - discountCents, 0)
    if (usePrepaidCents > Math.min(contractCents, customer ? amountToCents(customer.prepaid_amount) : 0)) errors.push('使用预收款不能大于客户预收余额或合同金额')
    if (!normalizedItems.rows.length) errors.push('请至少选择一条产品明细')
    if (normalizeText(payload.remark).length > 500) errors.push('备注不能超过500字')

    if (errors.length) {
      reply.code(400)
      return fail(errors[0], { code: 400, data: { errors }, traceId: request.id })
    }
    if (payload.warehouseId && !canAccessWarehouse(request.orgContext, payload.warehouseId)) {
      reply.code(403)
      return fail('当前账号没有该仓库数据权限', { code: 403, traceId: request.id })
    }

    const receivedCents = usePrepaidCents
    const unreceivedCents = Math.max(contractCents - receivedCents, 0)
    const payStatus = getPaymentState(contractCents, receivedCents, { prepaid: usePrepaidCents > 0 && unreceivedCents === 0 })
    const orderNo = normalizeText(payload.orderNo || payload.no) || makeOrderNo(orderDate)
    const receiptNo = usePrepaidCents > 0 ? makeReceiptNo() : ''
    const result = await app.prisma.$transaction(async tx => {
      const order = await tx.salesOrder.create({
        data: {
          orgId,
          orderNo,
          customerId: customer.id,
          warehouseId: payload.warehouseId || null,
          warehouseName: normalizeText(payload.warehouse || payload.warehouseName) || '默认仓',
          orderDate,
          orderAmount: centsToAmount(orderCents),
          discountAmount: centsToAmount(discountCents),
          contractAmount: centsToAmount(contractCents),
          receivedAmount: centsToAmount(receivedCents),
          unreceivedAmount: centsToAmount(unreceivedCents),
          payStatus,
          shippingStatus: normalizeText(payload.shippingStatus || payload.deliveryState) || 'unshipped',
          printStatus: 'unprinted',
          creatorUserId: payload.creatorUserId || null,
          creatorName: normalizeText(payload.creator || payload.creatorName) || '系统',
          remark: normalizeText(payload.remark)
        }
      })
      await tx.salesOrderItem.createMany({
        data: normalizedItems.rows.map(item => ({
          orgId,
          orderId: order.id,
          productId: item.productId,
          variantId: item.variantId,
          productName: item.productName,
          colorName: item.colorName,
          stockQtySnapshot: item.stockQtySnapshot ? centsToAmount(Math.round(decimalToNumber(item.stockQtySnapshot) * 100)) : null,
          qty: item.qty.toFixed(2),
          unitName: item.unitName,
          unitPrice: centsToAmount(item.unitPriceCents),
          amount: centsToAmount(item.amountCents)
        }))
      })
      for (const item of normalizedItems.rows) {
        await applyInventoryChange(tx, {
          orgId,
          warehouseId: order.warehouseId,
          warehouseName: order.warehouseName,
          productId: item.productId,
          variantId: item.variantId,
          changeQty: -item.qty,
          type: 'sales_out',
          refType: 'sales_order',
          refId: order.id,
          reason: `销售出库 ${order.orderNo}`,
          operator: normalizeText(payload.creator || payload.creatorName) || '系统'
        })
      }
      await tx.customer.update({
        where: { id: customer.id },
        data: getCustomerPatch(customer, contractCents, receivedCents, unreceivedCents, usePrepaidCents)
      })
      if (usePrepaidCents > 0) {
        const account = await ensureDefaultAccount(tx, orgId)
        const receipt = await tx.receiptOrder.create({
          data: {
            orgId,
            receiptNo,
            customerId: customer.id,
            receiptDate: orderDate,
            accountId: account.id,
            accountNameSnapshot: account.accountName,
            receiptAmount: centsToAmount(usePrepaidCents),
            prepayMode: false,
            creatorUserId: payload.creatorUserId || null,
            remark: `销售单 ${orderNo} 使用预收款冲抵`
          }
        })
        await tx.receiptOrderItem.create({
          data: {
            orgId,
            receiptId: receipt.id,
            salesOrderId: order.id,
            contractAmount: centsToAmount(contractCents),
            receivedAmountBefore: '0.00',
            unreceivedAmountBefore: centsToAmount(contractCents),
            currentReceiveAmount: centsToAmount(usePrepaidCents)
          }
        })
        await tx.fundRecord.create({
          data: {
            orgId,
            customerId: customer.id,
            orderId: order.id,
            type: 'prepayment_offset',
            amountCents: usePrepaidCents,
            balanceCents: amountToCents(customer.prepaid_amount) - usePrepaidCents - unreceivedCents,
            note: `销售单 ${orderNo} 使用预收款 ${formatMoney(usePrepaidCents)}`
          }
        })
      }
      return tx.salesOrder.findUnique({
        where: { id: order.id },
        include: {
          customer: true,
          items: { orderBy: { id: 'asc' } },
          receiptItems: {
            include: { receipt: true },
            orderBy: { createdAt: 'asc' }
          }
        }
      })
    })
    reply.code(201)
    return ok(toDetailDto(result), request.id)
  })

  app.get('/sales-orders/:id/receipt-context', async (request, reply) => {
    const orgId = await resolveOrgId(app.prisma, request)
    const order = await findOrder(app.prisma, orgId, request.params.id)
    if (!order || !canAccessWarehouse(request.orgContext, order.warehouseId)) {
      reply.code(404)
      return fail('销售单不存在', { code: 404, traceId: request.id })
    }
    const unpaidCents = amountToCents(order.unreceivedAmount)
    return ok({
      id: String(order.id),
      no: order.orderNo,
      customer: order.customer ? order.customer.customer_name : '',
      contractCents: amountToCents(order.contractAmount),
      receivedCents: amountToCents(order.receivedAmount),
      unpaidCents,
      defaultReceiptCents: unpaidCents,
      receiptDate: dateOnly(new Date()),
      remark: '补录本单收款。',
      contractText: formatMoney(amountToCents(order.contractAmount)),
      receivedText: formatMoney(amountToCents(order.receivedAmount)),
      unpaidText: formatMoney(unpaidCents)
    }, request.id)
  })

  app.post('/sales-orders/:id/receipts', async (request, reply) => {
    const orgId = await resolveOrgId(app.prisma, request)
    const order = await findOrder(app.prisma, orgId, request.params.id)
    if (!order || !canAccessWarehouse(request.orgContext, order.warehouseId)) {
      reply.code(404)
      return fail('销售单不存在', { code: 404, traceId: request.id })
    }
    const payload = request.body || {}
    if (normalizeText(payload.remark).length > 120) {
      reply.code(400)
      return fail('备注不能超过120字', { code: 400, traceId: request.id })
    }
    const amountCents = parseCents(payload, 'amountCents', 'amount', 0)
    const unpaidCents = amountToCents(order.unreceivedAmount)
    if (amountCents <= 0 || amountCents > unpaidCents) {
      reply.code(400)
      return fail(amountCents <= 0 ? '请输入收款金额' : '收款金额不能超过本单未收金额', { code: 400, traceId: request.id })
    }
    const account = payload.accountId
      ? await app.prisma.account.findFirst({ where: { id: String(payload.accountId), orgId, status: 'enabled' } })
      : await ensureDefaultAccount(app.prisma, orgId)
    if (!account) {
      reply.code(400)
      return fail('收款账户不存在或已停用', { code: 400, traceId: request.id })
    }
    const receiptDate = parseDate(payload.date || payload.receiptDate, new Date())
    const receiptNo = makeReceiptNo()
    const nextReceivedCents = amountToCents(order.receivedAmount) + amountCents
    const nextUnreceivedCents = Math.max(amountToCents(order.contractAmount) - nextReceivedCents, 0)
    const nextPayStatus = getPaymentState(amountToCents(order.contractAmount), nextReceivedCents)
    const result = await app.prisma.$transaction(async tx => {
      await tx.salesOrder.update({
        where: { id: order.id },
        data: {
          receivedAmount: centsToAmount(nextReceivedCents),
          unreceivedAmount: centsToAmount(nextUnreceivedCents),
          payStatus: nextPayStatus
        }
      })
      await tx.customer.update({
        where: { id: order.customerId },
        data: {
          paid_amount: centsToAmount(amountToCents(order.customer.paid_amount) + amountCents),
          unpaid_amount: centsToAmount(Math.max(amountToCents(order.customer.unpaid_amount) - amountCents, 0))
        }
      })
      await tx.account.update({
        where: { id: account.id },
        data: {
          currentBalance: {
            increment: centsToAmount(amountCents)
          }
        }
      })
      const receipt = await tx.receiptOrder.create({
        data: {
          orgId,
          receiptNo,
          customerId: order.customerId,
          receiptDate,
          accountId: account.id,
          accountNameSnapshot: account.accountName,
          receiptAmount: centsToAmount(amountCents),
          prepayMode: false,
          creatorUserId: payload.creatorUserId || null,
          remark: normalizeText(payload.remark) || '本单收款已回写销售单详情。'
        }
      })
      await tx.receiptOrderItem.create({
        data: {
          orgId,
          receiptId: receipt.id,
          salesOrderId: order.id,
          contractAmount: String(order.contractAmount),
          receivedAmountBefore: String(order.receivedAmount),
          unreceivedAmountBefore: String(order.unreceivedAmount),
          currentReceiveAmount: centsToAmount(amountCents)
        }
      })
      await tx.fundRecord.create({
        data: {
          orgId,
          customerId: order.customerId,
          orderId: order.id,
          type: 'sales_receipt',
          amountCents,
          balanceCents: nextUnreceivedCents,
          note: `${receiptNo} ${payload.remark || ''}`.trim()
        }
      })
      return tx.salesOrder.findUnique({
        where: { id: order.id },
        include: {
          customer: true,
          items: { orderBy: { id: 'asc' } },
          receiptItems: {
            include: { receipt: true },
            orderBy: { createdAt: 'asc' }
          }
        }
      })
    })
    return ok(toDetailDto(result), request.id)
  })

  app.post('/sales-orders/:id/print', async (request, reply) => {
    const orgId = await resolveOrgId(app.prisma, request)
    const order = await findOrder(app.prisma, orgId, request.params.id)
    if (!order || !canAccessWarehouse(request.orgContext, order.warehouseId)) {
      reply.code(404)
      return fail('销售单不存在', { code: 404, traceId: request.id })
    }
    const updated = await app.prisma.$transaction(async tx => {
      const next = await tx.salesOrder.update({
        where: { id: order.id },
        data: { printStatus: 'printed' },
        include: {
          customer: true,
          items: { orderBy: { id: 'asc' } },
          receiptItems: {
            include: { receipt: true },
            orderBy: { createdAt: 'asc' }
          }
        }
      })
      await tx.message.create({
        data: {
          tenantId: request.orgContext.tenantId,
          orgId,
          type: 'print_result',
          status: 'unread',
          title: '打印任务已提交',
          content: `销售单 ${next.orderNo} 已提交打印并标记为已打印。`,
          refType: 'sales_order',
          refId: String(next.id)
        }
      })
      await writeAudit(tx, request.orgContext, {
        action: 'print',
        entity: 'sales_order',
        entityId: next.id,
        before: { printStatus: order.printStatus },
        after: { printStatus: next.printStatus }
      })
      return next
    })
    return ok(toDetailDto(updated), request.id)
  })
}

module.exports = {
  salesOrderRoutes
}
