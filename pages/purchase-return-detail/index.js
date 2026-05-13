const returnApi = require('../../api/return-api')

const emptyOrder = {
  id: '',
  no: '',
  customerName: '',
  customerPhone: '',
  customerAddress: '',
  salesOrderId: '',
  salesOrderNo: '',
  sourceText: '',
  date: '',
  warehouseName: '',
  refundText: '¥0.00',
  itemAmountText: '¥0.00',
  returnToPrepay: false,
  refundDirectionText: '',
  remark: '',
  items: [],
  itemCount: 0,
  statusText: '',
  statusTone: 'muted'
}

Page({
  data: {
    order: emptyOrder
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
      const order = await returnApi.getReturnOrder(this.orderId)
      this.setData({ order })
    } catch (error) {
      wx.showToast({ title: error.message || '退货单加载失败', icon: 'none' })
    }
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

  onSalesOrderTap() {
    if (!this.data.order.salesOrderId) return
    wx.navigateTo({
      url: `/pages/order-detail/index?id=${encodeURIComponent(this.data.order.salesOrderId)}`
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
