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
    receipt: orderStore.getCustomerReceipt('黔西-龙凤'),
    receiptCents: 0,
    amountInput: '0.00',
    amountError: '',
    canSubmit: false,
    usePrepaid: false,
    prepayMode: false,
    receiptDate: today,
    remark: '客户整体收款，按销售日期从旧到新自动分摊。',
    pickerStartDate,
    pickerEndDate: today,
    modeNote: '',
    fillActionText: '全部收款',
    saveActionText: '保存收款',
    bottomAmountLabel: '本次收款'
  },

  onLoad(options = {}) {
    this.customerId = decodeURIComponent(options.id || '黔西-龙凤')
    const receipt = orderStore.getCustomerReceipt(this.customerId)
    const receiptCents = receipt.defaultReceiptCents

    this.setData({
      receipt,
      receiptCents,
      amountInput: orderStore.formatAmountInput(receiptCents),
      receiptDate: receipt.receiptDate,
      remark: receipt.remark
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
    const totalUnpaidCents = this.data.receipt.totalUnpaidCents
    const usePrepaidCents = this.data.usePrepaid ? this.data.receipt.usePrepaidCents : 0
    const receiptCents = this.data.prepayMode ? this.data.receiptCents : Math.max(totalUnpaidCents - usePrepaidCents, 0)

    this.setData({
      receiptCents,
      amountInput: orderStore.formatAmountInput(receiptCents)
    }, () => {
      this.updateReceiptResult(receiptCents)
    })
  },

  onDateChange(event) {
    this.setData({ receiptDate: event.detail.value })
  },

  onRemarkInput(event) {
    this.setData({ remark: event.detail.value })
  },

  onUsePrepaidChange(event) {
    const usePrepaid = event.detail.value
    const nextReceiptCents = usePrepaid && !this.data.prepayMode
      ? Math.max(this.data.receiptCents - this.data.receipt.availablePrepaidCents, 0)
      : this.data.receiptCents

    this.setData({
      usePrepaid,
      receiptCents: nextReceiptCents,
      amountInput: orderStore.formatAmountInput(nextReceiptCents)
    }, () => {
      this.updateReceiptResult(nextReceiptCents)
    })
  },

  onPrepayModeChange(event) {
    const prepayMode = event.detail.value
    this.setData({
      prepayMode,
      remark: prepayMode ? '客户预收款，暂不分摊销售单。' : '客户整体收款，按销售日期从旧到新自动分摊。'
    }, () => {
      this.updateReceiptResult(this.data.receiptCents)
    })
  },

  updateReceiptResult(receiptCents) {
    const receipt = orderStore.getCustomerReceipt(this.customerId, receiptCents, {
      usePrepaid: this.data.usePrepaid,
      prepayMode: this.data.prepayMode
    })
    const totalUnpaidCents = receipt.totalUnpaidCents
    const distributionCents = this.data.prepayMode ? receipt.usePrepaidCents : receiptCents + receipt.usePrepaidCents
    let amountError = ''

    if (this.data.prepayMode && receiptCents <= 0) {
      amountError = '请输入收款金额'
    } else if (!this.data.prepayMode && distributionCents <= 0) {
      amountError = '请输入收款金额或使用预收款'
    } else if (!this.data.prepayMode && distributionCents > totalUnpaidCents) {
      amountError = '本次收款和预收冲抵不能超过客户当前未收'
    } else if (!this.data.prepayMode && !receipt.orderCount) {
      amountError = '当前客户没有待收销售单'
    }

    this.setData({
      receipt,
      amountError,
      canSubmit: !amountError,
      modeNote: this.data.prepayMode
        ? '当前为预收款模式，不参与销售单自动分摊。'
        : '普通收款模式下，系统按销售单顺序自动分摊。',
      fillActionText: this.data.prepayMode ? '全部预收' : '全部收款',
      saveActionText: this.data.prepayMode ? '保存预收' : '保存收款',
      bottomAmountLabel: this.data.prepayMode ? '本次预收' : '本次收款'
    })
  },

  onCancelTap() {
    if (getCurrentPages().length > 1) {
      wx.navigateBack()
      return
    }
    wx.switchTab({ url: '/pages/customers/index' })
  },

  onConfirmTap() {
    if (!this.data.canSubmit) {
      wx.showToast({
        title: this.data.amountError || '请检查收款金额',
        icon: 'none'
      })
      return
    }

    if (this.data.prepayMode) {
      orderStore.recordCustomerPrepayment(this.customerId, {
        amountCents: this.data.receiptCents,
        usePrepaidCents: this.data.receipt.usePrepaidCents,
        date: this.data.receiptDate,
        remark: this.data.remark || '本次金额转入客户预收款余额。'
      })
    } else {
      orderStore.recordCustomerReceipt(this.customerId, {
        amountCents: this.data.receiptCents,
        usePrepaidCents: this.data.receipt.usePrepaidCents,
        date: this.data.receiptDate,
        remark: this.data.remark || '客户整体收款自动分摊。'
      })
    }

    wx.showToast({
      title: this.data.prepayMode ? '预收已保存' : '收款已保存',
      icon: 'success'
    })

    setTimeout(() => {
      if (getCurrentPages().length > 1) {
        wx.navigateBack()
      }
    }, 500)
  }
})
