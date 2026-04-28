const orderStore = require('../../services/order-store')

Page({
  data: {
    detail: orderStore.getOrderDetail('XS202604180003'),
    showCreatedNotice: false
  },

  onLoad(options = {}) {
    this.orderId = options.id || 'XS202604180003'
    this.setData({
      showCreatedNotice: options.created === '1' || options.from === 'cart' || options.from === 'checkout'
    })
    this.loadDetail()
  },

  onShow() {
    this.loadDetail()
  },

  loadDetail() {
    this.setData({
      detail: orderStore.getOrderDetail(this.orderId || 'XS202604180003')
    })
  },

  onBackTap() {
    if (getCurrentPages().length > 1) {
      wx.navigateBack()
      return
    }
    wx.switchTab({ url: '/pages/orders/index' })
  },

  onReceiptTap() {
    if (!this.data.detail.canReceive) {
      wx.showToast({
        title: '当前销售单无需收款',
        icon: 'none'
      })
      return
    }
    wx.navigateTo({
      url: `/pages/order-receipt/index?id=${this.data.detail.id}`
    })
  },

  onPrintTap() {
    orderStore.markPrinted(this.data.detail.id)
    this.loadDetail()
    wx.showToast({
      title: '已标记打印',
      icon: 'success'
    })
  },

  onShareAppMessage() {
    return {
      title: `${this.data.detail.customer.name} ${this.data.detail.no}`,
      path: `/pages/order-detail/index?id=${this.data.detail.id}`
    }
  }
})
