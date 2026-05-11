const customerApi = require('../../api/customer-api')

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

function formatAmountInput(cents) {
  return (Number(cents || 0) / 100).toFixed(2)
}

function formatMoney(cents, options = {}) {
  const amount = Number(cents || 0) / 100
  const sign = options.plus && amount > 0 ? '+' : ''
  return `${sign}¥${amount.toFixed(2)}`
}

function getEmptyReceipt() {
  return {
    customer: {},
    receiptDate: today,
    remark: '客户整体收款，按销售日期从旧到新自动分摊。',
    prepayRemark: '客户预收款，暂不分摊销售单。',
    totalUnpaidCents: 0,
    receiptCents: 0,
    usePrepaid: false,
    prepayMode: false,
    usePrepaidCents: 0,
    availablePrepaidCents: 0,
    afterUnpaidCents: 0,
    prepaidAfterCents: 0,
    defaultReceiptCents: 0,
    orderCount: 0,
    allocatedCount: 0,
    allocation: [],
    displayAllocation: [],
    previewRows: []
  }
}

function buildReceiptPreview(source, receiptCents, options = {}) {
  const totalUnpaidCents = Number(source.totalUnpaidCents || 0)
  const availablePrepaidCents = Number(source.availablePrepaidCents || 0)
  const usePrepaid = Boolean(options.usePrepaid)
  const prepayMode = Boolean(options.prepayMode)
  const usePrepaidCents = usePrepaid ? Math.min(availablePrepaidCents, totalUnpaidCents) : 0
  const distributionCents = prepayMode ? usePrepaidCents : Number(receiptCents || 0) + usePrepaidCents
  const afterUnpaidCents = Math.max(totalUnpaidCents - distributionCents, 0)
  const prepaidAfterCents = prepayMode
    ? availablePrepaidCents - usePrepaidCents + Number(receiptCents || 0)
    : availablePrepaidCents - usePrepaidCents

  return {
    ...source,
    receiptCents,
    usePrepaid,
    prepayMode,
    usePrepaidCents,
    afterUnpaidCents,
    prepaidAfterCents,
    receiptText: formatMoney(receiptCents),
    afterUnpaidText: formatMoney(afterUnpaidCents),
    usePrepaidText: formatMoney(usePrepaidCents),
    prepaidAfterText: formatMoney(prepaidAfterCents),
    previewRows: prepayMode
      ? [
          { label: '收款前累计欠款', value: formatMoney(totalUnpaidCents), tone: 'normal' },
          { label: '使用预收款', value: formatMoney(-usePrepaidCents), tone: 'primary' },
          { label: '本次转入预收款', value: formatMoney(receiptCents, { plus: true }), tone: 'success' },
          { label: '收款后累计欠款', value: formatMoney(afterUnpaidCents), tone: afterUnpaidCents ? 'danger' : 'success' },
          { label: '预收款余额', value: formatMoney(prepaidAfterCents), tone: prepaidAfterCents ? 'success' : 'normal' }
        ]
      : [
          { label: '收款前累计欠款', value: formatMoney(totalUnpaidCents), tone: 'normal' },
          { label: '本次收款', value: formatMoney(-receiptCents), tone: 'success' },
          { label: '收款后累计欠款', value: formatMoney(afterUnpaidCents), tone: afterUnpaidCents ? 'danger' : 'success' },
          { label: '预收款余额', value: formatMoney(prepaidAfterCents), tone: prepaidAfterCents ? 'success' : 'normal' }
        ]
  }
}

Page({
  data: {
    receipt: getEmptyReceipt(),
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

  async onLoad(options = {}) {
    this.customerId = decodeURIComponent(options.id || '黔西-龙凤')
    let receipt = getEmptyReceipt()
    try {
      receipt = await customerApi.getReceiptContext(this.customerId)
    } catch (error) {
      wx.showToast({
        title: error.message || '收款信息加载失败',
        icon: 'none'
      })
    }
    const receiptCents = receipt.defaultReceiptCents || 0

    this.setData({
      receipt,
      receiptCents,
      amountInput: formatAmountInput(receiptCents),
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
      amountInput: formatAmountInput(this.data.receiptCents)
    })
  },

  onFillAllTap() {
    const totalUnpaidCents = this.data.receipt.totalUnpaidCents
    const usePrepaidCents = this.data.usePrepaid ? this.data.receipt.usePrepaidCents : 0
    const receiptCents = this.data.prepayMode ? this.data.receiptCents : Math.max(totalUnpaidCents - usePrepaidCents, 0)

    this.setData({
      receiptCents,
      amountInput: formatAmountInput(receiptCents)
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
      amountInput: formatAmountInput(nextReceiptCents)
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
    const receipt = buildReceiptPreview(this.data.receipt, receiptCents, {
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

  async onConfirmTap() {
    if (!this.data.canSubmit) {
      wx.showToast({
        title: this.data.amountError || '请检查收款金额',
        icon: 'none'
      })
      return
    }

    try {
      await customerApi.recordReceipt(this.customerId, {
        amountCents: this.data.receiptCents,
        usePrepaidCents: this.data.receipt.usePrepaidCents,
        date: this.data.receiptDate,
        remark: this.data.prepayMode ? (this.data.remark || '本次金额转入客户预收款余额。') : (this.data.remark || '客户整体收款自动分摊。'),
        prepayMode: this.data.prepayMode
      })

      wx.showToast({
        title: this.data.prepayMode ? '预收已保存' : '收款已保存',
        icon: 'success'
      })

      setTimeout(() => {
        if (getCurrentPages().length > 1) {
          wx.navigateBack()
        }
      }, 500)
    } catch (error) {
      wx.showToast({
        title: error.message || '收款保存失败',
        icon: 'none'
      })
    }
  }
})
