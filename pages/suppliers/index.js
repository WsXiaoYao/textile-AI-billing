const supplierStore = require('../../services/supplier-store')

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
    displayedSuppliers: []
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

  loadSuppliers(callback) {
    this.suppliers = supplierStore.getSupplierList()
    this.applyFilters(callback)
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
