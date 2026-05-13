const { ok, fail } = require('../response')
const { resolveOrgId: resolveRequestOrgId } = require('../request-context')
const { canAccessWarehouse, isWarehouseScoped } = require('../permissions')

const defaultOrgCode = 'org-main'

function normalizeText(value) {
  return String(value || '').trim()
}

function decimalNumber(value) {
  return Number(value || 0)
}

function formatNumber(value) {
  const number = Number(value || 0)
  if (Number.isInteger(number)) return String(number)
  return String(Number(number.toFixed(2)))
}

function formatMoney(cents) {
  const amount = Number(cents || 0) / 100
  return `¥${amount.toFixed(2)}`
}

function formatQty(value, unit = '') {
  return `${formatNumber(value)}${unit || ''}`
}

function formatSignedQty(value, unit = '') {
  const number = Number(value || 0)
  return `${number > 0 ? '+' : ''}${formatNumber(number)}${unit || ''}`
}

function formatDateTime(value) {
  const date = value instanceof Date ? value : new Date(value)
  const pad = number => String(number).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function getFallbackLowerLimit(stockQty) {
  return stockQty > 0 && stockQty <= 20 ? 20 : 0
}

function normalizeWarehouseName(value) {
  const name = normalizeText(value)
  if (!name || ['默认', '默认仓库', '贵阳仓库'].includes(name)) return '默认仓'
  if (name === '投色') return '投色仓'
  if (name === '辅料') return '辅料仓'
  return name
}

function warehouseStatusMeta(status) {
  return status === 'disabled'
    ? { statusKey: 'disabled', statusText: '停用', statusTone: 'muted' }
    : { statusKey: 'enabled', statusText: '启用', statusTone: 'success' }
}

function inventoryStatusMeta(stockQty, lowerLimitQty) {
  if (stockQty <= 0) {
    return { statusKey: 'empty', statusText: '无库存', statusTone: 'danger', stockTone: 'danger' }
  }
  if (lowerLimitQty > 0 && stockQty <= lowerLimitQty) {
    return { statusKey: 'low', statusText: '低库存', statusTone: 'warning', stockTone: 'warning' }
  }
  return { statusKey: 'normal', statusText: '正常', statusTone: 'success', stockTone: 'success' }
}

async function resolveOrgId(prisma, request) {
  return resolveRequestOrgId(prisma, request)
}

async function ensureDefaultWarehouse(prisma, orgId) {
  const existing = await prisma.warehouse.findFirst({
    where: { orgId },
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

async function getOrCreateWarehouseByName(prisma, orgId, name) {
  const warehouseName = normalizeWarehouseName(name)
  const existing = await prisma.warehouse.findFirst({
    where: { orgId, name: warehouseName }
  })
  if (existing) return existing

  return prisma.warehouse.create({
    data: {
      orgId,
      name: warehouseName,
      manager: warehouseName === '默认仓' ? '王姐' : '',
      address: '',
      isDefault: false,
      status: 'enabled'
    }
  })
}

async function ensureInventoryBalances(prisma, orgId) {
  const defaultWarehouse = await ensureDefaultWarehouse(prisma, orgId)
  await mergeDefaultWarehouseAliases(prisma, orgId, defaultWarehouse.id)

  const variants = await prisma.productVariant.findMany({
    include: { product: true },
    orderBy: { id: 'asc' }
  })
  if (!variants.length) return

  const existingBalances = await prisma.inventoryBalance.findMany({
    where: { orgId },
    select: { warehouseId: true, variantId: true }
  })

  const warehouseMap = new Map()
  const warehouses = await prisma.warehouse.findMany({ where: { orgId } })
  warehouses.forEach(warehouse => warehouseMap.set(warehouse.name, warehouse))
  const existingKeys = new Set(existingBalances.map(item => `${item.warehouseId}::${String(item.variantId)}`))
  if (existingBalances.length >= variants.length) return

  for (const variant of variants) {
    const warehouseName = normalizeWarehouseName(variant.warehouseName)
    let warehouse = warehouseMap.get(warehouseName)
    if (!warehouse) {
      warehouse = await getOrCreateWarehouseByName(prisma, orgId, warehouseName)
      warehouseMap.set(warehouse.name, warehouse)
    }

    const key = `${warehouse.id}::${String(variant.id)}`
    if (!existingKeys.has(key)) {
      await prisma.inventoryBalance.create({
        data: {
          orgId,
          warehouseId: warehouse.id,
          variantId: variant.id,
          stockQty: decimalNumber(variant.openingStock).toFixed(2),
          reservedQty: '0.00'
        }
      })
      existingKeys.add(key)
    }
  }
}

async function mergeDefaultWarehouseAliases(prisma, orgId, defaultWarehouseId) {
  const aliases = await prisma.warehouse.findMany({
    where: {
      orgId,
      id: { not: defaultWarehouseId },
      name: { in: ['默认', '默认仓库', '贵阳仓库'] }
    }
  })
  if (!aliases.length) return

  for (const warehouse of aliases) {
    const balances = await prisma.inventoryBalance.findMany({
      where: { orgId, warehouseId: warehouse.id }
    })
    for (const balance of balances) {
      const existing = await prisma.inventoryBalance.findFirst({
        where: {
          orgId,
          warehouseId: defaultWarehouseId,
          variantId: balance.variantId
        }
      })
      if (existing) {
        await prisma.inventoryBalance.update({
          where: { id: existing.id },
          data: {
            stockQty: (decimalNumber(existing.stockQty) + decimalNumber(balance.stockQty)).toFixed(2),
            reservedQty: (decimalNumber(existing.reservedQty) + decimalNumber(balance.reservedQty)).toFixed(2)
          }
        })
        await prisma.inventoryBalance.delete({ where: { id: balance.id } })
      } else {
        await prisma.inventoryBalance.update({
          where: { id: balance.id },
          data: { warehouseId: defaultWarehouseId }
        })
      }
    }

    await prisma.inventoryLedger.updateMany({
      where: { orgId, warehouseId: warehouse.id },
      data: { warehouseId: defaultWarehouseId }
    })
    await prisma.salesOrder.updateMany({
      where: { orgId, warehouseId: warehouse.id },
      data: { warehouseId: defaultWarehouseId, warehouseName: '默认仓' }
    })
    await prisma.purchaseOrder.updateMany({
      where: { orgId, warehouseId: warehouse.id },
      data: { warehouseId: defaultWarehouseId }
    })
    await prisma.returnOrder.updateMany({
      where: { orgId, warehouseId: warehouse.id },
      data: { warehouseId: defaultWarehouseId }
    })

    const stillUsed = await Promise.all([
      prisma.inventoryBalance.count({ where: { warehouseId: warehouse.id } }),
      prisma.inventoryLedger.count({ where: { warehouseId: warehouse.id } }),
      prisma.salesOrder.count({ where: { warehouseId: warehouse.id } }),
      prisma.purchaseOrder.count({ where: { warehouseId: warehouse.id } }),
      prisma.returnOrder.count({ where: { warehouseId: warehouse.id } })
    ])
    if (stillUsed.some(Boolean)) {
      await prisma.warehouse.update({
        where: { id: warehouse.id },
        data: { status: 'disabled' }
      })
    } else {
      await prisma.warehouse.delete({ where: { id: warehouse.id } })
    }
  }
}

async function syncVariantOpeningStock(tx, variantId) {
  const balances = await tx.inventoryBalance.findMany({
    where: { variantId }
  })
  const total = balances.reduce((sum, item) => sum + decimalNumber(item.stockQty), 0)
  await tx.productVariant.update({
    where: { id: variantId },
    data: { openingStock: total.toFixed(3) }
  })
}

async function applyInventoryChange(tx, options) {
  const orgId = options.orgId
  const variantId = BigInt(options.variantId)
  const productId = BigInt(options.productId)
  const changeQty = Number(options.changeQty || 0)
  const warehouse = options.warehouseId
    ? await tx.warehouse.findFirst({ where: { id: options.warehouseId, orgId } })
    : await getOrCreateWarehouseByName(tx, orgId, options.warehouseName || '默认仓')

  if (!warehouse) throw new Error('仓库不存在')
  if (!Number.isFinite(changeQty) || changeQty === 0) return null

  let balance = await tx.inventoryBalance.findFirst({
    where: {
      orgId,
      warehouseId: warehouse.id,
      variantId
    }
  })
  if (!balance) {
    balance = await tx.inventoryBalance.create({
      data: {
        orgId,
        warehouseId: warehouse.id,
        variantId,
        stockQty: '0.00',
        reservedQty: '0.00'
      }
    })
  }

  const beforeQty = decimalNumber(balance.stockQty)
  const afterQty = beforeQty + changeQty
  if (afterQty < 0) throw new Error('库存不足，不能完成出库')

  await tx.inventoryBalance.update({
    where: { id: balance.id },
    data: { stockQty: afterQty.toFixed(2) }
  })

  const ledger = await tx.inventoryLedger.create({
    data: {
      orgId,
      warehouseId: warehouse.id,
      productId,
      variantId,
      type: options.type,
      refType: options.refType || null,
      refId: options.refId ? String(options.refId) : null,
      beforeQty: beforeQty.toFixed(2),
      changeQty: changeQty.toFixed(2),
      afterQty: afterQty.toFixed(2),
      reason: options.reason || '',
      operator: options.operator || '系统'
    }
  })
  await syncVariantOpeningStock(tx, variantId)
  return ledger
}

function toWarehouseDto(warehouse) {
  return {
    id: warehouse.id,
    name: warehouse.name,
    keeper: warehouse.manager || '',
    manager: warehouse.manager || '',
    address: warehouse.address || '',
    isDefault: Boolean(warehouse.isDefault),
    defaultText: warehouse.isDefault ? '默认仓' : '',
    ...warehouseStatusMeta(warehouse.status)
  }
}

function emptyWarehouseForm() {
  return {
    mode: 'create',
    id: '',
    name: '',
    keeper: '',
    manager: '',
    address: '',
    isDefault: false,
    statusKey: 'enabled'
  }
}

function toWarehouseForm(warehouse) {
  if (!warehouse) return emptyWarehouseForm()
  return {
    mode: 'edit',
    id: warehouse.id,
    name: warehouse.name,
    keeper: warehouse.manager || '',
    manager: warehouse.manager || '',
    address: warehouse.address || '',
    isDefault: Boolean(warehouse.isDefault),
    statusKey: warehouse.status
  }
}

function validateWarehousePayload(payload) {
  const errors = []
  const name = normalizeText(payload.name)
  const manager = normalizeText(payload.keeper || payload.manager)
  const address = normalizeText(payload.address)
  const statusKey = payload.statusKey === 'disabled' || payload.status === 'disabled' ? 'disabled' : 'enabled'
  const isDefault = Boolean(payload.isDefault)

  if (!name) errors.push('请输入仓库名称')
  if (name.length > 50) errors.push('仓库名称不能超过50字')
  if (manager.length > 30) errors.push('仓管不能超过30字')
  if (address.length > 120) errors.push('仓库地址不能超过120字')
  if (isDefault && statusKey === 'disabled') errors.push('默认仓不可停用')

  return {
    errors,
    data: {
      name,
      manager,
      address,
      isDefault,
      status: isDefault ? 'enabled' : statusKey
    }
  }
}

function toInventoryItemDto(balance) {
  const variant = balance.variant || {}
  const product = variant.product || {}
  const warehouse = balance.warehouse || {}
  const stockQty = decimalNumber(balance.stockQty)
  const reservedQty = decimalNumber(balance.reservedQty)
  const salePriceCents = Math.round(decimalNumber(variant.salePrice) * 100)
  const configuredLowerLimitQty = decimalNumber(variant.minStock)
  const lowerLimitQty = configuredLowerLimitQty || getFallbackLowerLimit(stockQty)
  const unit = variant.unit || product.defaultUnit || ''
  const stockValueCents = Math.round(stockQty * salePriceCents)
  const status = inventoryStatusMeta(stockQty, lowerLimitQty)
  const color = variant.skuValue || '默认'

  return {
    id: `${balance.warehouseId}::${String(balance.variantId)}`,
    balanceId: balance.id,
    productId: String(variant.productId || product.id || ''),
    variantId: String(balance.variantId || variant.id || ''),
    productName: product.productName || '未命名产品',
    productNo: product.productNo || '',
    category: product.categoryName || '未分类',
    categoryPathText: product.categoryName || '未分类',
    color,
    imageUrl: '',
    warehouseId: balance.warehouseId,
    warehouseName: warehouse.name || variant.warehouseName || '默认仓',
    unit,
    stockQty,
    reservedQty,
    availableQty: Math.max(stockQty - reservedQty, 0),
    inTransitQty: 0,
    configuredLowerLimitQty,
    lowerLimitQty,
    lowerLimitIsDefault: !configuredLowerLimitQty && lowerLimitQty > 0,
    priceCents: salePriceCents,
    costPriceCents: salePriceCents,
    stockValueCents,
    isLowStock: status.statusKey === 'low',
    searchText: [
      product.productName,
      product.productNo,
      product.categoryName,
      variant.skuCode,
      variant.barcode,
      variant.skuValue,
      warehouse.name,
      unit
    ].join(' ').toLowerCase(),
    ...status,
    stockText: formatQty(stockQty, unit),
    availableText: formatQty(Math.max(stockQty - reservedQty, 0), unit),
    inTransitText: formatQty(0, unit),
    lowerLimitText: formatQty(lowerLimitQty, unit),
    stockValueText: formatMoney(stockValueCents),
    salePriceText: formatMoney(salePriceCents),
    costPriceText: formatMoney(salePriceCents),
    titleText: `${product.productName || '未命名产品'} · ${color}`,
    metaText: `${product.categoryName || '未分类'} · ${warehouse.name || '默认仓'}`
  }
}

function isInventoryMatched(item, filters) {
  const keyword = normalizeText(filters.keyword).toLowerCase()
  const warehouseName = normalizeText(filters.warehouseName || '全部')
  const statusKey = normalizeText(filters.statusKey || 'all')

  if (keyword && !item.searchText.includes(keyword)) return false
  if (warehouseName && warehouseName !== '全部' && item.warehouseName !== warehouseName) return false
  if (statusKey === 'low' && item.statusKey !== 'low') return false
  if (statusKey === 'empty' && item.statusKey !== 'empty') return false
  if (statusKey === 'positive' && item.stockQty <= 0) return false
  if (statusKey === 'normal' && item.statusKey !== 'normal') return false
  return true
}

function sortInventoryItems(items, sortKey) {
  const sorted = items.slice()
  sorted.sort((a, b) => {
    if (sortKey === 'stockAsc') return a.stockQty - b.stockQty
    if (sortKey === 'stockDesc') return b.stockQty - a.stockQty
    if (sortKey === 'valueDesc') return b.stockValueCents - a.stockValueCents
    if (sortKey === 'nameAsc') return a.titleText.localeCompare(b.titleText, 'zh-Hans-CN', { numeric: true })
    const aScore = a.statusKey === 'low' ? 0 : (a.statusKey === 'empty' ? 1 : 2)
    const bScore = b.statusKey === 'low' ? 0 : (b.statusKey === 'empty' ? 1 : 2)
    if (aScore !== bScore) return aScore - bScore
    return a.stockQty - b.stockQty
  })
  return sorted
}

function buildInventorySummary(items) {
  const totalStock = items.reduce((sum, item) => sum + item.stockQty, 0)
  const totalValueCents = items.reduce((sum, item) => sum + item.stockValueCents, 0)
  const lowCount = items.filter(item => item.statusKey === 'low').length
  const emptyCount = items.filter(item => item.statusKey === 'empty').length
  return {
    itemCount: items.length,
    totalStock,
    totalStockText: formatNumber(totalStock),
    totalValueCents,
    totalValueText: formatMoney(totalValueCents),
    availableText: formatNumber(items.reduce((sum, item) => sum + item.availableQty, 0)),
    stockedCount: items.filter(item => item.stockQty > 0).length,
    lowCount,
    emptyCount,
    normalCount: items.length - lowCount - emptyCount
  }
}

async function loadInventoryItems(prisma, orgId, filters = {}) {
  await ensureInventoryBalances(prisma, orgId)
  const context = filters.context || null
  const warehouseIds = isWarehouseScoped(context, 'inventory') && Array.isArray(context.warehouseIds) && context.warehouseIds.length
    ? context.warehouseIds
    : null
  const balances = await prisma.inventoryBalance.findMany({
    where: {
      orgId,
      ...(warehouseIds ? { warehouseId: { in: warehouseIds } } : {})
    },
    include: {
      warehouse: true,
      variant: {
        include: { product: true }
      }
    },
    orderBy: { updatedAt: 'desc' }
  })
  return sortInventoryItems(
    balances.map(toInventoryItemDto).filter(item => isInventoryMatched(item, filters)),
    filters.sortKey || 'lowFirst'
  )
}

async function findInventoryBalance(prisma, orgId, rawId, context = null) {
  await ensureInventoryBalances(prisma, orgId)
  const decodedId = decodeURIComponent(rawId || '')
  const parts = decodedId.split('::')
  let balance = null

  if (parts.length === 2 && parts[0] && /^\d+$/.test(parts[1])) {
    const variantId = BigInt(parts[1])
    balance = await prisma.inventoryBalance.findFirst({
      where: {
        orgId,
        warehouseId: parts[0],
        variantId
      },
      include: {
        warehouse: true,
        variant: {
          include: { product: true }
        }
      }
    })
  }

  if (!balance && /^\d+$/.test(decodedId)) {
    balance = await prisma.inventoryBalance.findFirst({
      where: { orgId, variantId: BigInt(decodedId) },
      include: {
        warehouse: true,
        variant: {
          include: { product: true }
        }
      }
    })
  }

  return balance && canAccessWarehouse(context, balance.warehouseId) ? balance : null
}

function toInventoryLedgerDto(record) {
  const unit = record.variant ? record.variant.unit || record.product.defaultUnit || '' : ''
  return {
    id: record.id,
    operator: record.operator || '系统',
    time: formatDateTime(record.createdAt),
    beforeQty: decimalNumber(record.beforeQty),
    deltaQty: decimalNumber(record.changeQty),
    afterQty: decimalNumber(record.afterQty),
    beforeText: formatQty(record.beforeQty, unit),
    deltaText: formatSignedQty(record.changeQty, unit),
    afterText: formatQty(record.afterQty, unit),
    note: record.reason || ''
  }
}

async function inventoryRoutes(app) {
  app.get('/warehouses', async request => {
    const orgId = await resolveOrgId(app.prisma, request)
    await ensureInventoryBalances(app.prisma, orgId)
    const keyword = normalizeText(request.query.keyword).toLowerCase()
    const ids = isWarehouseScoped(request.orgContext, 'warehouses') ? request.orgContext.warehouseIds || [] : []
    const warehouses = await app.prisma.warehouse.findMany({
      where: { orgId, ...(ids.length ? { id: { in: ids } } : {}) },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }]
    })
    const list = warehouses.map(toWarehouseDto).filter(warehouse => {
      if (!keyword) return true
      return [
        warehouse.name,
        warehouse.keeper,
        warehouse.address,
        warehouse.statusText,
        warehouse.defaultText
      ].join(' ').toLowerCase().includes(keyword)
    })
    return ok(list, request.id)
  })

  app.get('/warehouses/summary', async request => {
    const orgId = await resolveOrgId(app.prisma, request)
    await ensureInventoryBalances(app.prisma, orgId)
    const ids = isWarehouseScoped(request.orgContext, 'warehouses') ? request.orgContext.warehouseIds || [] : []
    const warehouses = await app.prisma.warehouse.findMany({ where: { orgId, ...(ids.length ? { id: { in: ids } } : {}) } })
    return ok({
      warehouseCount: warehouses.length,
      enabledCount: warehouses.filter(warehouse => warehouse.status === 'enabled').length,
      defaultName: (warehouses.find(warehouse => warehouse.isDefault) || {}).name || '未设置'
    }, request.id)
  })

  app.get('/warehouses/names', async request => {
    const orgId = await resolveOrgId(app.prisma, request)
    await ensureInventoryBalances(app.prisma, orgId)
    const ids = isWarehouseScoped(request.orgContext, 'warehouses') ? request.orgContext.warehouseIds || [] : []
    const warehouses = await app.prisma.warehouse.findMany({
      where: { orgId, status: 'enabled', ...(ids.length ? { id: { in: ids } } : {}) },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }]
    })
    return ok(warehouses.map(warehouse => warehouse.name), request.id)
  })

  app.get('/warehouses/:id/form', async request => {
    const orgId = await resolveOrgId(app.prisma, request)
    const id = normalizeText(request.params.id)
    if (!id) return ok(emptyWarehouseForm(), request.id)
    const warehouse = await app.prisma.warehouse.findFirst({ where: { id, orgId } })
    if (warehouse && !canAccessWarehouse(request.orgContext, warehouse.id)) return ok(emptyWarehouseForm(), request.id)
    return ok(toWarehouseForm(warehouse), request.id)
  })

  app.get('/warehouses/:id', async request => {
    const orgId = await resolveOrgId(app.prisma, request)
    const warehouse = await app.prisma.warehouse.findFirst({
      where: { id: normalizeText(request.params.id), orgId }
    })
    if (!warehouse) {
      return fail('仓库不存在', { code: 404, traceId: request.id })
    }
    if (!canAccessWarehouse(request.orgContext, warehouse.id)) {
      return fail('当前账号没有该仓库数据权限', { code: 403, traceId: request.id })
    }
    return ok(toWarehouseDto(warehouse), request.id)
  })

  async function saveWarehouse(request, reply) {
    const orgId = await resolveOrgId(app.prisma, request)
    const payload = request.body || {}
    const { errors, data } = validateWarehousePayload(payload)
    const id = normalizeText(payload.id || request.params.id)
    const duplicate = await app.prisma.warehouse.findFirst({
      where: {
        orgId,
        name: data.name,
        ...(id ? { NOT: { id } } : {})
      }
    })
    if (duplicate) errors.push('仓库名称已存在')
    if (errors.length) {
      reply.code(400)
      return fail(errors[0], { code: 400, data: { errors }, traceId: request.id })
    }

    const warehouse = await app.prisma.$transaction(async tx => {
      if (data.isDefault) {
        await tx.warehouse.updateMany({
          where: { orgId },
          data: { isDefault: false }
        })
      }
      if (id) {
        return tx.warehouse.update({
          where: { id },
          data
        })
      }
      return tx.warehouse.create({
        data: {
          orgId,
          ...data
        }
      })
    })
    return ok(toWarehouseDto(warehouse), request.id)
  }

  app.post('/warehouses', saveWarehouse)
  app.put('/warehouses/:id', saveWarehouse)

  app.post('/warehouses/:id/status', async (request, reply) => {
    const orgId = await resolveOrgId(app.prisma, request)
    const warehouse = await app.prisma.warehouse.findFirst({
      where: { id: normalizeText(request.params.id), orgId }
    })
    if (!warehouse) {
      reply.code(404)
      return fail('仓库不存在', { code: 404, traceId: request.id })
    }
    if (!canAccessWarehouse(request.orgContext, warehouse.id)) {
      reply.code(403)
      return fail('当前账号没有该仓库数据权限', { code: 403, traceId: request.id })
    }
    if (warehouse.isDefault && warehouse.status === 'enabled') {
      reply.code(400)
      return fail('默认仓不可停用', { code: 400, traceId: request.id })
    }
    const updated = await app.prisma.warehouse.update({
      where: { id: warehouse.id },
      data: { status: warehouse.status === 'enabled' ? 'disabled' : 'enabled' }
    })
    return ok(toWarehouseDto(updated), request.id)
  })

  app.get('/inventory-options/warehouses', async request => {
    const orgId = await resolveOrgId(app.prisma, request)
    await ensureInventoryBalances(app.prisma, orgId)
    const ids = isWarehouseScoped(request.orgContext, 'inventory') ? request.orgContext.warehouseIds || [] : []
    const warehouses = await app.prisma.warehouse.findMany({
      where: { orgId, status: 'enabled', ...(ids.length ? { id: { in: ids } } : {}) },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }]
    })
    return ok(['全部'].concat(warehouses.map(warehouse => warehouse.name)), request.id)
  })

  app.get('/inventory', async request => {
    const orgId = await resolveOrgId(app.prisma, request)
    const list = await loadInventoryItems(app.prisma, orgId, { ...(request.query || {}), context: request.orgContext })
    return ok({ list, total: list.length }, request.id)
  })

  app.get('/inventory/summary', async request => {
    const orgId = await resolveOrgId(app.prisma, request)
    const list = await loadInventoryItems(app.prisma, orgId, { ...(request.query || {}), context: request.orgContext })
    return ok(buildInventorySummary(list), request.id)
  })

  app.get('/inventory/:id/adjust-context', async (request, reply) => {
    const orgId = await resolveOrgId(app.prisma, request)
    const balance = await findInventoryBalance(app.prisma, orgId, request.params.id, request.orgContext)
    if (!balance) {
      reply.code(404)
      return fail('库存记录不存在', { code: 404, traceId: request.id })
    }
    const recentRecords = await app.prisma.inventoryLedger.findMany({
      where: {
        orgId,
        warehouseId: balance.warehouseId,
        variantId: balance.variantId,
        type: 'adjustment'
      },
      include: {
        product: true,
        variant: true
      },
      orderBy: { createdAt: 'desc' },
      take: 6
    })
    return ok({
      item: toInventoryItemDto(balance),
      recentRecords: recentRecords.map(toInventoryLedgerDto)
    }, request.id)
  })

  app.get('/inventory/:id', async (request, reply) => {
    const orgId = await resolveOrgId(app.prisma, request)
    const balance = await findInventoryBalance(app.prisma, orgId, request.params.id, request.orgContext)
    if (!balance) {
      reply.code(404)
      return fail('库存记录不存在', { code: 404, traceId: request.id })
    }
    return ok(toInventoryItemDto(balance), request.id)
  })

  app.post('/inventory/adjustments', async (request, reply) => {
    const orgId = await resolveOrgId(app.prisma, request)
    const payload = request.body || {}
    const balance = await findInventoryBalance(app.prisma, orgId, payload.itemId || payload.id, request.orgContext)
    if (!balance) {
      reply.code(404)
      return fail('库存记录不存在', { code: 404, traceId: request.id })
    }

    const adjustQty = Number(String(payload.adjustQty || '').replace(/[^\d.-]/g, ''))
    const errors = []
    if (!Number.isFinite(adjustQty) || adjustQty === 0) errors.push('请输入调整数量')
    const beforeQty = decimalNumber(balance.stockQty)
    const afterQty = beforeQty + adjustQty
    if (afterQty < 0) errors.push('调整后库存不能小于 0')
    const reason = normalizeText(payload.note || payload.reason)
    if (reason.length > 120) errors.push('调整说明不能超过120字')
    if (errors.length) {
      reply.code(400)
      return fail(errors[0], { code: 400, data: { errors }, traceId: request.id })
    }

    const result = await app.prisma.$transaction(async tx => {
      await tx.inventoryBalance.update({
        where: { id: balance.id },
        data: { stockQty: afterQty.toFixed(2) }
      })
      const ledger = await tx.inventoryLedger.create({
        data: {
          orgId,
          warehouseId: balance.warehouseId,
          productId: balance.variant.productId,
          variantId: balance.variantId,
          type: 'adjustment',
          refType: 'inventory_adjustment',
          refId: balance.id,
          beforeQty: beforeQty.toFixed(2),
          changeQty: adjustQty.toFixed(2),
          afterQty: afterQty.toFixed(2),
          reason,
          operator: normalizeText(payload.operator) || '王姐'
        },
        include: {
          product: true,
          variant: true
        }
      })
      await syncVariantOpeningStock(tx, balance.variantId)
      const updated = await tx.inventoryBalance.findUnique({
        where: { id: balance.id },
        include: {
          warehouse: true,
          variant: {
            include: { product: true }
          }
        }
      })
      return { ledger, updated }
    })

    const recentRecords = await app.prisma.inventoryLedger.findMany({
      where: {
        orgId,
        warehouseId: balance.warehouseId,
        variantId: balance.variantId,
        type: 'adjustment'
      },
      include: {
        product: true,
        variant: true
      },
      orderBy: { createdAt: 'desc' },
      take: 6
    })

    return ok({
      ok: true,
      record: toInventoryLedgerDto(result.ledger),
      item: toInventoryItemDto(result.updated),
      recentRecords: recentRecords.map(toInventoryLedgerDto)
    }, request.id)
  })
}

module.exports = {
  applyInventoryChange,
  inventoryRoutes,
  ensureInventoryBalances,
  syncVariantOpeningStock
}
