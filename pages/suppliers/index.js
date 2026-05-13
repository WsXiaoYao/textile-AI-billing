const supplierApi = require('../../api/supplier-api')

const statusTabs = [
  { label: '全部', value: 'all' },
  { label: '最近采购', value: 'recent' },
  { label: '常用供应商', value: 'common' }
]

Page({
  data: {
    keyword: '',
    activeStatus: 'all',
    statusTabs,
    suppliers: [],
    displayedSuppliers: [],
    scrollTop: 0,
    showBackTop: false
  },

  onLoad() {
    this.loadSuppliers()
  },

  onShow() {
    this.loadSuppliers()
  },

  onPullDownRefresh() {
    this.loadSuppliers(() => {
      wx.stopPullDownRefresh()
    })
  },

  onListScroll(event) {
    const showBackTop = Number(event.detail.scrollTop || 0) > 700
    if (showBackTop !== this.data.showBackTop) this.setData({ showBackTop })
  },

  onBackTopTap() {
    this.setData({
      scrollTop: this.data.scrollTop === 0 ? 1 : 0,
      showBackTop: false
    })
  },

  async loadSuppliers(callback) {
    try {
      const result = await supplierApi.listSuppliers()
      this.suppliers = result.list || []
      this.applyFilters(callback)
    } catch (error) {
      wx.showToast({ title: error.message || '供应商加载失败', icon: 'none' })
      this.suppliers = []
      this.applyFilters(callback)
    }
  },

  onKeywordInput(event) {
    this.setData({ keyword: event.detail.value }, () => {
      this.applyFilters()
    })
  },

  onKeywordConfirm() {
    this.applyFilters()
  },

  onStatusTap(event) {
    this.setData({ activeStatus: event.currentTarget.dataset.value || 'all' }, () => {
      this.applyFilters()
    })
  },

  onOpenSupplier(event) {
    wx.navigateTo({
      url: `/pages/supplier-detail/index?id=${encodeURIComponent(event.currentTarget.dataset.id)}`
    })
  },

  onAddSupplierTap() {
    wx.navigateTo({ url: '/pages/supplier-edit/index' })
  },

  onBackTap() {
    if (getCurrentPages().length > 1) {
      wx.navigateBack()
      return
    }
    wx.switchTab({ url: '/pages/more/index' })
  },

  applyFilters(callback) {
    const keyword = this.data.keyword.trim().toLowerCase()
    const activeStatus = this.data.activeStatus
    const displayedSuppliers = (this.suppliers || []).filter(supplier => {
      if (keyword && !supplier.searchText.includes(keyword)) return false
      if (activeStatus === 'recent') return supplier.purchaseCount > 0
      if (activeStatus === 'common') return supplier.isCommon
      return true
    })

    this.setData({ displayedSuppliers }, callback)
  }
})
