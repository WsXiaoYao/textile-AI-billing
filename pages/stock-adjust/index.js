const inventoryApi = require('../../api/inventory-api')
const validator = require('../../utils/form-validation')

function formatNumber(value) {
  const number = Number(value || 0)
  if (Number.isInteger(number)) return String(number)
  return String(Number(number.toFixed(2)))
}

function formatQty(value, unit) {
  return `${formatNumber(value)}${unit || ''}`
}

function parseAdjustQty(value) {
  const matched = String(value || '').match(/[-+]?\d+(\.\d+)?/)
  if (!matched) return 0
  const parsed = Number(matched[0])
  return Number.isNaN(parsed) ? 0 : parsed
}

function getSuggestedAdjustQty(item) {
  if (!item || !item.isLowStock || !item.lowerLimitQty) return ''
  const delta = Math.max(1, item.lowerLimitQty - item.stockQty + 1)
  return formatQty(delta, '').trim()
}

function buildViewState(item, adjustQty, adjustDirection) {
  const rawQty = Math.abs(parseAdjustQty(adjustQty))
  const deltaQty = adjustDirection === 'decrease' ? -rawQty : rawQty
  const afterQty = item ? item.stockQty + deltaQty : 0
  let afterTone = 'success'
  if (afterQty < 0) afterTone = 'danger'
  if (item && item.lowerLimitQty > 0 && afterQty >= 0 && afterQty <= item.lowerLimitQty) afterTone = 'warning'
  return {
    deltaQty,
    afterQty,
    afterStockText: item ? formatQty(afterQty, item.unit) : '0',
    afterTone
  }
}

Page({
  data: {
    item: null,
    form: {
      itemId: '',
      warehouseName: '',
      adjustQty: '',
      adjustDirection: 'increase',
      note: ''
    },
    afterStockText: '0',
    afterTone: 'success',
    recentRecords: []
  },

  onLoad(options = {}) {
    this.loadItem(options.id)
  },

  onShow() {
    if (this.data.form.itemId) this.loadItem(this.data.form.itemId, true)
  },

  async loadItem(id, keepDraft = false) {
    try {
      const context = await inventoryApi.getAdjustContext(id)
      const item = context && context.item
      if (!item) {
        wx.showToast({ title: '没有库存记录', icon: 'none' })
        return
      }

      const warehouseName = keepDraft ? this.data.form.warehouseName : item.warehouseName
      const adjustQty = keepDraft ? this.data.form.adjustQty : getSuggestedAdjustQty(item)
      const adjustDirection = keepDraft ? this.data.form.adjustDirection : 'increase'
      const viewState = buildViewState(item, adjustQty, adjustDirection)

      this.setData({
        item,
        form: {
          itemId: item.id,
          warehouseName,
          adjustQty,
          adjustDirection,
          note: keepDraft ? this.data.form.note : ''
        },
        recentRecords: context.recentRecords || [],
        afterStockText: viewState.afterStockText,
        afterTone: viewState.afterTone
      })
    } catch (error) {
      wx.showToast({ title: error.message || '库存加载失败', icon: 'none' })
    }
  },

  onAdjustInput(event) {
    const adjustQty = validator.normalizeDecimalInput(event.detail.value, { maxDecimal: 2 })
    const viewState = buildViewState(this.data.item, adjustQty, this.data.form.adjustDirection)
    this.setData({
      form: {
        ...this.data.form,
        adjustQty
      },
      afterStockText: viewState.afterStockText,
      afterTone: viewState.afterTone
    })
  },

  onDirectionTap(event) {
    const adjustDirection = event.currentTarget.dataset.direction || 'increase'
    const viewState = buildViewState(this.data.item, this.data.form.adjustQty, adjustDirection)
    this.setData({
      form: {
        ...this.data.form,
        adjustDirection
      },
      afterStockText: viewState.afterStockText,
      afterTone: viewState.afterTone
    })
  },

  onNoteInput(event) {
    this.setData({
      form: {
        ...this.data.form,
        note: event.detail.value.slice(0, 120)
      }
    })
  },

  onCancelTap() {
    if (getCurrentPages().length > 1) {
      wx.navigateBack()
      return
    }
    wx.navigateTo({ url: '/pages/stock-summary/index' })
  },

  async onSaveTap() {
    const adjustQty = Math.abs(parseAdjustQty(this.data.form.adjustQty))
    const viewState = buildViewState(this.data.item, this.data.form.adjustQty, this.data.form.adjustDirection)
    const errors = []
    if (!adjustQty) errors.push('请输入调整数量')
    if (viewState.afterQty < 0) errors.push('调整后库存不能小于 0')
    validator.maxLength(errors, '调整说明', this.data.form.note, 120)
    if (validator.showFirstError(errors)) return

    try {
      const result = await inventoryApi.adjustInventory({
        ...this.data.form,
        adjustQty: this.data.form.adjustDirection === 'decrease' ? `-${adjustQty}` : `${adjustQty}`
      })
      wx.showToast({ title: '库存已调整', icon: 'success' })
      this.setData({
        item: result.item,
        form: {
          ...this.data.form,
          adjustQty: '',
          adjustDirection: 'increase',
          note: ''
        },
        recentRecords: result.recentRecords || [],
        afterStockText: result.item.stockText,
        afterTone: result.item.stockTone
      })
    } catch (error) {
      wx.showToast({ title: error.message || '保存失败', icon: 'none' })
    }
  }
})
