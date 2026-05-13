const purchaseApi = require('../../api/purchase-api')

Page({
  data: {
    order: {
      id: '',
      no: '',
      supplierName: '',
      date: '',
      warehouseName: '',
      remark: '',
      items: [],
      itemCount: 0,
      orderAmountText: '¥0',
      discountText: '¥0',
      contractAmountText: '¥0',
      creator: ''
    }
  },

  onLoad(options = {}) {
    this.orderId = decodeURIComponent(options.id || '')
    this.loadDetail()
  },

  onShow() {
    this.loadDetail()
  },

  async loadDetail() {
    if (!this.orderId) return
    try {
      const order = await purchaseApi.getPurchaseOrder(this.orderId)
      this.setData({ order })
    } catch (error) {
      wx.showToast({ title: error.message || '采购单加载失败', icon: 'none' })
    }
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
