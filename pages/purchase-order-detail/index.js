const purchaseStore = require('../../services/purchase-store')

Page({
  data: {
    order: purchaseStore.getPurchaseOrder()
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
      order: purchaseStore.getPurchaseOrder(this.orderId)
    })
  },

  onBackTap() {
    if (getCurrentPages().length > 1) {
      wx.navigateBack()
      return
    }
    wx.navigateTo({ url: '/pages/purchase-orders/index' })
  },

  onEditTap() {
    wx.navigateTo({
      url: `/pages/purchase-order-edit/index?id=${encodeURIComponent(this.data.order.id)}`
    })
  },

  onShareAppMessage() {
    const order = this.data.order
    return {
      title: `采购单 ${order.no}`,
      path: `/pages/purchase-order-detail/index?id=${encodeURIComponent(order.id)}`
    }
  }
})
