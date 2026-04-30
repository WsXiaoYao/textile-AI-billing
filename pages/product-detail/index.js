const productStore = require('../../services/product-store')

Page({
  data: {
    product: productStore.getProduct(),
    visibleVariants: [],
    hasMoreVariants: false
  },

  onLoad(options = {}) {
    this.productId = decodeURIComponent(options.id || '')
    this.loadProduct()
  },

  onShow() {
    this.loadProduct()
  },

  loadProduct() {
    const product = productStore.getProduct(this.productId)
    const visibleVariants = (product.variants || []).slice(0, 18)
    this.setData({
      product,
      visibleVariants,
      hasMoreVariants: (product.variants || []).length > visibleVariants.length
    })
  },

  onBackTap() {
    if (getCurrentPages().length > 1) {
      wx.navigateBack()
      return
    }
    wx.navigateTo({ url: '/pages/products/index' })
  },

  onEditTap() {
    wx.navigateTo({
      url: `/pages/product-edit/index?id=${encodeURIComponent(this.data.product.id)}`
    })
  },

  onShowMoreTap() {
    const product = this.data.product
    this.setData({
      visibleVariants: product.variants || [],
      hasMoreVariants: false
    })
  }
})
