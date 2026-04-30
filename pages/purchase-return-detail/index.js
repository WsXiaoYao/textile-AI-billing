const returnStore = require('../../services/return-store')

Page({
  data: {
    order: returnStore.getReturnOrder()
  },

  onLoad(options = {}) {
    this.orderId = decodeURIComponent(options.id || '')
    this.loadDetail()
  },

  onShow() {
    this.loadDetail()
  },

  loadDetail() {
    this.setData({
      order: returnStore.getReturnOrder(this.orderId)
    })
  },

  onBackTap() {
    if (getCurrentPages().length > 1) {
      wx.navigateBack()
      return
    }
    wx.navigateTo({ url: '/pages/purchase-returns/index' })
  },

  onEditTap() {
    wx.navigateTo({
      url: `/pages/purchase-return-edit/index?id=${encodeURIComponent(this.data.order.id)}`
    })
  },

  onShareAppMessage() {
    const order = this.data.order
    return {
      title: `退货单 ${order.no}`,
      path: `/pages/purchase-return-detail/index?id=${encodeURIComponent(order.id)}`
    }
  }
})
