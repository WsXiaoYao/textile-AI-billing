const supplierStore = require('../../services/supplier-store')

Page({
  data: {
    supplier: supplierStore.getSupplier()
  },

  onLoad(options = {}) {
    this.supplierId = decodeURIComponent(options.id || '')
    this.loadDetail()
  },

  onShow() {
    this.loadDetail()
  },

  loadDetail() {
    this.setData({
      supplier: supplierStore.getSupplier(this.supplierId)
    })
  },

  onCallTap() {
    const phone = this.data.supplier.phone
    if (!phone) return
    wx.makePhoneCall({ phoneNumber: phone })
  },

  onEditTap() {
    wx.navigateTo({
      url: `/pages/supplier-edit/index?id=${encodeURIComponent(this.data.supplier.id)}`
    })
  },

  onBackTap() {
    if (getCurrentPages().length > 1) {
      wx.navigateBack()
      return
    }
    wx.navigateTo({ url: '/pages/suppliers/index' })
  },

  onViewPurchaseTap() {
    wx.navigateTo({
      url: `/pages/purchase-orders/index?supplierId=${encodeURIComponent(this.data.supplier.id)}`
    })
  }
})
