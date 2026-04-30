const warehouseStore = require('../../services/warehouse-store')

Page({
  data: {
    keyword: '',
    warehouses: [],
    displayedWarehouses: [],
    summary: warehouseStore.getWarehouseSummary()
  },

  onLoad() {
    this.loadWarehouses()
  },

  onShow() {
    this.loadWarehouses()
  },

  loadWarehouses() {
    const warehouses = warehouseStore.getWarehouseList()
    this.warehouses = warehouses
    this.setData({
      warehouses,
      summary: warehouseStore.getWarehouseSummary()
    }, () => {
      this.applyFilters()
    })
  },

  onKeywordInput(event) {
    this.setData({ keyword: event.detail.value }, () => {
      this.applyFilters()
    })
  },

  onEditWarehouseTap(event) {
    wx.navigateTo({
      url: `/pages/warehouse-edit/index?id=${encodeURIComponent(event.currentTarget.dataset.id)}`
    })
  },

  onAddWarehouseTap() {
    wx.navigateTo({ url: '/pages/warehouse-edit/index' })
  },

  onBackTap() {
    if (getCurrentPages().length > 1) {
      wx.navigateBack()
      return
    }
    wx.switchTab({ url: '/pages/more/index' })
  },

  applyFilters() {
    const keyword = this.data.keyword.trim().toLowerCase()
    const displayedWarehouses = (this.warehouses || []).filter(warehouse => {
      const text = [
        warehouse.name,
        warehouse.keeper,
        warehouse.address,
        warehouse.statusText,
        warehouse.defaultText
      ].join(' ').toLowerCase()
      return !keyword || text.includes(keyword)
    })
    this.setData({ displayedWarehouses })
  }
})
