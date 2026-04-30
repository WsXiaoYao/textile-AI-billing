const productStore = require('./product-store')
const warehouseStore = require('./warehouse-store')

const adjustmentStorageKey = 'textile_inventory_adjustments_v1'

let cachedAdjustments

function canUseStorage() {
  return typeof wx !== 'undefined' && wx.getStorageSync && wx.setStorageSync
}

function formatDateTime(date) {
  const pad = value => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function getFallbackLowerLimit(stockQty) {
  return stockQty > 0 && stockQty <= 20 ? 20 : 0
}

function getTone(item) {
  if (item.stockQty <= 0) return 'danger'
  if (item.isLowStock) return 'warning'
  return 'success'
}

function getStatus(item) {
  if (item.stockQty <= 0) {
    return {
      statusKey: 'empty',
      statusText: '无库存',
      statusTone: 'danger'
    }
  }
  if (item.isLowStock) {
    return {
      statusKey: 'low',
      statusText: '低库存',
      statusTone: 'warning'
    }
  }
  return {
    statusKey: 'normal',
    statusText: '正常',
    statusTone: 'success'
  }
}

function formatQty(value, unit) {
  return `${productStore.formatNumber(value)}${unit || ''}`
}

function formatSignedQty(value, unit) {
  const normalized = Number(value || 0)
  const prefix = normalized > 0 ? '+' : ''
  return `${prefix}${productStore.formatNumber(normalized)}${unit || ''}`
}

function parseAdjustQty(value) {
  const matched = String(value || '').match(/[-+]?\d+(\.\d+)?/)
  if (!matched) return 0
  const parsed = Number(matched[0])
  return Number.isNaN(parsed) ? 0 : parsed
}

function getInventoryItems() {
  const products = productStore.getProductList()
  const items = []

  products.forEach(product => {
    product.variants.forEach(variant => {
      const stockQty = Number(variant.stockQty || 0)
      const configuredLowerLimitQty = Number(variant.lowerLimitQty || 0)
      const lowerLimitQty = configuredLowerLimitQty || getFallbackLowerLimit(stockQty)
      const unit = variant.unit || product.unit || ''
      const isLowStock = lowerLimitQty > 0 && stockQty <= lowerLimitQty
      const stockValueCents = Math.round(stockQty * Number(variant.costPriceCents || variant.priceCents || 0))
      const base = {
        id: `${product.id}::${variant.id}`,
        productId: product.id,
        variantId: variant.id,
        productName: product.name,
        productNo: product.no,
        category: product.category,
        categoryPathText: product.categoryPathText,
        color: variant.color || '默认',
        imageUrl: variant.imageUrl || product.imageUrl,
        warehouseName: product.warehouse || '默认仓',
        unit,
        stockQty,
        availableQty: Math.max(stockQty, 0),
        inTransitQty: 0,
        configuredLowerLimitQty,
        lowerLimitQty,
        lowerLimitIsDefault: !configuredLowerLimitQty && lowerLimitQty > 0,
        priceCents: Number(variant.priceCents || 0),
        costPriceCents: Number(variant.costPriceCents || 0),
        stockValueCents,
        isLowStock,
        searchText: [
          product.name,
          product.no,
          product.category,
          product.categoryPathText,
          product.warehouse,
          product.unit,
          variant.color
        ].join(' ').toLowerCase()
      }
      const status = getStatus(base)
      const item = {
        ...base,
        ...status,
        stockTone: getTone(base),
        stockText: formatQty(stockQty, unit),
        availableText: formatQty(Math.max(stockQty, 0), unit),
        inTransitText: formatQty(0, unit),
        lowerLimitText: formatQty(lowerLimitQty, unit),
        stockValueText: productStore.formatMoney(stockValueCents),
        salePriceText: variant.salePriceText || productStore.formatMoney(variant.priceCents),
        costPriceText: variant.costPriceText || productStore.formatMoney(variant.costPriceCents),
        titleText: `${product.name} · ${variant.color || '默认'}`,
        metaText: `${product.category || '未分类'} · ${product.warehouse || '默认仓'}`
      }
      items.push(item)
    })
  })

  return items
}

function getWarehouseOptions() {
  return ['全部'].concat(warehouseStore.getWarehouseNames())
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

function isMatched(item, filters) {
  const keyword = String(filters.keyword || '').trim().toLowerCase()
  const warehouseName = filters.warehouseName || '全部'
  const statusKey = filters.statusKey || 'all'

  if (keyword && !item.searchText.includes(keyword)) return false
  if (warehouseName && warehouseName !== '全部' && item.warehouseName !== warehouseName) return false
  if (statusKey === 'low' && item.statusKey !== 'low') return false
  if (statusKey === 'empty' && item.statusKey !== 'empty') return false
  if (statusKey === 'positive' && item.stockQty <= 0) return false
  if (statusKey === 'normal' && item.statusKey !== 'normal') return false
  return true
}

function queryInventory(filters = {}) {
  return sortInventoryItems(
    getInventoryItems().filter(item => isMatched(item, filters)),
    filters.sortKey || 'lowFirst'
  )
}

function getInventorySummary(filters = {}) {
  const items = queryInventory(filters)
  const totalStock = items.reduce((sum, item) => sum + item.stockQty, 0)
  const totalValueCents = items.reduce((sum, item) => sum + item.stockValueCents, 0)
  const lowCount = items.filter(item => item.statusKey === 'low').length
  const emptyCount = items.filter(item => item.statusKey === 'empty').length

  return {
    itemCount: items.length,
    totalStock,
    totalStockText: productStore.formatNumber(totalStock),
    totalValueCents,
    totalValueText: productStore.formatMoney(totalValueCents),
    availableText: productStore.formatNumber(items.reduce((sum, item) => sum + item.availableQty, 0)),
    stockedCount: items.filter(item => item.stockQty > 0).length,
    lowCount,
    emptyCount,
    normalCount: items.length - lowCount - emptyCount
  }
}

function getInventoryItem(id) {
  const decodedId = decodeURIComponent(id || '')
  const item = getInventoryItems().find(record => record.id === decodedId)
  return item || sortInventoryItems(getInventoryItems(), 'lowFirst')[0]
}

function loadAdjustments() {
  if (cachedAdjustments) return cachedAdjustments

  if (canUseStorage()) {
    const stored = wx.getStorageSync(adjustmentStorageKey)
    if (Array.isArray(stored)) {
      cachedAdjustments = stored
      return cachedAdjustments
    }
  }

  cachedAdjustments = []
  saveAdjustments()
  return cachedAdjustments
}

function saveAdjustments() {
  if (!canUseStorage()) return
  wx.setStorageSync(adjustmentStorageKey, cachedAdjustments)
}

function getRecentAdjustments(itemId) {
  const decodedId = decodeURIComponent(itemId || '')
  return loadAdjustments()
    .filter(record => !decodedId || record.itemId === decodedId)
    .slice(0, 6)
}

function saveInventoryAdjust(form) {
  const item = getInventoryItem(form.itemId)
  if (!item) return { ok: false, message: '库存记录不存在' }

  const deltaQty = parseAdjustQty(form.adjustQty)
  if (!deltaQty) return { ok: false, message: '请输入调整数量' }

  const afterQty = item.stockQty + deltaQty
  if (afterQty < 0) return { ok: false, message: '调整后库存不能小于 0' }

  const result = productStore.updateVariantStock(item.productId, item.variantId, afterQty)
  if (!result.ok) return result

  const record = {
    id: `ADJ${Date.now()}`,
    itemId: item.id,
    productId: item.productId,
    variantId: item.variantId,
    productName: item.productName,
    color: item.color,
    warehouseName: form.warehouseName || item.warehouseName,
    unit: item.unit,
    beforeQty: item.stockQty,
    beforeText: formatQty(item.stockQty, item.unit),
    deltaQty,
    deltaText: formatSignedQty(deltaQty, item.unit),
    afterQty,
    afterText: formatQty(afterQty, item.unit),
    lowerLimitQty: item.lowerLimitQty,
    operator: form.operator || '王姐',
    time: formatDateTime(new Date()),
    note: String(form.note || '').trim()
  }

  cachedAdjustments = [record].concat(loadAdjustments()).slice(0, 60)
  saveAdjustments()

  return {
    ok: true,
    record,
    item: getInventoryItem(item.id)
  }
}

module.exports = {
  formatQty,
  formatSignedQty,
  getInventoryItem,
  getInventoryItems,
  getInventorySummary,
  getRecentAdjustments,
  getWarehouseOptions,
  parseAdjustQty,
  queryInventory,
  saveInventoryAdjust
}
