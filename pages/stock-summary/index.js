const inventoryApi = require('../../api/inventory-api')

const sortOptions = [
  { label: '库存预警优先', value: 'lowFirst' },
  { label: '库存 从少到多', value: 'stockAsc' },
  { label: '库存 从多到少', value: 'stockDesc' },
  { label: '库存金额 从高到低', value: 'valueDesc' },
  { label: '产品名称 A-Z', value: 'nameAsc' }
]

const statusTabs = [
  { label: '全部', value: 'all' },
  { label: '低库存', value: 'low' },
  { label: '无库存', value: 'empty' },
  { label: '有库存', value: 'positive' }
]

const initialLimit = 18
const pageSize = 16

const emptyFilters = {
  warehouseName: '全部',
  statusKey: 'low',
  showLower: true,
  showCost: true,
  showSale: true
}

function cloneFilters(filters) {
  return {
    warehouseName: filters.warehouseName || '全部',
    statusKey: filters.statusKey || 'all',
    showLower: filters.showLower !== false,
    showCost: Boolean(filters.showCost),
    showSale: Boolean(filters.showSale)
  }
}

function getStatusLabel(value) {
  const map = {
    all: '全部库存',
    low: '低库存',
    empty: '无库存',
    positive: '有库存',
    normal: '正常库存'
  }
  return map[value] || '全部库存'
}

function getActiveStatus(value) {
  return statusTabs.some(item => item.value === value) ? value : 'all'
}

Page({
  data: {
    keyword: '',
    items: [],
    displayedItems: [],
    itemTotal: 0,
    renderCount: 0,
    hasMore: false,
    loadingMore: false,
    summary: {
      itemCount: 0,
      totalStockText: '0',
      totalValueText: '¥0.00',
      lowCount: 0,
      emptyCount: 0,
      stockedCount: 0
    },
    warehouseOptions: ['全部'],
    warehouseIndex: 0,
    sortOptions,
    sortIndex: 0,
    sortValue: 'lowFirst',
    sortLabel: '排序',
    statusTabs,
    activeStatus: getActiveStatus(emptyFilters.statusKey),
    warehouseLabel: '全部',
    filters: cloneFilters(emptyFilters),
    filterDraft: cloneFilters(emptyFilters),
    scrollTop: 0,
    showBackTop: false
  },

  onLoad() {
    this.loadInventory()
  },

  onShow() {
    this.loadInventory()
  },

  onPullDownRefresh() {
    this.loadInventory(() => {
      wx.stopPullDownRefresh()
    })
  },

  onReachBottom() {
    this.loadMoreItems()
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

  async loadInventory(callback) {
    try {
      const warehouseOptions = await inventoryApi.getWarehouseOptions()
      const safeOptions = Array.isArray(warehouseOptions) && warehouseOptions.length ? warehouseOptions : ['全部']
      const filters = cloneFilters(this.data.filters)
      if (!safeOptions.includes(filters.warehouseName)) filters.warehouseName = '全部'
      this.setData({
        warehouseOptions: safeOptions,
        warehouseIndex: Math.max(0, safeOptions.indexOf(filters.warehouseName)),
        filters,
        filterDraft: cloneFilters(filters),
        activeStatus: getActiveStatus(filters.statusKey),
        warehouseLabel: filters.warehouseName
      }, () => {
        this.applyFilters(callback)
      })
    } catch (error) {
      wx.showToast({ title: error.message || '库存加载失败', icon: 'none' })
      if (typeof callback === 'function') callback()
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

  onStatusChange(event) {
    const statusKey = event.detail.value || 'all'
    const filters = {
      ...this.data.filters,
      statusKey
    }
    this.setData({
      filters,
      activeStatus: getActiveStatus(statusKey),
      filterDraft: cloneFilters(filters)
    }, () => {
      this.applyFilters()
    })
  },

  onWarehouseTap() {
    wx.showActionSheet({
      itemList: this.data.warehouseOptions,
      success: res => {
        const warehouseIndex = Number(res.tapIndex || 0)
        const warehouseName = this.data.warehouseOptions[warehouseIndex] || '全部'
        const filters = {
          ...this.data.filters,
          warehouseName
        }
        this.setData({
          warehouseIndex,
          warehouseLabel: warehouseName,
          filters,
          filterDraft: cloneFilters(filters)
        }, () => {
          this.applyFilters()
        })
      }
    })
  },

  onSortChange(event) {
    const sortIndex = Number(event.detail.index)
    const selected = sortOptions[sortIndex]
    if (!selected) return
    this.setData({
      sortIndex,
      sortValue: selected.value,
      sortLabel: '排序'
    }, () => {
      this.applyFilters()
    })
  },

  onOpenAdjust(event) {
    wx.navigateTo({
      url: `/pages/stock-adjust/index?id=${encodeURIComponent(event.currentTarget.dataset.id)}`
    })
  },

  onScrollToLower() {
    this.loadMoreItems()
  },

  async applyFilters(callback) {
    const requestSeq = (this.inventoryRequestSeq || 0) + 1
    this.inventoryRequestSeq = requestSeq
    const filters = {
      ...this.data.filters,
      keyword: this.data.keyword,
      sortKey: this.data.sortValue
    }
    const overviewFilters = {
      keyword: this.data.keyword,
      warehouseName: this.data.filters.warehouseName,
      statusKey: 'all',
      sortKey: 'lowFirst'
    }
    try {
      const [result, summary] = await Promise.all([
        inventoryApi.queryInventory(filters),
        inventoryApi.getInventorySummary(overviewFilters)
      ])
      if (requestSeq !== this.inventoryRequestSeq) return
      const items = Array.isArray(result) ? result : (result && result.list) || []
      this.filteredItems = items
      this.setData({
        summary: summary || this.data.summary
      }, () => {
        this.resetWindow(callback)
      })
    } catch (error) {
      wx.showToast({ title: error.message || '库存加载失败', icon: 'none' })
      if (typeof callback === 'function') callback()
    }
  },

  resetWindow(callback) {
    const items = this.filteredItems || []
    const nextCount = Math.min(initialLimit, items.length)
    this.setData({
      displayedItems: items.slice(0, nextCount),
      itemTotal: items.length,
      renderCount: nextCount,
      hasMore: nextCount < items.length,
      loadingMore: false
    }, callback)
  },

  loadMoreItems() {
    if (this.data.loadingMore || !this.data.hasMore) return
    const items = this.filteredItems || []
    const currentCount = this.data.renderCount
    const nextCount = Math.min(currentCount + pageSize, items.length)
    this.setData({ loadingMore: true }, () => {
      this.setData({
        displayedItems: this.data.displayedItems.concat(items.slice(currentCount, nextCount)),
        renderCount: nextCount,
        hasMore: nextCount < items.length,
        loadingMore: false
      })
    })
  },

  noop() {}
})
