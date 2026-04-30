const inventoryStore = require('../../services/inventory-store')

function getSuggestedAdjustQty(item) {
  if (!item || !item.isLowStock || !item.lowerLimitQty) return ''
  const delta = Math.max(1, item.lowerLimitQty - item.stockQty + 1)
  return inventoryStore.formatQty(delta, '').trim()
}

function buildViewState(item, adjustQty, adjustDirection) {
  const rawQty = Math.abs(inventoryStore.parseAdjustQty(adjustQty))
  const deltaQty = adjustDirection === 'decrease' ? -rawQty : rawQty
  const afterQty = item ? item.stockQty + deltaQty : 0
  let afterTone = 'success'
  if (afterQty < 0) afterTone = 'danger'
  if (item && item.lowerLimitQty > 0 && afterQty >= 0 && afterQty <= item.lowerLimitQty) afterTone = 'warning'
  return {
    deltaQty,
    afterQty,
    afterStockText: item ? inventoryStore.formatQty(afterQty, item.unit) : '0',
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

  loadItem(id, keepDraft = false) {
    const item = inventoryStore.getInventoryItem(id)
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
      recentRecords: inventoryStore.getRecentAdjustments(item.id),
      afterStockText: viewState.afterStockText,
      afterTone: viewState.afterTone
    })
  },

  onAdjustInput(event) {
    const adjustQty = String(event.detail.value || '').replace(/[^\d.]/g, '')
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
        note: event.detail.value
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

  onSaveTap() {
    const adjustQty = Math.abs(inventoryStore.parseAdjustQty(this.data.form.adjustQty))
    const result = inventoryStore.saveInventoryAdjust({
      ...this.data.form,
      adjustQty: this.data.form.adjustDirection === 'decrease' ? `-${adjustQty}` : `${adjustQty}`
    })
    if (!result.ok) {
      wx.showToast({ title: result.message || '保存失败', icon: 'none' })
      return
    }

    wx.showToast({ title: '库存已调整', icon: 'success' })
    this.setData({
      item: result.item,
      form: {
        ...this.data.form,
        adjustQty: '',
        adjustDirection: 'increase',
        note: ''
      },
      recentRecords: inventoryStore.getRecentAdjustments(result.item.id),
      afterStockText: result.item.stockText,
      afterTone: result.item.stockTone
    })
  }
})
