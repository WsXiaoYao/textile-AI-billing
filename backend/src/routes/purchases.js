const { ok, fail } = require('../response')
const { applyInventoryChange } = require('./inventory')
const { resolveOrgId: resolveRequestOrgId } = require('../request-context')
const { canAccessWarehouse, isWarehouseScoped } = require('../permissions')

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

function supplierStatusMeta(status) {
  return status === 'disabled'
    ? { statusKey: 'disabled', statusText: '停用', statusTone: 'muted' }
    : { statusKey: 'enabled', statusText: '启用', statusTone: 'success' }
}

function orderStatusMeta(state) {
  return { statusKey: 'submitted', statusText: '已提交', statusTone: 'success' }
}

function toPurchaseLineDto(item, index = 0) {
  const quantity = Number(item.quantity || 0)
  const unitPriceCents = Number(item.unitCents || 0)
  const amountCents = Number(item.amountCents || Math.round(quantity * unitPriceCents))
  const unit = item.unit || '件'
  const stockQty = item.variant ? Number(item.variant.openingStock || 0) : Number(item.stockQty || 0)
  return {
    id: item.id || `${item.productId || 'item'}-${item.variantId || index}-${index}`,
    productId: String(item.productId || ''),
    variantId: String(item.variantId || ''),
    productName: item.productName || (item.product && item.product.productName) || '采购品项',
    color: item.color || (item.variant && item.variant.skuValue) || '默认',
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

function toPurchaseOrderDto(order) {
  const items = (order.items || []).map(toPurchaseLineDto)
  const orderAmountCents = Number(order.orderCents || items.reduce((sum, item) => sum + item.amountCents, 0))
  const contractAmountCents = Number(order.contractCents || orderAmountCents)
  const supplierName = order.supplier ? order.supplier.name : order.supplierName || '未选择供应商'
  const warehouseName = order.warehouse ? order.warehouse.name : order.warehouseName || '默认仓'
  const status = orderStatusMeta(order.state)
  return {
    id: order.id,
    no: order.no,
    supplierId: order.supplierId,
    supplierName,
    date: formatDate(order.orderDate),
    warehouseId: order.warehouseId || '',
    warehouseName,
    creator: order.creator || '系统',
    remark: order.remark || '',
    stockApplied: order.state === 'submitted',
    items,
    itemCount: items.length,
    orderAmountCents,
    discountCents: Math.max(orderAmountCents - contractAmountCents, 0),
    contractAmountCents,
    orderAmountText: formatMoney(orderAmountCents),
    discountText: orderAmountCents > contractAmountCents ? `-${formatMoney(orderAmountCents - contractAmountCents)}` : formatMoney(0),
    contractAmountText: formatMoney(contractAmountCents),
    searchText: [
      order.no,
      supplierName,
      warehouseName,
      order.creator,
      items.map(item => `${item.productName} ${item.color}`).join(' ')
    ].join(' ').toLowerCase(),
    ...status
  }
}

function toPurchaseRecord(order) {
  const firstItem = order.items && order.items[0]
  const line = firstItem ? toPurchaseLineDto(firstItem) : null
  return {
    no: order.no,
    id: order.id,
    date: formatDate(order.orderDate),
    productName: line ? line.productName : '无采购明细',
    color: line ? line.color : '默认',
    quantityText: line ? line.quantityText : '',
    unitPriceCents: line ? line.unitPriceCents : 0,
    unitPriceText: line ? line.unitPriceText : formatMoney(0),
    amountCents: Number(order.contractCents || order.orderCents || 0),
    amountText: formatMoney(order.contractCents || order.orderCents || 0)
  }
}

function toSupplierDto(supplier, orders = []) {
  const purchaseRecords = orders.map(toPurchaseRecord)
  const totalPurchaseCents = Number(supplier.totalPurchaseCents || orders.reduce((sum, order) => sum + Number(order.contractCents || 0), 0))
  const lastRecord = purchaseRecords[0]
  const status = supplierStatusMeta(supplier.status)
  return {
    id: supplier.id,
    name: supplier.name,
    phone: supplier.phone || '',
    address: supplier.address || '',
    remark: supplier.remark || '',
    isCommon: Boolean(supplier.isFrequent),
    isFrequent: Boolean(supplier.isFrequent),
    purchaseRecords,
    purchaseCount: orders.length,
    totalPurchaseCents,
    totalPurchaseText: formatMoney(totalPurchaseCents),
    latestDate: lastRecord ? lastRecord.date : '',
    latestText: lastRecord ? `${lastRecord.date} · ${lastRecord.productName}` : '暂无采购记录',
    searchText: [
      supplier.name,
      supplier.phone,
      supplier.address,
      supplier.remark,
      supplier.status
    ].join(' ').toLowerCase(),
    ...status
  }
}

function emptySupplierForm() {
  return {
    mode: 'create',
    id: '',
    name: '',
    phone: '',
    address: '',
    remark: '',
    statusKey: 'enabled',
    isCommon: false
  }
}

function hasPayloadField(payload, key) {
  return Object.prototype.hasOwnProperty.call(payload || {}, key)
}

function validateSupplierPayload(payload, existing = null) {
  const errors = []
  const hasName = hasPayloadField(payload, 'name')
  const hasPhone = hasPayloadField(payload, 'phone')
  const hasAddress = hasPayloadField(payload, 'address')
  const hasRemark = hasPayloadField(payload, 'remark')
  const hasCommon = hasPayloadField(payload, 'isCommon') || hasPayloadField(payload, 'isFrequent')
  const hasStatus = hasPayloadField(payload, 'statusKey') || hasPayloadField(payload, 'status')

  const name = normalizeText(hasName ? payload.name : (existing ? existing.name : ''))
  const phone = normalizeText(hasPhone ? payload.phone : (existing ? existing.phone : ''))
  const address = normalizeText(hasAddress ? payload.address : (existing ? existing.address : ''))
  const remark = normalizeText(hasRemark ? payload.remark : (existing ? existing.remark : ''))

  if (!name) errors.push('请输入供应商名称')
  if (name.length > 80) errors.push('供应商名称不能超过80字')
  if (phone && !/^1\d{10}$/.test(phone)) errors.push('请输入11位手机号')
  if (address.length > 120) errors.push('地址不能超过120字')
  if (remark.length > 120) errors.push('备注不能超过120字')

  const data = {
    name,
    phone,
    address,
    remark
  }
  if (hasCommon || !existing) data.isFrequent = Boolean(payload.isCommon || payload.isFrequent)
  if (hasStatus || !existing) data.status = payload.statusKey === 'disabled' || payload.status === 'disabled' ? 'disabled' : 'enabled'

  return { errors, data }
}

function toSupplierForm(supplier) {
  if (!supplier) return emptySupplierForm()
  const dto = toSupplierDto(supplier)
  return {
    mode: 'edit',
    id: dto.id,
    name: dto.name,
    phone: dto.phone,
    address: dto.address,
    remark: dto.remark,
    statusKey: dto.statusKey,
    isCommon: dto.isCommon
  }
}

function makePurchaseNo() {
  const date = new Date()
  const ymd = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
  ].join('')
  return `CG${ymd}${String(Date.now()).slice(-4)}`
}

async function findSupplier(prisma, orgId, id) {
  if (!id) return null
  return prisma.supplier.findFirst({
    where: {
      id: String(id),
      orgId
    }
  })
}

async function getSupplierOrders(prisma, orgId, supplierId, take = 20) {
  return prisma.purchaseOrder.findMany({
    where: {
      orgId,
      supplierId
    },
    include: {
      items: {
        include: {
          product: true,
          variant: true
        },
        orderBy: { createdAt: 'asc' }
      },
      warehouse: true
    },
    orderBy: [{ orderDate: 'desc' }, { no: 'desc' }],
    take
  })
}

async function syncSupplierTotal(prisma, orgId, supplierId) {
  const orders = await prisma.purchaseOrder.findMany({
    where: {
      orgId,
      supplierId,
      state: 'submitted'
    },
    select: { contractCents: true }
  })
  const totalPurchaseCents = orders.reduce((sum, order) => sum + Number(order.contractCents || 0), 0)
  return prisma.supplier.update({
    where: { id: supplierId },
    data: { totalPurchaseCents }
  })
}

async function getDefaultWarehouse(prisma, orgId) {
  const existing = await prisma.warehouse.findFirst({
    where: {
      orgId,
      status: 'enabled'
    },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }]
  })
  if (existing) return existing
  return prisma.warehouse.create({
    data: {
      orgId,
      name: '默认仓',
      isDefault: true
    }
  })
}

