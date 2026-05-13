const warehouseApi = require('../../api/warehouse-api')

Page({
  data: {
    keyword: '',
    warehouses: [],
    displayedWarehouses: [],
    summary: {
      warehouseCount: 0,
      enabledCount: 0,
      defaultName: '未设置'
    },
    scrollTop: 0,
    showBackTop: false
  },

  onLoad() {
    this.loadWarehouses()
  },

  onShow() {
    this.loadWarehouses()
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

  async loadWarehouses() {
    try {
      const [warehouses, summary] = await Promise.all([
        warehouseApi.listWarehouses({ keyword: this.data.keyword }),
        warehouseApi.getWarehouseSummary()
      ])
      this.warehouses = warehouses || []
      this.setData({
        warehouses: this.warehouses,
        summary: summary || this.data.summary
      }, () => {
        this.applyFilters()
      })
    } catch (error) {
      wx.showToast({ title: error.message || '仓库加载失败', icon: 'none' })
    }
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
