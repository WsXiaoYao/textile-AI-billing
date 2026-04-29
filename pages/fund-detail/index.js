const orderStore = require('../../services/order-store')

Page({
  data: {
    detail: null
  },

  onLoad(options = {}) {
    const id = decodeURIComponent(options.id || '')
    this.setData({
      detail: orderStore.getFundDetail(id)
    })
  },

  onBackTap() {
    if (getCurrentPages().length > 1) {
      wx.navigateBack()
      return
    }
    wx.switchTab({ url: '/pages/customers/index' })
  },

  onOpenOrderTap() {
    const relatedOrder = this.data.detail && this.data.detail.relatedOrder
    if (!relatedOrder || !relatedOrder.id) return
    wx.navigateTo({
      url: `/pages/order-detail/index?id=${relatedOrder.id}`
    })
  },

  onShareTemplateTap() {
    wx.showToast({
      title: '已生成分享模板',
      icon: 'none'
    })
  }
})