async function normalizePurchaseItems(prisma, items = []) {
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
      errors.push(`第${index + 1}条采购明细请选择有效产品`)
      continue
    }
    const quantity = parseQty(raw.quantity || raw.qty || raw.quantityInput)
    const unitCents = parseCents(raw, 'unitPriceCents', 'unitPrice', amountToCents(variant.salePrice))
    if (quantity <= 0) errors.push(`第${index + 1}条采购数量必须大于0`)
    if (unitCents <= 0) errors.push(`第${index + 1}条采购单价必须大于0`)
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

async function suppliersRoutes(app) {
  app.get('/suppliers', async request => {
    const orgId = await resolveOrgId(app.prisma, request)
    const query = request.query || {}
    const where = { orgId }
    const keyword = normalizeText(query.keyword)
    if (query.status && query.status !== 'all') where.status = query.status
    if (query.isCommon === 'true' || query.isCommon === true) where.isFrequent = true
    if (keyword) {
      where.OR = [
        { name: { contains: keyword, mode: 'insensitive' } },
        { phone: { contains: keyword, mode: 'insensitive' } },
        { address: { contains: keyword, mode: 'insensitive' } },
        { remark: { contains: keyword, mode: 'insensitive' } }
      ]
    }
    const suppliers = await app.prisma.supplier.findMany({
      where,
      orderBy: [{ totalPurchaseCents: 'desc' }, { name: 'asc' }]
    })
    const recentOrders = suppliers.length
      ? await app.prisma.purchaseOrder.findMany({
          where: {
            orgId,
            supplierId: { in: suppliers.map(item => item.id) }
          },
          include: {
            items: {
              include: {
                product: true,
                variant: true
              },
              orderBy: { createdAt: 'asc' }
            },
            warehouse: true
          },
          orderBy: [{ orderDate: 'desc' }, { no: 'desc' }]
        })
      : []
    const orderMap = recentOrders.reduce((map, order) => {
      if (!map[order.supplierId]) map[order.supplierId] = []
      map[order.supplierId].push(order)
      return map
    }, {})
    return ok({
      page: 1,
      pageSize: suppliers.length,
      total: suppliers.length,
      hasMore: false,
      list: suppliers.map(supplier => toSupplierDto(supplier, orderMap[supplier.id] || []))
    }, request.id)
  })

  app.get('/suppliers/:id/form', async (request, reply) => {
    const orgId = await resolveOrgId(app.prisma, request)
    const supplier = await findSupplier(app.prisma, orgId, request.params.id)
    if (!supplier && request.params.id) {
      reply.code(404)
      return fail('供应商不存在', { code: 404, traceId: request.id })
    }
    return ok(toSupplierForm(supplier), request.id)
  })

  app.get('/suppliers/:id', async (request, reply) => {
    const orgId = await resolveOrgId(app.prisma, request)
    const supplier = await findSupplier(app.prisma, orgId, request.params.id)
    if (!supplier) {
      reply.code(404)
      return fail('供应商不存在', { code: 404, traceId: request.id })
    }
    const orders = await getSupplierOrders(app.prisma, orgId, supplier.id)
    return ok(toSupplierDto(supplier, orders), request.id)
  })

  app.post('/suppliers', async (request, reply) => {
    const orgId = await resolveOrgId(app.prisma, request)
    const payload = request.body || {}
    const { errors, data } = validateSupplierPayload(payload)
    if (errors.length) {
      reply.code(400)
      return fail(errors[0], { code: 400, data: { errors }, traceId: request.id })
    }
    try {
      const supplier = await app.prisma.supplier.create({
        data: {
          orgId,
          ...data
        }
      })
      return ok(toSupplierDto(supplier), request.id)
    } catch (error) {
      if (error.code === 'P2002') {
        reply.code(409)
        return fail('供应商名称已存在', { code: 409, traceId: request.id })
      }
      throw error
    }
  })

  app.put('/suppliers/:id', async (request, reply) => {
    const orgId = await resolveOrgId(app.prisma, request)
    const existing = await findSupplier(app.prisma, orgId, request.params.id)
    if (!existing) {
      reply.code(404)
      return fail('供应商不存在', { code: 404, traceId: request.id })
    }
    const payload = request.body || {}
    const { errors, data } = validateSupplierPayload(payload, existing)
    if (errors.length) {
      reply.code(400)
      return fail(errors[0], { code: 400, data: { errors }, traceId: request.id })
    }
    try {
      const supplier = await app.prisma.supplier.update({
        where: { id: existing.id },
        data
      })
      return ok(toSupplierDto(supplier), request.id)
    } catch (error) {
      if (error.code === 'P2002') {
        reply.code(409)
        return fail('供应商名称已存在', { code: 409, traceId: request.id })
      }
      throw error
    }
  })

  app.post('/suppliers/:id/status', async (request, reply) => {
    const orgId = await resolveOrgId(app.prisma, request)
    const supplier = await findSupplier(app.prisma, orgId, request.params.id)
    if (!supplier) {
      reply.code(404)
      return fail('供应商不存在', { code: 404, traceId: request.id })
    }
    const updated = await app.prisma.supplier.update({
      where: { id: supplier.id },
      data: { status: supplier.status === 'enabled' ? 'disabled' : 'enabled' }
    })
    return ok(toSupplierDto(updated), request.id)
  })
}

