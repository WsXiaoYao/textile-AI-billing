const customerApi = require('../../api/customer-api')

Page({
  data: {
    detail: null
  },

  async onLoad(options = {}) {
    const id = decodeURIComponent(options.id || '')
    if (!id) return
    try {
      const detail = await customerApi.getFundDetail(id)
      this.setData({ detail })
    } catch (error) {
      wx.showToast({
        title: error.message || '流水详情加载失败',
        icon: 'none'
      })
      this.setData({ detail: null })
    }
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
