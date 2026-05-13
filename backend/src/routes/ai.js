const { ok } = require('../response')
const { resolveOrgContext } = require('../request-context')

function normalizeText(value) {
  return String(value || '').trim()
}

function normalizeKeyword(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[，,。.;；:：、/\\|()（）【】\[\]{}<>《》\-－—_]/g, '')
}

function amountToCents(value) {
  return Math.round(Number(value || 0) * 100)
}

function parseQuantity(text, unit) {
  const unitText = unit || '件'
  const match = String(text || '').match(new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(${unitText}|米|码|条|卷|件|个|公斤|kg)?`, 'i'))
  return {
    quantityValue: Number(match && match[1] ? match[1] : 1),
    unit: match && match[2] ? match[2] : unitText
  }
}

function findMatchedCustomer(text, customers) {
  const normalized = normalizeKeyword(text)
  return customers
    .filter(customer => {
      const name = normalizeKeyword(customer.customer_name)
      const phone = normalizeKeyword(customer.phone)
      return (name && normalized.includes(name)) || (phone && normalized.includes(phone))
    })
    .sort((a, b) => String(b.customer_name || '').length - String(a.customer_name || '').length)[0] || null
}

function findMatchedProduct(segment, products) {
  const normalized = normalizeKeyword(segment)
  return products
    .filter(product => {
      const name = normalizeKeyword(product.productName)
      const code = normalizeKeyword(product.productCode)
      return (name && normalized.includes(name)) || (code && normalized.includes(code))
    })
    .sort((a, b) => String(b.productName || '').length - String(a.productName || '').length)[0] || null
}

function findMatchedVariant(segment, product) {
  const normalized = normalizeKeyword(segment)
  const variants = product.variants || []
  return variants.find(variant => {
    const color = normalizeKeyword(variant.skuValue)
    const code = normalizeKeyword(variant.skuCode)
    return (color && normalized.includes(color)) || (code && normalized.includes(code))
  }) || variants[0] || null
}

async function getStockQty(prisma, orgId, variantId) {
  const balance = await prisma.inventoryBalance.findFirst({
    where: { orgId, variantId },
    orderBy: { updatedAt: 'desc' }
  })
  return Number(balance && balance.stockQty || 0)
}

async function aiRoutes(app) {
  app.post('/ai/sales-intent', async request => {
    const context = await resolveOrgContext(app.prisma, request)
    const text = normalizeText(request.body && (request.body.text || request.body.rawText))
    const [customers, products] = await Promise.all([
      app.prisma.customer.findMany({
        where: { org_id: context.orgId, is_active: true },
        take: 300
      }),
      app.prisma.product.findMany({
        where: { OR: [{ orgId: context.orgId }, { orgId: null }] },
        include: { variants: true },
        take: 500
      })
    ])
    const segments = text.split(/[，,、;；\n]+/).map(item => item.trim()).filter(Boolean)
    const items = []
    const unrecognizedSegments = []
    const warnings = []
    for (const [index, segment] of segments.entries()) {
      const product = findMatchedProduct(segment, products)
      if (!product) {
        if (segment) unrecognizedSegments.push(segment)
        continue
      }
      const variant = findMatchedVariant(segment, product)
      if (!variant) {
        unrecognizedSegments.push(segment)
        continue
      }
      const unit = variant.unit || product.defaultUnit || '件'
      const quantity = parseQuantity(segment, unit)
      const stockQty = await getStockQty(app.prisma, context.orgId, variant.id)
      const line = {
        id: `ai-${Date.now()}-${index}`,
        productId: String(product.id),
        variantId: String(variant.id),
        name: product.productName,
        color: variant.skuValue || '默认',
        spec: variant.skuValue || '默认',
        category: product.categoryName || '未分类',
        quantityValue: quantity.quantityValue,
        unit: quantity.unit,
        unitPriceCents: amountToCents(variant.salePrice),
        stockQty
      }
      if (stockQty <= 0) warnings.push(`${line.name}/${line.color} 库存为 0`)
      items.push(line)
    }
    const customer = findMatchedCustomer(text, customers)
    return ok({
      source: 'backend-ai-rule',
      customer: customer ? {
        id: String(customer.id),
        name: customer.customer_name,
        phone: customer.phone || '',
        address: customer.detail_address || customer.address_short || '',
        category: customer.customer_category || '普通客户'
      } : null,
      items,
      warnings,
      pendingItems: [],
      unrecognizedSegments,
      rawText: text
    }, request.id)
  })
}

module.exports = {
  aiRoutes
}