async function purchaseRoutes(app) {
  app.get('/purchase-options/suppliers', async request => {
    const orgId = await resolveOrgId(app.prisma, request)
    const suppliers = await app.prisma.supplier.findMany({
      where: {
        orgId,
        status: 'enabled'
      },
      orderBy: [{ isFrequent: 'desc' }, { name: 'asc' }]
    })
    return ok(suppliers.map(supplier => ({ id: supplier.id, name: supplier.name })), request.id)
  })

  app.get('/purchase-options/warehouses', async request => {
    const orgId = await resolveOrgId(app.prisma, request)
    const ids = isWarehouseScoped(request.orgContext, 'purchase') ? request.orgContext.warehouseIds || [] : []
    const warehouses = await app.prisma.warehouse.findMany({
      where: {
        orgId,
        status: 'enabled',
        ...(ids.length ? { id: { in: ids } } : {})
      },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }]
    })
    if (!warehouses.length) {
      const warehouse = await getDefaultWarehouse(app.prisma, orgId)
      return ok([{ id: warehouse.id, name: warehouse.name }], request.id)
    }
    return ok(warehouses.map(warehouse => ({ id: warehouse.id, name: warehouse.name })), request.id)
  })

  app.get('/purchase-options/products', async request => {
    const query = request.query || {}
    const keyword = normalizeText(query.keyword)
    const where = {}
    if (keyword) {
      where.OR = [
        { productName: { contains: keyword, mode: 'insensitive' } },
        { productCode: { contains: keyword, mode: 'insensitive' } },
        { categoryName: { contains: keyword, mode: 'insensitive' } }
      ]
    }
    const products = await app.prisma.product.findMany({
      where,
      include: {
        variants: {
          orderBy: { id: 'asc' },
          take: 20
        }
      },
      orderBy: { id: 'desc' },
      take: Math.min(Math.max(Number(query.limit || 120), 1), 200)
    })
    const options = []
    products.forEach(product => {
      product.variants.forEach(variant => {
        const priceCents = Math.max(amountToCents(variant.salePrice), 0)
        options.push({
          id: `${product.id}__${variant.id}`,
          productId: String(product.id),
          variantId: String(variant.id),
          productName: product.productName,
          productNo: product.productCode || '',
          productImageUrl: '',
          variantImageUrl: '',
          color: variant.skuValue || '默认',
          unit: variant.unit || product.defaultUnit || '件',
          stockQty: Number(variant.openingStock || 0),
          priceCents,
          categoryPathText: product.categoryName || '',
          categoryLeaf: product.categoryName || '',
          searchText: [
            product.productName,
            product.productCode,
            product.categoryName,
            variant.skuValue,
            variant.skuCode,
            variant.warehouseName
          ].join(' ').toLowerCase()
        })
      })
    })
    return ok(options, request.id)
  })

  app.get('/purchase-orders', async request => {
    const orgId = await resolveOrgId(app.prisma, request)
    const query = request.query || {}
    const where = { orgId }
    if (query.supplierId) where.supplierId = String(query.supplierId)
    const ids = isWarehouseScoped(request.orgContext, 'purchase') ? request.orgContext.warehouseIds || [] : []
    if (ids.length) where.warehouseId = { in: ids }
    if (query.status && query.status !== 'all') where.state = query.status
    const keyword = normalizeText(query.keyword)
    if (keyword) {
      where.OR = [
        { no: { contains: keyword, mode: 'insensitive' } },
        { supplier: { name: { contains: keyword, mode: 'insensitive' } } },
        { creator: { contains: keyword, mode: 'insensitive' } }
      ]
    }
    const orders = await app.prisma.purchaseOrder.findMany({
      where,
      include: {
        supplier: true,
        warehouse: true,
        items: {
          include: {
            product: true,
            variant: true
          },
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
      list: orders.map(toPurchaseOrderDto)
    }, request.id)
  })

  app.get('/purchase-orders/:id/form', async (request, reply) => {
    const orgId = await resolveOrgId(app.prisma, request)
    if (!request.params.id || request.params.id === 'undefined') {
      const [supplier, warehouse] = await Promise.all([
        app.prisma.supplier.findFirst({ where: { orgId, status: 'enabled' }, orderBy: [{ isFrequent: 'desc' }, { name: 'asc' }] }),
        getDefaultWarehouse(app.prisma, orgId)
      ])
      return ok({
        mode: 'create',
        id: '',
        no: makePurchaseNo(),
        supplierId: supplier ? supplier.id : '',
        supplierName: supplier ? supplier.name : '',
        date: formatDate(new Date()),
        warehouseId: warehouse.id,
        warehouseName: warehouse.name,
        creator: '王姐',
        remark: '',
        discountCents: 0,
        statusKey: 'submitted',
        stockApplied: false,
        items: []
      }, request.id)
    }
    const order = await app.prisma.purchaseOrder.findFirst({
      where: {
        orgId,
        id: request.params.id
      },
      include: {
        supplier: true,
        warehouse: true,
        items: {
          include: {
            product: true,
            variant: true
          },
          orderBy: { createdAt: 'asc' }
        }
      }
    })
    if (!order) {
      reply.code(404)
      return fail('采购单不存在', { code: 404, traceId: request.id })
    }
    return ok({ ...toPurchaseOrderDto(order), mode: 'edit' }, request.id)
  })

  app.get('/purchase-orders/:id', async (request, reply) => {
    const orgId = await resolveOrgId(app.prisma, request)
    const order = await app.prisma.purchaseOrder.findFirst({
      where: {
        orgId,
        id: request.params.id
      },
      include: {
        supplier: true,
        warehouse: true,
        items: {
          include: {
            product: true,
            variant: true
          },
          orderBy: { createdAt: 'asc' }
        }
      }
    })
    if (!order) {
      reply.code(404)
      return fail('采购单不存在', { code: 404, traceId: request.id })
    }
    return ok(toPurchaseOrderDto(order), request.id)
  })

  async function saveOrder(request, reply, submit = false) {
    const orgId = await resolveOrgId(app.prisma, request)
    const payload = request.body || {}
    const supplier = await findSupplier(app.prisma, orgId, payload.supplierId)
    if (!supplier || supplier.status === 'disabled') {
      reply.code(400)
      return fail('请选择有效供应商', { code: 400, traceId: request.id })
    }
    const warehouse = payload.warehouseId
      ? await app.prisma.warehouse.findFirst({ where: { id: String(payload.warehouseId), orgId, status: 'enabled' } })
      : payload.warehouseName
        ? await app.prisma.warehouse.findFirst({ where: { orgId, name: normalizeText(payload.warehouseName), status: 'enabled' } })
        : await getDefaultWarehouse(app.prisma, orgId)
    if (warehouse && !canAccessWarehouse(request.orgContext, warehouse.id)) {
      reply.code(403)
      return fail('当前账号没有该仓库数据权限', { code: 403, traceId: request.id })
    }
    const normalizedItems = await normalizePurchaseItems(app.prisma, payload.items || [])
    if (!normalizedItems.rows.length) normalizedItems.errors.push('请添加采购明细')
    const orderAmountCents = normalizedItems.rows.reduce((sum, item) => sum + item.amountCents, 0)
    const discountCents = Number(payload.discountCents || 0)
    if (discountCents < 0 || discountCents > orderAmountCents) normalizedItems.errors.push('优惠金额不能小于0且不能大于订单金额')
    if (normalizeText(payload.remark).length > 120) normalizedItems.errors.push('备注不能超过120字')
    if (normalizedItems.errors.length) {
      reply.code(400)
      return fail(normalizedItems.errors[0], { code: 400, data: { errors: normalizedItems.errors }, traceId: request.id })
    }
    const contractCents = Math.max(orderAmountCents - discountCents, 0)
    const orderNo = normalizeText(payload.no) || makePurchaseNo()
    const orderDate = parseDate(payload.date || payload.orderDate, new Date())
    const state = 'submitted'
    const existing = payload.id ? await app.prisma.purchaseOrder.findFirst({
      where: { id: String(payload.id), orgId },
      include: {
        supplier: true,
        warehouse: true,
        items: {
          include: {
            product: true,
            variant: true
          },
          orderBy: { createdAt: 'asc' }
        }
      }
    }) : null
    const result = await app.prisma.$transaction(async tx => {
      let order
      if (existing) {
        if (existing.state === 'submitted') {
          for (const item of existing.items) {
            await applyInventoryChange(tx, {
              orgId,
              warehouseId: existing.warehouseId || null,
              warehouseName: existing.warehouse ? existing.warehouse.name : '默认仓',
              productId: item.productId,
              variantId: item.variantId,
              changeQty: -Number(item.quantity || 0),
              type: 'purchase_in',
              refType: 'purchase_order',
              refId: existing.id,
              reason: `采购单修改回滚 ${existing.no}`,
              operator: normalizeText(payload.creator) || '王姐'
            })
          }
        }
        await tx.purchaseOrderItem.deleteMany({ where: { orderId: existing.id } })
        order = await tx.purchaseOrder.update({
          where: { id: existing.id },
          data: {
            no: orderNo,
            supplierId: supplier.id,
            warehouseId: warehouse ? warehouse.id : null,
            orderDate,
            orderCents: orderAmountCents,
            contractCents,
            state,
            remark: normalizeText(payload.remark),
            creator: normalizeText(payload.creator) || '王姐'
          }
        })
      } else {
        order = await tx.purchaseOrder.create({
          data: {
            orgId,
            no: orderNo,
            supplierId: supplier.id,
            warehouseId: warehouse ? warehouse.id : null,
            orderDate,
            orderCents: orderAmountCents,
            contractCents,
            state,
            remark: normalizeText(payload.remark),
            creator: normalizeText(payload.creator) || '王姐'
          }
        })
      }
      await tx.purchaseOrderItem.createMany({
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
          warehouseId: warehouse ? warehouse.id : null,
          warehouseName: warehouse ? warehouse.name : '默认仓',
          productId: item.productId,
          variantId: item.variantId,
          changeQty: item.quantity,
          type: 'purchase_in',
          refType: 'purchase_order',
          refId: order.id,
          reason: `采购入库 ${order.no}`,
          operator: normalizeText(payload.creator) || '王姐'
        })
      }
      if (existing && existing.supplierId !== supplier.id) await syncSupplierTotal(tx, orgId, existing.supplierId)
      await syncSupplierTotal(tx, orgId, supplier.id)
      return tx.purchaseOrder.findUnique({
        where: { id: order.id },
        include: {
          supplier: true,
          warehouse: true,
          items: {
            include: {
              product: true,
              variant: true
            },
            orderBy: { createdAt: 'asc' }
          }
        }
      })
    })
    return ok({ ok: true, order: toPurchaseOrderDto(result), ...toPurchaseOrderDto(result) }, request.id)
  }

  app.post('/purchase-orders', (request, reply) => saveOrder(request, reply, true))
  app.put('/purchase-orders/:id', (request, reply) => {
    request.body = { ...(request.body || {}), id: request.params.id }
    return saveOrder(request, reply, true)
  })
  app.post('/purchase-orders/submit', (request, reply) => saveOrder(request, reply, true))
}

module.exports = {
  purchaseRoutes,
  suppliersRoutes
}
