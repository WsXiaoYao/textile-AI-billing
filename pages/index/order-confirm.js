const orderStore = require('../../services/order-store')

function fallbackDraft() {
  return {
    customer: {
      id: '黔西-龙凤',
      name: '黔西-龙凤',
      code: 'TC-001',
      tag: '贵州客户',
      phone: '15685216085',
      address: '贵州省毕节市黔西市莲城大道',
      receivableCents: 32000
    },
    warehouse: '默认仓',
    saleDate: '2026-04-28',
    items: [
      { id: 'cloth-rice', productId: '829', name: '25玛寸布', color: '25玛-米色', quantityText: '20米', unitPriceCents: 150, amountCents: 3000, stockQty: 0 },
      { id: 'cloth-gray', productId: '829', name: '25玛寸布', color: '25玛-深灰', quantityText: '15米', unitPriceCents: 150, amountCents: 2250, stockQty: 18 },
      { id: 'xiangyun-rice', productId: '831', name: '280祥云', color: 'H513-米', quantityText: '10米', unitPriceCents: 4200, amountCents: 42000, stockQty: 120 }
    ],
    totalCents: 47250,
    discountCents: 7250,
    contractCents: 40000,
    prepaidCents: 10000,
    usePrepaidCents: 8000,
    unpaidCents: 32000,
    remark: ''
  }
}

function formatUnitPrice(cents) {
  return orderStore.formatMoney(Number(cents || 0)).replace(/(\.\d)0$/, '$1')
}

function clampCents(value, maxValue) {
  return Math.min(Math.max(Number(value || 0), 0), Math.max(Number(maxValue || 0), 0))
}

function parseMoneyInput(value) {
  const normalized = String(value || '')
    .replace(/[^\d.]/g, '')
    .replace(/(\..*)\./g, '$1')
  if (!normalized) return 0

  const parts = normalized.split('.')
  const yuan = Number(parts[0] || 0)
  const fenText = String(parts[1] || '').slice(0, 2).padEnd(2, '0')
  return yuan * 100 + Number(fenText || 0)
}

function formatMoneyInput(cents) {
  const value = Math.max(Number(cents || 0), 0)
  const yuan = Math.floor(value / 100)
  const fen = String(value % 100).padStart(2, '0')
  return `${yuan}.${fen}`
}

function normalizeDraft(draft) {
  const source = draft && draft.items && draft.items.length ? draft : fallbackDraft()
  const totalCents = Number(source.totalCents || source.items.reduce((sum, item) => sum + Number(item.amountCents || 0), 0))
  const sourceDiscountCents = Object.prototype.hasOwnProperty.call(source, 'discountCents')
    ? Number(source.discountCents || 0)
    : Math.max(totalCents - Number(source.contractCents || totalCents), 0)
  const discountCents = clampCents(sourceDiscountCents, totalCents)
  const contractCents = Math.max(totalCents - discountCents, 0)
  const usePrepaidCents = clampCents(source.usePrepaidCents, Math.min(Number(source.prepaidCents || 0), contractCents))
  const unpaidCents = Math.max(contractCents - usePrepaidCents, 0)

  return {
    ...source,
    totalCents,
    discountCents,
    contractCents,
    usePrepaidCents,
    unpaidCents,
    totalText: orderStore.formatMoney(totalCents),
    discountText: orderStore.formatMoney(discountCents),
    contractText: orderStore.formatMoney(contractCents),
    prepaidText: orderStore.formatMoney(Number(source.prepaidCents || 0)),
    usePrepaidText: orderStore.formatMoney(-usePrepaidCents),
    unpaidText: orderStore.formatMoney(unpaidCents),
    customerDebtText: orderStore.formatMoney(Number(source.customer && source.customer.receivableCents || 32000)),
    items: source.items.map(item => ({
      ...item,
      priceText: formatUnitPrice(item.unitPriceCents),
      amountText: orderStore.formatMoney(Number(item.amountCents || 0)),
      stockText: `库存 ${Number(item.stockQty || 0)}`
    }))
  }
}

Page({
  data: {
    draft: normalizeDraft(null),
    discountInputValue: '',
    remark: '',
    submitting: false
  },

  onLoad() {
    const app = getApp()
    const draft = normalizeDraft(app.globalData.pendingCheckoutOrder)
    this.setData({
      draft,
      discountInputValue: formatMoneyInput(draft.discountCents),
      remark: draft.remark || ''
    })
  },

  onDiscountInput(event) {
    const discountCents = clampCents(parseMoneyInput(event.detail.value), this.data.draft.totalCents)
    this.setData({
      draft: normalizeDraft({
        ...this.data.draft,
        discountCents
      }),
      discountInputValue: event.detail.value
    })
  },

  onDiscountBlur() {
    this.setData({
      discountInputValue: formatMoneyInput(this.data.draft.discountCents)
    })
  },

  onRemarkInput(event) {
    this.setData({
      remark: event.detail.value
    })
  },

  onBackToCartTap() {
    if (getCurrentPages().length > 1) {
      wx.navigateBack()
      return
    }
    wx.switchTab({ url: '/pages/index/index' })
  },

  onShareTap() {
    wx.showToast({
      title: '分享模板待接入',
      icon: 'none'
    })
  },

  onPrintTap() {
    wx.showToast({
      title: '保存后可打印',
      icon: 'none'
    })
  },

  onConfirmTap() {
    if (this.data.submitting) return
    this.setData({ submitting: true })

    const detail = orderStore.createOrderFromCheckout({
      ...this.data.draft,
      remark: this.data.remark
    })
    getApp().globalData.pendingCheckoutOrder = null

    wx.redirectTo({
      url: `/pages/order-detail/index?id=${detail.id}&from=checkout`
    })
  }
})
