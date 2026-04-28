const orderStore = require('../../services/order-store')

const today = '2026-04-28'
const pickerStartDate = '2024-01-01'

function parseYuanToCents(value) {
  const normalized = String(value || '').replace(/[^\d.]/g, '')
  if (!normalized) return 0
  const parts = normalized.split('.')
  const yuan = Number(parts[0] || 0)
  const fenText = String(parts[1] || '').slice(0, 2).padEnd(2, '0')
  const fen = Number(fenText || 0)
  if (Number.isNaN(yuan) || Number.isNaN(fen)) return 0
  return yuan * 100 + fen
}

Page({
  data: {
    order: orderStore.getReceiptOrder('XS202604180003'),
    receiptCents: 32000,
    amountInput: '320.00',
    receiptText: '¥320',
    afterUnpaidText: '¥0.00',
    resultHint: '保存后只更新当前销售单，并生成收款记录。',
    resultTone: 'success',
    amountError: '',
    canSubmit: true,
    receiptDate: today,
    remark: '补录本单收款。',
    pickerStartDate,
    pickerEndDate: today
  },

  onLoad(options = {}) {
    this.orderId = options.id || 'XS202604180003'
    const order = orderStore.getReceiptOrder(this.orderId)
    const receiptCents = order.defaultReceiptCents

    this.setData({
      order,
      receiptCents,
      amountInput: orderStore.formatAmountInput(receiptCents),
      receiptDate: order.receiptDate,
      remark: order.remark
    }, () => {
      this.updateReceiptResult(receiptCents)
    })
  },

  onAmountInput(event) {
    const receiptCents = parseYuanToCents(event.detail.value)
    this.setData({
      receiptCents,
      amountInput: event.detail.value
    }, () => {
      this.updateReceiptResult(receiptCents)
    })
  },

  onAmountBlur() {
    if (!this.data.amountInput) return
    this.setData({
      amountInput: orderStore.formatAmountInput(this.data.receiptCents)
    })
  },

  onFillAllTap() {
    const receiptCents = this.data.order.unpaidCents
    this.setData({
      receiptCents,
      amountInput: orderStore.formatAmountInput(receiptCents)
    }, () => {
      this.updateReceiptResult(receiptCents)
    })
  },

  onDateChange(event) {
    this.setData({
      receiptDate: event.detail.value
    })
  },

  onRemarkInput(event) {
    this.setData({
      remark: event.detail.value
    })
  },

  updateReceiptResult(receiptCents) {
    const unpaidCents = this.data.order.unpaidCents
    const afterUnpaidCents = Math.max(unpaidCents - receiptCents, 0)
    let amountError = ''
    let resultHint = '保存后只更新当前销售单，并生成收款记录。'
    let resultTone = 'success'

    if (receiptCents <= 0) {
      amountError = '请输入收款金额'
      resultHint = '请输入有效的收款金额。'
      resultTone = 'danger'
    } else if (receiptCents > unpaidCents) {
      amountError = '本页只处理当前销售单，收款金额不能超过本单未收'
      resultHint = '如需处理超收款，请在销售单详情中使用超收流程。'
      resultTone = 'danger'
    }

    this.setData({
      receiptText: orderStore.formatMoney(receiptCents, { plus: true }),
      afterUnpaidText: orderStore.formatMoney(afterUnpaidCents),
      amountError,
      resultHint,
      resultTone,
      canSubmit: !amountError
    })
  },

  onCancelTap() {
    if (getCurrentPages().length > 1) {
      wx.navigateBack()
      return
    }
    wx.switchTab({ url: '/pages/orders/index' })
  },

  onConfirmTap() {
    if (!this.data.canSubmit) {
      wx.showToast({
        title: this.data.amountError || '请检查收款金额',
        icon: 'none'
      })
      return
    }

    orderStore.recordReceipt(this.data.order.id, {
      amountCents: this.data.receiptCents,
      date: this.data.receiptDate,
      remark: this.data.remark || '本单收款已回写销售单详情。'
    })

    wx.showToast({
      title: '收款已记录',
      icon: 'success'
    })

    setTimeout(() => {
      if (getCurrentPages().length > 1) {
        wx.navigateBack()
      }
    }, 500)
  }
})
