const { fail, ok } = require('../response')
const { resolveOrgContext } = require('../request-context')

function pad(value) {
  return String(value).padStart(2, '0')
}

function formatDateTime(value) {
  const date = value instanceof Date ? value : new Date(value || Date.now())
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function decimalNumber(value) {
  return Number(value || 0)
}

function getFallbackLowerLimit(stockQty) {
  return stockQty > 0 && stockQty <= 20 ? 20 : 0
}

function typeView(type) {
  if (type === 'inventory_warning') return { type: 'inventory', typeText: '库存预警', priority: 'warning', actionText: '查看库存详情' }
  if (type === 'print_result') return { type: 'print', typeText: '打印消息', priority: 'success', actionText: '查看销售单' }
  if (type === 'organization_notice') return { type: 'system', typeText: '组织消息', priority: 'primary', actionText: '' }
  return { type: 'system', typeText: '系统消息', priority: 'primary', actionText: '' }
}

function toMessageDto(message) {
  const view = typeView(message.type)
  const status = message.status === 'read' ? 'read' : 'unread'
  const actionUrl = message.type === 'inventory_warning'
    ? `/pages/stock-adjust/index?id=${encodeURIComponent(message.refId || '')}`
    : message.type === 'print_result' && message.refId
      ? `/pages/order-detail/index?id=${encodeURIComponent(message.refId)}`
      : ''
  return {
    id: message.id,
    type: view.type,
    typeText: view.typeText,
    title: message.title,
    summary: message.content,
    time: formatDateTime(message.createdAt),
    status,
    statusText: status === 'read' ? '已读' : '未读',
    statusTone: status === 'read' ? 'success' : 'warning',
    priority: view.priority,
    actionText: actionUrl ? view.actionText : '',
    actionUrl,
    rows: [
      { label: '发生时间', value: formatDateTime(message.createdAt) },
      { label: '内容', value: message.content }
    ]
  }
}

async function ensureInventoryWarnings(prisma, context) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const balances = await prisma.inventoryBalance.findMany({
    where: { orgId: context.orgId },
    include: {
      warehouse: true,
      variant: {
        include: { product: true }
      }
    },
    take: 1000
  })
  for (const balance of balances) {
    const stockQty = decimalNumber(balance.stockQty)
    const configuredLowerLimitQty = decimalNumber(balance.variant && balance.variant.minStock)
    const lowerLimitQty = configuredLowerLimitQty || getFallbackLowerLimit(stockQty)
    if (!lowerLimitQty || stockQty > lowerLimitQty) continue
    const refId = balance.id
    const exists = await prisma.message.findFirst({
      where: {
        orgId: context.orgId,
        type: 'inventory_warning',
        refType: 'inventory_balance',
        refId,
        createdAt: { gte: today }
      }
    })
    if (exists) continue
    const productName = balance.variant && balance.variant.product ? balance.variant.product.productName : '产品'
    const color = balance.variant && balance.variant.skuValue ? balance.variant.skuValue : '默认'
    const warehouseName = balance.warehouse ? balance.warehouse.name : '默认仓'
    await prisma.message.create({
      data: {
        tenantId: context.tenantId,
        orgId: context.orgId,
        type: 'inventory_warning',
        title: `库存预警 · ${productName} / ${color}`,
        content: `${warehouseName}库存 ${stockQty}，低于下限 ${lowerLimitQty}。`,
        refType: 'inventory_balance',
        refId
      }
    })
  }
}

async function messageRoutes(app) {
  app.get('/messages', async request => {
    const context = await resolveOrgContext(app.prisma, request)
    await ensureInventoryWarnings(app.prisma, context)
    const filter = String(request.query && request.query.filter || 'unread')
    const typeMap = {
      inventory: 'inventory_warning',
      print: 'print_result',
      system: 'organization_notice'
    }
    const where = { orgId: context.orgId }
    if (filter === 'unread' || filter === 'read') where.status = filter
    if (typeMap[filter]) where.type = typeMap[filter]
    const list = await app.prisma.message.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100
    })
    return ok({
      list: list.map(toMessageDto),
      total: list.length
    }, request.id)
  })

  app.get('/messages/stats', async request => {
    const context = await resolveOrgContext(app.prisma, request)
    await ensureInventoryWarnings(app.prisma, context)
    const [total, unread] = await Promise.all([
      app.prisma.message.count({ where: { orgId: context.orgId } }),
      app.prisma.message.count({ where: { orgId: context.orgId, status: 'unread' } })
    ])
    return ok({ total, unread }, request.id)
  })

  app.get('/messages/:id', async (request, reply) => {
    const context = await resolveOrgContext(app.prisma, request)
    const message = await app.prisma.message.findFirst({
      where: { id: request.params.id, orgId: context.orgId }
    })
    if (!message) {
      reply.code(404)
      return fail('消息不存在', { code: 404, traceId: request.id })
    }
    return ok(toMessageDto(message), request.id)
  })

  app.post('/messages/:id/read', async (request, reply) => {
    const context = await resolveOrgContext(app.prisma, request)
    const message = await app.prisma.message.findFirst({
      where: { id: request.params.id, orgId: context.orgId }
    })
    if (!message) {
      reply.code(404)
      return fail('消息不存在', { code: 404, traceId: request.id })
    }
    const updated = await app.prisma.message.update({
      where: { id: message.id },
      data: { status: 'read', readAt: new Date() }
    })
    return ok(toMessageDto(updated), request.id)
  })

  app.post('/messages/read-all', async request => {
    const context = await resolveOrgContext(app.prisma, request)
    await app.prisma.message.updateMany({
      where: { orgId: context.orgId, status: 'unread' },
      data: { status: 'read', readAt: new Date() }
    })
    return ok({ ok: true }, request.id)
  })
}

module.exports = {
  messageRoutes
}
