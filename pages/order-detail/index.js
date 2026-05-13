const orderApi = require('../../api/order-api')

function emptyDetail() {
  return {
    id: '',
    no: '',
    statusText: '',
    statusTone: 'muted',
    canReceive: false,
    printActionText: '打印',
    successTitle: '销售单已生成',
    successDesc: '',
    customer: {
      name: '',
      phone: '',
      address: '',
      date: '',
      warehouse: '',
      printStatus: ''
    },
    amounts: [],
    amountNote: '',
    receipt: {
      desc: '',
      no: '',
      emptyText: '',
      emptyHint: '',
      remaining: '',
      tone: 'muted'
    },
    returnInfo: {
      count: 0,
      totalText: '¥0.00',
      desc: '',
      list: []
    },
    products: [],
    printDesc: ''
  }
}

Page({
  data: {
    detail: emptyDetail(),
    showCreatedNotice: false
  },

  onLoad(options = {}) {
    this.orderId = options.id || ''
    this.setData({
      showCreatedNotice: options.created === '1' || options.from === 'cart' || options.from === 'checkout'
    })
    this.loadDetail()
  },

  onShow() {
    this.loadDetail()
  },

  async loadDetail() {
    if (!this.orderId) return
    try {
      const detail = await orderApi.getOrderDetail(this.orderId)
      this.setData({ detail })
    } catch (error) {
      wx.showToast({
        title: error.message || '订单详情加载失败',
        icon: 'none'
      })
    }
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

  onReturnTap() {
    if (!this.data.detail.id) return
    wx.navigateTo({
      url: `/pages/purchase-return-edit/index?salesOrderId=${encodeURIComponent(this.data.detail.id)}`
    })
  },

  onOpenReturnOrder(event) {
    const id = event.currentTarget.dataset.id
    if (!id) return
    wx.navigateTo({
      url: `/pages/purchase-return-detail/index?id=${encodeURIComponent(id)}`
    })
  },

  async onPrintTap() {
    try {
      const detail = await orderApi.markPrinted(this.data.detail.id)
      this.setData({ detail })
      wx.showToast({
        title: '已标记打印',
        icon: 'success'
      })
    } catch (error) {
      wx.showToast({
        title: error.message || '打印状态更新失败',
        icon: 'none'
      })
    }
  },

  onShareAppMessage() {
    return {
      title: `${this.data.detail.customer.name} ${this.data.detail.no}`,
      path: `/pages/order-detail/index?id=${this.data.detail.id}`
    }
  }
})
