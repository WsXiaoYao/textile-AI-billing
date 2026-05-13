const supplierApi = require('../../api/supplier-api')

Page({
  data: {
    supplier: {
      id: '',
      name: '',
      phone: '',
      address: '',
      remark: '',
      purchaseRecords: [],
      purchaseCount: 0,
      totalPurchaseText: '¥0'
    }
  },

  onLoad(options = {}) {
    this.supplierId = decodeURIComponent(options.id || '')
    this.loadDetail()
  },

  onShow() {
    this.loadDetail()
  },

  async loadDetail() {
    if (!this.supplierId) return
    try {
      const supplier = await supplierApi.getSupplier(this.supplierId)
      this.setData({ supplier })
    } catch (error) {
      wx.showToast({ title: error.message || '供应商加载失败', icon: 'none' })
    }
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
