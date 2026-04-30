const orderStore = require('./order-store')
const productStore = require('./product-store')
const warehouseStore = require('./warehouse-store')

const returnStorageKey = 'textile_purchase_returns_v1'

let cachedReturns

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

function getCustomerOptions() {
  return orderStore.getCustomerList().map(customer => ({
    id: customer.id || customer.name,
    name: customer.name,
    phone: customer.phone || '',
    address: customer.address || '',
    tag: customer.tag || customer.category || '普通客户'
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
        priceCents: Number(variant.priceCents || variant.costPriceCents || 0),
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
      productName: productName || '退货品项',
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
    createLine('25玛寸布', '米', 20, 3500),
    createLine('25玛寸布', '深', 15, 3500),
    createLine('280祥云', '米', 5, 4200)
  ]
}

function getSeedReturns() {
  const customerA = getCustomerOptions().find(customer => customer.name === '黔西-龙凤') ||
    getCustomerOptions()[0] || { id: '黔西-龙凤', name: '黔西-龙凤', phone: '15685216085', address: '贵州省毕节市黔西市莲城大道', tag: '贵州客户' }
  const customerB = getCustomerOptions().find(customer => customer.name.includes('王')) ||
    { id: '四川古蔺-王端', name: '四川古蔺-王端', phone: '15685216085', address: '贵州省毕节市黔西市莲城大道', tag: '四川客户' }
  const customerC = getCustomerOptions().find(customer => customer.name.includes('李')) ||
    { id: '贵阳李总', name: '贵阳李总', phone: '15685216085', address: '贵州省毕节市黔西市莲城大道', tag: '贵州客户' }

  return [
    {
      id: 'TH202604180002',
      no: 'TH202604180002',
      customerId: customerA.id,
      customerName: customerA.name,
      customerPhone: customerA.phone,
      customerAddress: customerA.address,
      date: '2026-04-18',
      warehouseName: '投色仓',
      refundCents: 120000,
      statusKey: 'prepay',
      returnToPrepay: true,
      remark: '客户退回两色寸布，已确认计入预收。',
      stockApplied: true,
      prepayApplied: true,
      items: getDefaultLines()
    },
    {
      id: 'TH202604170001',
      no: 'TH202604170001',
      customerId: customerB.id,
      customerName: customerB.name,
      customerPhone: customerB.phone,
      customerAddress: customerB.address,
      date: '2026-04-17',
      warehouseName: '默认仓',
      refundCents: 64000,
      statusKey: 'partial',
      returnToPrepay: false,
      remark: '部分退款，剩余待线下处理。',
      stockApplied: true,
      prepayApplied: false,
      items: [createLine('280祥云', '米', 15, 4200)]
    },
    {
      id: 'TH202604130001',
      no: 'TH202604130001',
      customerId: customerC.id,
      customerName: customerC.name,
      customerPhone: customerC.phone,
      customerAddress: customerC.address,
      date: '2026-04-13',
      warehouseName: '投色仓',
      refundCents: 42000,
      statusKey: 'refunded',
      returnToPrepay: false,
      remark: '已完成退款。',
      stockApplied: true,
      prepayApplied: false,
      items: [createLine('3公分金线曲牙织带', '金', 10, 4200)]
    }
  ]
}

const statusMap = {
  pending: { text: '未退款', tone: 'danger' },
  partial: { text: '部分退款', tone: 'warning' },
  prepay: { text: '计入预收', tone: 'success' },
  refunded: { text: '已退款', tone: 'success' }
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
    productName: String(line.productName || '退货品项').trim(),
    color: String(line.color || '默认').trim(),
    unit,
    stockQty: Number(line.stockQty || 0),
    quantity,
    quantityInput: formatNumber(quantity),
    quantityText: `${formatNumber(quantity)}${unit}`,
    unitPriceCents,
    unitPriceInput: formatAmountInput(unitPriceCents),
    unitPriceText: formatMoney(unitPriceCents),
    stockText: `库存 ${formatNumber(line.stockQty || 0)}${unit}`,
    amountCents,
    amountText: formatMoney(amountCents)
  }
}

function normalizeReturn(record) {
  const items = (record.items || []).map(normalizeLine)
  const itemAmountCents = items.reduce((sum, item) => sum + item.amountCents, 0)
  const refundCents = Number(record.refundCents === undefined ? itemAmountCents : record.refundCents)
  const statusKey = record.returnToPrepay ? 'prepay' : (record.statusKey || 'pending')
  const status = statusMap[statusKey] || statusMap.pending

  return {
    ...record,
    id: record.id || record.no || `TH${Date.now()}`,
    no: record.no || record.id || `TH${Date.now()}`,
    customerId: record.customerId || record.customerName || '',
    customerName: String(record.customerName || '未选择客户').trim(),
    customerPhone: record.customerPhone || '',
    customerAddress: record.customerAddress || '',
    date: record.date || formatDate(new Date()),
    warehouseName: record.warehouseName || '默认仓',
    refundCents,
    refundInput: formatAmountInput(refundCents),
    refundText: formatMoney(refundCents),
    itemAmountCents,
    itemAmountText: formatMoney(itemAmountCents),
    statusKey,
    statusText: status.text,
    statusTone: status.tone,
    returnToPrepay: Boolean(record.returnToPrepay),
    refundDirectionText: record.returnToPrepay ? '计入客户预收' : status.text,
    remark: String(record.remark || '').trim(),
    stockApplied: Boolean(record.stockApplied),
    prepayApplied: Boolean(record.prepayApplied),
    items,
    itemCount: items.length,
    itemSummary: items.length ? `${items[0].productName} ${items.length}条明细` : '退货明细',
    searchText: [
      record.no,
      record.customerName,
      record.date,
      record.warehouseName,
      record.remark,
      items.map(item => `${item.productName} ${item.color}`).join(' ')
    ].join(' ').toLowerCase()
  }
}

function saveReturns() {
  if (!canUseStorage()) return
  wx.setStorageSync(returnStorageKey, cachedReturns)
}

function loadReturns() {
  if (cachedReturns) return cachedReturns

  if (canUseStorage()) {
    const stored = wx.getStorageSync(returnStorageKey)
    if (Array.isArray(stored) && stored.length) {
      cachedReturns = stored.map(normalizeReturn)
      return cachedReturns
    }
  }

  cachedReturns = getSeedReturns().map(normalizeReturn)
  saveReturns()
  return cachedReturns
}

function getReturnOrderList() {
  return loadReturns().map(normalizeReturn)
}

function getReturnSummary(orders = getReturnOrderList()) {
  const totalCents = orders.reduce((sum, item) => sum + Number(item.refundCents || 0), 0)
  const prepayCents = orders
    .filter(item => item.statusKey === 'prepay')
    .reduce((sum, item) => sum + Number(item.refundCents || 0), 0)
  const pendingCents = orders
    .filter(item => ['pending', 'partial'].includes(item.statusKey))
    .reduce((sum, item) => sum + Number(item.refundCents || 0), 0)

  return {
    title: '退货概览',
    metrics: [
      { key: 'refund', label: '退款金额', value: formatMoney(totalCents), tone: 'danger' },
      { key: 'prepay', label: '计入预收', value: formatMoney(prepayCents), tone: 'success' },
      { key: 'pending', label: '待退款', value: formatMoney(pendingCents), tone: 'warning' }
    ]
  }
}

function getReturnOrder(id) {
  const decodedId = decodeURIComponent(id || '')
  return loadReturns().find(item => item.id === decodedId || item.no === decodedId) || loadReturns()[0]
}

function getReturnOrderForm(id) {
  const record = id ? getReturnOrder(id) : null
  if (!record) {
    const customer = getCustomerOptions().find(item => item.name === '黔西-龙凤') ||
      getCustomerOptions()[0] || { id: '', name: '', phone: '', address: '' }
    return normalizeReturn({
      mode: 'create',
      id: '',
      no: `TH${Date.now()}`,
      customerId: customer.id,
      customerName: customer.name,
      customerPhone: customer.phone,
      customerAddress: customer.address,
      date: '2026-04-18',
      warehouseName: '投色仓',
      refundCents: 120000,
      statusKey: 'pending',
      returnToPrepay: true,
      remark: '客户退回两色寸布。',
      stockApplied: false,
      prepayApplied: false,
      items: getDefaultLines()
    })
  }

  return normalizeReturn({
    ...clone(record),
    mode: 'edit'
  })
}

function saveReturnOrderForm(form) {
  const customerName = String(form.customerName || '').trim()
  if (!customerName) return { ok: false, message: '请选择客户' }
  if (!form.items || !form.items.length) return { ok: false, message: '请添加退货明细' }
  if (!Number(form.refundCents || 0)) return { ok: false, message: '请填写退款金额' }

  const invalidItem = form.items.find(item => !Number(item.quantity || 0) || !Number(item.unitPriceCents || 0))
  if (invalidItem) return { ok: false, message: '请补全退货数量和单价' }

  const oldId = decodeURIComponent(form.id || '')
  const returns = loadReturns()
  const next = normalizeReturn({
    ...form,
    id: oldId || form.no || `TH${Date.now()}`,
    no: form.no || oldId || `TH${Date.now()}`
  })

  cachedReturns = returns
    .filter(item => item.id !== oldId && item.no !== oldId && item.id !== next.id)
    .concat(next)
    .map(normalizeReturn)
  saveReturns()
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

function submitReturnOrderForm(form) {
  const oldId = decodeURIComponent(form.id || '')
  const previous = oldId ? getReturnOrder(oldId) : null
  const shouldApplyStock = !(previous && previous.stockApplied)
  const shouldApplyPrepay = form.returnToPrepay && !(previous && previous.prepayApplied)
  const nextForm = {
    ...form,
    statusKey: form.returnToPrepay ? 'prepay' : (form.statusKey === 'refunded' ? 'refunded' : 'pending'),
    stockApplied: true,
    prepayApplied: Boolean(form.returnToPrepay || form.prepayApplied)
  }

  if (shouldApplyStock) {
    applyStockIncrease(nextForm.items || [])
  }

  if (shouldApplyPrepay) {
    orderStore.recordCustomerPrepayment(nextForm.customerId || nextForm.customerName, {
      amountCents: Number(nextForm.refundCents || 0),
      date: nextForm.date,
      remark: `退货单 ${nextForm.no} 金额计入客户预收。`
    })
  }

  return saveReturnOrderForm(nextForm)
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
  getCustomerOptions,
  getProductOptions,
  getReturnOrder,
  getReturnOrderForm,
  getReturnOrderList,
  getReturnSummary,
  getWarehouseOptions,
  normalizeLine,
  parseAmountInput,
  parseQty,
  saveReturnOrderForm,
  submitReturnOrderForm
}
