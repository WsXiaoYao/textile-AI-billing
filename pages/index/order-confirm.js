const orderApi = require('../../api/order-api')
const validator = require('../../utils/form-validation')

function formatMoney(cents, options = {}) {
  const value = Number(cents || 0)
  const absCents = Math.abs(value)
  const yuan = Math.floor(absCents / 100)
  const fen = absCents % 100
  const sign = value < 0 ? '-' : ''
  const prefix = options.plus && value > 0 ? '+' : ''
  return `${prefix}${sign}¥${String(yuan).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}${fen ? `.${String(fen).padStart(2, '0')}` : ''}`
}

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
    saleDate: '2026-05-11',
    items: [
      { id: 'cloth-rice', productId: '881', variantId: '3528', name: '25玛寸布', color: '25玛-米色', quantity: 20, quantityText: '20米', unitPriceCents: 150, amountCents: 3000, stockQty: 0 },
      { id: 'cloth-gray', productId: '881', variantId: '3529', name: '25玛寸布', color: '25玛-深灰', quantity: 15, quantityText: '15米', unitPriceCents: 150, amountCents: 2250, stockQty: 18 },
      { id: 'xiangyun-rice', productId: '883', name: '280祥云', color: 'H513-米', quantity: 10, quantityText: '10米', unitPriceCents: 4200, amountCents: 42000, stockQty: 120 }
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
  return formatMoney(Number(cents || 0)).replace(/(\.\d)0$/, '$1')
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
    totalText: formatMoney(totalCents),
    discountText: formatMoney(discountCents),
    contractText: formatMoney(contractCents),
    prepaidText: formatMoney(Number(source.prepaidCents || 0)),
    usePrepaidText: formatMoney(-usePrepaidCents),
    unpaidText: formatMoney(unpaidCents),
    customerDebtText: formatMoney(Number(source.customer && source.customer.receivableCents || 32000)),
    items: source.items.map(item => ({
      ...item,
      priceText: formatUnitPrice(item.unitPriceCents),
      amountText: formatMoney(Number(item.amountCents || 0)),
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
    const discountInputValue = validator.normalizeDecimalInput(event.detail.value, { maxDecimal: 2 })
    const discountCents = clampCents(parseMoneyInput(discountInputValue), this.data.draft.totalCents)
    this.setData({
      draft: normalizeDraft({
        ...this.data.draft,
        discountCents
      }),
      discountInputValue
    })
  },

  onDiscountBlur() {
    this.setData({
      discountInputValue: formatMoneyInput(this.data.draft.discountCents)
    })
  },

  onRemarkInput(event) {
    this.setData({
      remark: event.detail.value.slice(0, 500)
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

  async onConfirmTap() {
    if (this.data.submitting) return
    const draft = this.data.draft || {}
    const errors = []
    if (!draft.customer || !draft.customer.id) errors.push('请选择客户')
    if (!draft.items || !draft.items.length) errors.push('请添加开单明细')
    ;(draft.items || []).forEach((item, index) => {
      if (!item.productId || !item.variantId) errors.push(`第${index + 1}行请选择产品规格`)
      if (Number(item.quantity || 0) <= 0) errors.push(`第${index + 1}行数量必须大于0`)
      if (Number(item.unitPriceCents || 0) < 0) errors.push(`第${index + 1}行单价不能小于0`)
    })
    if (Number(draft.discountCents || 0) > Number(draft.totalCents || 0)) errors.push('优惠金额不能大于订单金额')
    validator.maxLength(errors, '备注', this.data.remark, 500)
    if (validator.showFirstError(errors)) return

    this.setData({ submitting: true })

    try {
      const detail = await orderApi.createOrder({
        ...this.data.draft,
        remark: this.data.remark
      })
      getApp().globalData.pendingCheckoutOrder = null

      wx.redirectTo({
        url: `/pages/order-detail/index?id=${detail.id}&from=checkout`
      })
    } catch (error) {
      this.setData({ submitting: false })
      wx.showToast({
        title: error.message || '下单失败',
        icon: 'none'
      })
    }
  }
})
