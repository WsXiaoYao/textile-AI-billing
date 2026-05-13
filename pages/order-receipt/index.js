const orderApi = require('../../api/order-api')
const validator = require('../../utils/form-validation')

const today = '2026-05-11'
const pickerStartDate = '2024-01-01'

function formatMoney(cents, options = {}) {
  const value = Number(cents || 0)
  const absCents = Math.abs(value)
  const yuan = Math.floor(absCents / 100)
  const fen = absCents % 100
  const sign = value < 0 ? '-' : ''
  const prefix = options.plus && value > 0 ? '+' : ''
  return `${prefix}${sign}¥${String(yuan).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}${fen ? `.${String(fen).padStart(2, '0')}` : ''}`
}

function formatAmountInput(cents) {
  return (Number(cents || 0) / 100).toFixed(2)
}

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
    order: {
      id: '',
      no: '',
      customer: '',
      contractText: '¥0.00',
      receivedText: '¥0.00',
      unpaidText: '¥0.00',
      unpaidCents: 0,
      defaultReceiptCents: 0,
      receiptDate: today,
      remark: '补录本单收款。'
    },
    receiptCents: 0,
    amountInput: '0.00',
    receiptText: '¥0.00',
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

  async onLoad(options = {}) {
    this.orderId = options.id || ''
    await this.loadReceiptContext()
  },

  async loadReceiptContext() {
    if (!this.orderId) return
    try {
      const order = await orderApi.getReceiptContext(this.orderId)
      const receiptCents = order.defaultReceiptCents
      this.setData({
        order,
        receiptCents,
        amountInput: formatAmountInput(receiptCents),
        receiptDate: order.receiptDate,
        remark: order.remark
      }, () => {
        this.updateReceiptResult(receiptCents)
      })
    } catch (error) {
      wx.showToast({
        title: error.message || '收款信息加载失败',
        icon: 'none'
      })
    }
  },

  onAmountInput(event) {
    const amountInput = validator.normalizeDecimalInput(event.detail.value, { maxDecimal: 2 })
    const receiptCents = parseYuanToCents(amountInput)
    this.setData({
      receiptCents,
      amountInput
    }, () => {
      this.updateReceiptResult(receiptCents)
    })
  },

  onAmountBlur() {
    if (!this.data.amountInput) return
    this.setData({
      amountInput: formatAmountInput(this.data.receiptCents)
    })
  },

  onFillAllTap() {
    const receiptCents = this.data.order.unpaidCents
    this.setData({
      receiptCents,
      amountInput: formatAmountInput(receiptCents)
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
      remark: event.detail.value.slice(0, 120)
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
      receiptText: formatMoney(receiptCents, { plus: true }),
      afterUnpaidText: formatMoney(afterUnpaidCents),
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

  async onConfirmTap() {
    const errors = []
    validator.maxLength(errors, '备注', this.data.remark, 120)
    if (validator.showFirstError(errors)) return

    if (!this.data.canSubmit) {
      wx.showToast({
        title: this.data.amountError || '请检查收款金额',
        icon: 'none'
      })
      return
    }

    try {
      await orderApi.recordReceipt(this.data.order.id, {
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
    } catch (error) {
      wx.showToast({
        title: error.message || '收款失败',
        icon: 'none'
      })
    }
  }
})
