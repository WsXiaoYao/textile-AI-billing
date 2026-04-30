const productStore = require('./product-store')
const supplierStore = require('./supplier-store')
const warehouseStore = require('./warehouse-store')

const purchaseStorageKey = 'textile_purchase_orders_v1'

let cachedOrders

function canUseStorage() {
  return typeof wx !== 'undefined' && wx.getStorageSync && wx.setStorageSync
}

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function formatDate(date) {
  const pad = value => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function formatNumber(value) {
  return productStore.formatNumber(Number(value || 0))
}

function parseQty(value) {
  const normalized = String(value || '').replace(/[^\d.]/g, '')
  if (!normalized) return 0
  const qty = Number(normalized)
  return Number.isNaN(qty) ? 0 : qty
}

function parseAmountInput(value) {
  const normalized = String(value || '').replace(/[^\d.]/g, '')
  if (!normalized) return 0
  const parts = normalized.split('.')
  const yuan = Number(parts[0] || 0)
  const fen = Number(String(parts[1] || '').slice(0, 2).padEnd(2, '0') || 0)
  if (Number.isNaN(yuan) || Number.isNaN(fen)) return 0
  return yuan * 100 + fen
}

function formatAmountInput(cents) {
  return (Number(cents || 0) / 100).toFixed(2)
}

function formatMoney(cents) {
  return productStore.formatMoney(cents)
}

function getSupplierOptions() {
  return supplierStore.getSupplierList()
    .filter(supplier => supplier.statusKey !== 'disabled')
    .map(supplier => ({
      id: supplier.id,
      name: supplier.name
    }))
}

function getWarehouseOptions() {
  return warehouseStore.getWarehouseNames().map(name => ({
    id: name,
    name
  }))
}

function getProductOptions() {
  const options = []
  productStore.getProductList().forEach(product => {
    product.variants.forEach(variant => {
      options.push({
        id: `${product.id}__${variant.id}`,
        productId: product.id,
        variantId: variant.id,
        productName: product.name,
        productNo: product.no || '',
        productImageUrl: product.imageUrl || '',
        variantImageUrl: variant.imageUrl || '',
        color: variant.color || '默认',
        unit: variant.unit || product.unit || '件',
        stockQty: Number(variant.stockQty || 0),
        priceCents: Number(variant.costPriceCents || variant.priceCents || 0),
        categoryPathText: product.categoryPathText || product.category || '',
        categoryLeaf: product.categoryLeaf || product.category || '',
        searchText: [
          product.name,
          product.no,
          product.category,
          product.categoryPathText,
          variant.color,
          variant.colorNo,
          product.warehouse
        ].join(' ').toLowerCase()
      })
    })
  })
  return options
}

function findProductOption(productName, colorHint) {
  const options = getProductOptions()
  return options.find(option =>
    option.productName.includes(productName) &&
    (!colorHint || option.color.includes(colorHint))
  ) || options.find(option => option.productName.includes(productName)) || options[0]
}

function createLine(productName, colorHint, quantity, priceCents) {
  const option = findProductOption(productName, colorHint)
  if (!option) {
    return {
      id: `line-${Date.now()}`,
      productId: '',
      variantId: '',
      productName: productName || '采购品项',
      color: colorHint || '默认',
      unit: '件',
      stockQty: 0,
      quantity,
      unitPriceCents: priceCents
    }
  }

  return {
    id: `${option.id}-${Date.now()}-${Math.round(Math.random() * 1000)}`,
    productId: option.productId,
    variantId: option.variantId,
    productName: option.productName,
    color: option.color,
    unit: option.unit,
    stockQty: option.stockQty,
    quantity,
    unitPriceCents: priceCents || option.priceCents || 0
  }
}

function getDefaultLines() {
  return [
    createLine('25玛寸布', '米', 50, 1800),
    createLine('280祥云', '米', 120, 4200),
    createLine('3公分金线曲牙织带', '金', 60, 4100)
  ]
}

function getSeedOrders() {
  const suppliers = getSupplierOptions()
  const supplierA = suppliers.find(supplier => supplier.name.includes('织树')) || suppliers[0] || { id: 'S001', name: '贵阳的织树料厂' }
  const supplierB = suppliers.find(supplier => supplier.name.includes('双雄')) || suppliers[1] || supplierA
  const supplierC = suppliers.find(supplier => supplier.name.includes('海绵')) || suppliers[2] || supplierA

  return [
    {
      id: 'CG202604180003',
      no: 'CG202604180003',
      supplierId: supplierA.id,
      supplierName: supplierA.name,
      date: '2026-04-18',
      warehouseName: '投色仓',
      creator: '王姐',
      remark: '补采购布类与寸布面料。',
      discountCents: 0,
      statusKey: 'draft',
      stockApplied: false,
      items: getDefaultLines()
    },
    {
      id: 'CG202604120001',
      no: 'CG202604120001',
      supplierId: supplierB.id,
      supplierName: supplierB.name,
      date: '2026-04-12',
      warehouseName: '默认仓',
      creator: '王姐',
      remark: '',
      discountCents: 0,
      statusKey: 'submitted',
      stockApplied: false,
      items: [
        createLine('水貂绒', '灰', 100, 3200),
        createLine('复合', '默认', 50, 4000)
      ]
    },
    {
      id: 'CG202604050002',
      no: 'CG202604050002',
      supplierId: supplierC.id,
      supplierName: supplierC.name,
      date: '2026-04-05',
      warehouseName: '辅料仓',
      creator: '劳群',
      remark: '',
      discountCents: 0,
      statusKey: 'submitted',
      stockApplied: false,
      items: [
        createLine('海绵', '默认', 45, 9000),
        createLine('包装', '默认', 30, 2500)
      ]
    }
  ]
}

function normalizeLine(line, index) {
  const quantity = Number(line.quantity || 0)
  const unitPriceCents = Number(line.unitPriceCents || 0)
  const amountCents = Math.round(quantity * unitPriceCents)
  const unit = line.unit || '件'

  return {
    ...line,
    id: line.id || `${line.productId || 'item'}-${line.variantId || index}-${index}`,
    productId: line.productId || '',
    variantId: line.variantId || '',
    productName: String(line.productName || '采购品项').trim(),
    color: String(line.color || '默认').trim(),
    unit,
    stockQty: Number(line.stockQty || 0),
    quantity,
    quantityInput: formatNumber(quantity),
    quantityText: `${formatNumber(quantity)} ${unit}`,
    unitPriceCents,
    unitPriceInput: formatAmountInput(unitPriceCents),
    unitPriceText: formatMoney(unitPriceCents),
    stockText: `库存 ${formatNumber(line.stockQty || 0)}${unit}`,
    amountCents,
    amountText: formatMoney(amountCents)
  }
}

function normalizeOrder(order) {
  const items = (order.items || []).map(normalizeLine)
  const orderAmountCents = items.reduce((sum, item) => sum + item.amountCents, 0)
  const discountCents = Number(order.discountCents || 0)
  const contractAmountCents = Math.max(0, orderAmountCents - discountCents)
  const statusKey = order.statusKey === 'submitted' ? 'submitted' : 'draft'

  return {
    ...order,
    id: order.id || order.no || `CG${Date.now()}`,
    no: order.no || order.id || `CG${Date.now()}`,
    supplierId: order.supplierId || '',
    supplierName: String(order.supplierName || '未选择供应商').trim(),
    date: order.date || formatDate(new Date()),
    warehouseName: order.warehouseName || '默认仓',
    creator: order.creator || '王姐',
    remark: String(order.remark || '').trim(),
    statusKey,
    statusText: statusKey === 'submitted' ? '已提交' : '草稿',
    statusTone: statusKey === 'submitted' ? 'success' : 'warning',
    stockApplied: Boolean(order.stockApplied),
    items,
    itemCount: items.length,
    orderAmountCents,
    discountCents,
    contractAmountCents,
    orderAmountText: formatMoney(orderAmountCents),
    discountText: discountCents ? `-${formatMoney(discountCents)}` : formatMoney(0),
    contractAmountText: formatMoney(contractAmountCents),
    searchText: [
      order.no,
      order.supplierName,
      order.date,
      order.warehouseName,
      order.creator,
      items.map(item => `${item.productName} ${item.color}`).join(' ')
    ].join(' ').toLowerCase()
  }
}

function saveOrders() {
  if (!canUseStorage()) return
  wx.setStorageSync(purchaseStorageKey, cachedOrders)
}

function loadOrders() {
  if (cachedOrders) return cachedOrders

  if (canUseStorage()) {
    const stored = wx.getStorageSync(purchaseStorageKey)
    if (Array.isArray(stored) && stored.length) {
      cachedOrders = stored.map(normalizeOrder)
      return cachedOrders
    }
  }

  cachedOrders = getSeedOrders().map(normalizeOrder)
  saveOrders()
  return cachedOrders
}

function sortOrders(list) {
  return list.slice().sort((a, b) => {
    if (b.date !== a.date) return b.date.localeCompare(a.date)
    return b.no.localeCompare(a.no)
  })
}

function getPurchaseOrderList() {
  return sortOrders(loadOrders())
}

function getPurchaseOrder(id) {
  const decodedId = decodeURIComponent(id || '')
  return loadOrders().find(order => order.id === decodedId || order.no === decodedId) || loadOrders()[0]
}

function getPurchaseOrderForm(id) {
  const order = id ? getPurchaseOrder(id) : null
  if (!order) {
    const supplier = getSupplierOptions()[0] || { id: '', name: '' }
    return {
      mode: 'create',
      id: '',
      no: `CG${Date.now()}`,
      supplierId: supplier.id,
      supplierName: supplier.name,
      date: '2026-04-18',
      warehouseName: '投色仓',
      creator: '王姐',
      remark: '',
      discountCents: 0,
      statusKey: 'draft',
      stockApplied: false,
      items: getDefaultLines().map(normalizeLine)
    }
  }

  return normalizeOrder({
    ...clone(order),
    mode: 'edit'
  })
}

function savePurchaseOrderForm(form) {
  const supplierName = String(form.supplierName || '').trim()
  if (!supplierName) return { ok: false, message: '请选择供应商' }
  if (!form.items || !form.items.length) return { ok: false, message: '请添加采购明细' }

  const invalidItem = form.items.find(item => !Number(item.quantity || 0) || !Number(item.unitPriceCents || 0))
  if (invalidItem) return { ok: false, message: '请补全采购数量和单价' }

  const oldId = decodeURIComponent(form.id || '')
  const orders = loadOrders()
  const next = normalizeOrder({
    ...form,
    id: oldId || form.no || `CG${Date.now()}`,
    no: form.no || oldId || `CG${Date.now()}`
  })

  cachedOrders = orders
    .filter(order => order.id !== oldId && order.no !== oldId && order.id !== next.id)
    .concat(next)
    .map(normalizeOrder)
  saveOrders()
  return { ok: true, order: next }
}

function applyStockIncrease(items) {
  const products = productStore.getProductList()
  items.forEach(item => {
    const product = products.find(record => record.id === item.productId || record.no === item.productId)
    if (!product) return
    const variant = product.variants.find(record => record.id === item.variantId)
    if (!variant) return
    productStore.updateVariantStock(product.id, variant.id, Number(variant.stockQty || 0) + Number(item.quantity || 0))
  })
}

function submitPurchaseOrderForm(form) {
  const oldId = decodeURIComponent(form.id || '')
  const previous = oldId ? getPurchaseOrder(oldId) : null
  const shouldApplyStock = !(previous && previous.stockApplied)
  const nextForm = {
    ...form,
    statusKey: 'submitted',
    stockApplied: true
  }

  if (shouldApplyStock) {
    applyStockIncrease(nextForm.items || [])
  }

  return savePurchaseOrderForm(nextForm)
}

function createLineFromOption(option) {
  return normalizeLine({
    id: `${option.id}-${Date.now()}`,
    productId: option.productId,
    variantId: option.variantId,
    productName: option.productName,
    color: option.color,
    unit: option.unit,
    stockQty: option.stockQty,
    quantity: 1,
    unitPriceCents: option.priceCents
  })
}

module.exports = {
  createLineFromOption,
  formatAmountInput,
  formatMoney,
  getProductOptions,
  getPurchaseOrder,
  getPurchaseOrderForm,
  getPurchaseOrderList,
  getSupplierOptions,
  getWarehouseOptions,
  normalizeLine,
  parseAmountInput,
  parseQty,
  savePurchaseOrderForm,
  submitPurchaseOrderForm
}
