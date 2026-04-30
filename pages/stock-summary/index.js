const inventoryStore = require('../../services/inventory-store')

const sortOptions = [
  { label: '库存预警优先', value: 'lowFirst' },
  { label: '库存 从少到多', value: 'stockAsc' },
  { label: '库存 从多到少', value: 'stockDesc' },
  { label: '库存金额 从高到低', value: 'valueDesc' },
  { label: '产品名称 A-Z', value: 'nameAsc' }
]

const initialLimit = 18
const pageSize = 16
const filterDrawerAnimationMs = 240

const emptyFilters = {
  warehouseName: '全部',
  statusKey: 'low',
  showLower: true,
  showCost: false,
  showSale: false
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

function buildFilterTags(filters) {
  const tags = []
  tags.push(filters.warehouseName && filters.warehouseName !== '全部' ? filters.warehouseName : '全部仓')
  tags.push(getStatusLabel(filters.statusKey))
  if (filters.showCost) tags.push('显示成本')
  if (filters.showSale) tags.push('显示售价')
  if (filters.showLower) tags.push('库存下限')
  return tags
}

function buildFilterSections(filters, warehouseOptions) {
  return [
    {
      key: 'statusKey',
      title: '库存状态',
      options: [
        { label: '全部', value: 'all' },
        { label: '低库存', value: 'low' },
        { label: '无库存', value: 'empty' },
        { label: '有库存', value: 'positive' }
      ]
    },
    {
      key: 'warehouseName',
      title: '仓库',
      options: warehouseOptions.map(value => ({ label: value, value }))
    },
    {
      key: 'displayField',
      title: '展示字段',
      options: [
        { label: '库存下限', value: 'showLower' },
        { label: '成本均价', value: 'showCost' },
        { label: '参考售价', value: 'showSale' }
      ]
    }
  ].map(section => ({
    ...section,
    options: section.options.map(option => {
      let active = false
      if (section.key === 'displayField') active = Boolean(filters[option.value])
      if (section.key === 'warehouseName') active = filters.warehouseName === option.value
      if (section.key === 'statusKey') active = filters.statusKey === option.value
      return { ...option, active }
    })
  }))
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
    summary: inventoryStore.getInventorySummary(emptyFilters),
    warehouseOptions: ['全部'],
    warehouseIndex: 0,
    sortOptions,
    sortIndex: 0,
    sortValue: 'lowFirst',
    filters: cloneFilters(emptyFilters),
    filterDraft: cloneFilters(emptyFilters),
    filterTags: buildFilterTags(emptyFilters),
    filterCount: 1,
    filterDraftCount: 1,
    filterViewSections: [],
    filterDrawerVisible: false,
    filterDrawerActive: false
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

  onUnload() {
    this.clearFilterDrawerTimer()
  },

  loadInventory(callback) {
    const warehouseOptions = inventoryStore.getWarehouseOptions()
    const filters = cloneFilters(this.data.filters)
    if (!warehouseOptions.includes(filters.warehouseName)) filters.warehouseName = '全部'
    this.setData({
      warehouseOptions,
      warehouseIndex: Math.max(0, warehouseOptions.indexOf(filters.warehouseName)),
      filters,
      filterTags: buildFilterTags(filters),
      filterCount: this.countFilters(filters)
    }, () => {
      this.applyFilters(callback)
    })
  },

  onKeywordInput(event) {
    this.setData({ keyword: event.detail.value }, () => {
      this.applyFilters()
    })
  },

  onKeywordConfirm() {
    this.applyFilters()
  },

  onWarehouseChange(event) {
    const warehouseIndex = Number(event.detail.value)
    const warehouseName = this.data.warehouseOptions[warehouseIndex] || '全部'
    const filters = {
      ...this.data.filters,
      warehouseName
    }
    this.setData({
      warehouseIndex,
      filters,
      filterTags: buildFilterTags(filters),
      filterCount: this.countFilters(filters)
    }, () => {
      this.applyFilters()
    })
  },

  onLowStockTap() {
    const filters = {
      ...this.data.filters,
      statusKey: this.data.filters.statusKey === 'low' ? 'all' : 'low'
    }
    this.setData({
      filters,
      filterTags: buildFilterTags(filters),
      filterCount: this.countFilters(filters)
    }, () => {
      this.applyFilters()
    })
  },

  onSortChange(event) {
    const sortIndex = Number(event.detail.value)
    const selected = sortOptions[sortIndex]
    if (!selected) return
    this.setData({
      sortIndex,
      sortValue: selected.value
    }, () => {
      this.applyFilters()
    })
  },

  onFilterTap() {
    this.clearFilterDrawerTimer()
    const filterDraft = cloneFilters(this.data.filters)
    this.setData({
      filterDraft,
      filterViewSections: buildFilterSections(filterDraft, this.data.warehouseOptions),
      filterDraftCount: this.countFilters(filterDraft),
      filterDrawerVisible: true,
      filterDrawerActive: false
    }, () => {
      wx.nextTick(() => {
        if (this.data.filterDrawerVisible) this.setData({ filterDrawerActive: true })
      })
    })
  },

  onFilterOptionTap(event) {
    const { key, value } = event.currentTarget.dataset
    const filterDraft = cloneFilters(this.data.filterDraft)
    if (key === 'displayField') {
      filterDraft[value] = !filterDraft[value]
    } else if (key === 'warehouseName') {
      filterDraft.warehouseName = filterDraft.warehouseName === value ? '全部' : value
    } else if (key === 'statusKey') {
      filterDraft.statusKey = filterDraft.statusKey === value ? 'all' : value
    }
    this.setData({
      filterDraft,
      filterViewSections: buildFilterSections(filterDraft, this.data.warehouseOptions),
      filterDraftCount: this.countFilters(filterDraft)
    })
  },

  onResetFilters() {
    const filterDraft = cloneFilters({
      ...emptyFilters,
      statusKey: 'all'
    })
    this.setData({
      filterDraft,
      filterViewSections: buildFilterSections(filterDraft, this.data.warehouseOptions),
      filterDraftCount: this.countFilters(filterDraft)
    })
  },

  onApplyFilters() {
    const filters = cloneFilters(this.data.filterDraft)
    this.setData({
      filters,
      warehouseIndex: Math.max(0, this.data.warehouseOptions.indexOf(filters.warehouseName)),
      filterTags: buildFilterTags(filters),
      filterCount: this.countFilters(filters)
    }, () => {
      this.applyFilters()
      this.closeFilterDrawer()
    })
  },

  onCancelFilter() {
    this.closeFilterDrawer()
  },

  onOpenAdjust(event) {
    wx.navigateTo({
      url: `/pages/stock-adjust/index?id=${encodeURIComponent(event.currentTarget.dataset.id)}`
    })
  },

  onScrollToLower() {
    this.loadMoreItems()
  },

  noop() {},

  applyFilters(callback) {
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
    const items = inventoryStore.queryInventory(filters)
    this.filteredItems = items
    this.setData({
      summary: inventoryStore.getInventorySummary(overviewFilters)
    }, () => {
      this.resetWindow(callback)
    })
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

  countFilters(filters) {
    let count = 0
    if (filters.warehouseName && filters.warehouseName !== '全部') count += 1
    if (filters.statusKey && filters.statusKey !== 'all') count += 1
    if (filters.showCost) count += 1
    if (filters.showSale) count += 1
    return count
  },

  closeFilterDrawer() {
    if (!this.data.filterDrawerVisible) return
    this.clearFilterDrawerTimer()
    this.setData({ filterDrawerActive: false })
    this.filterDrawerTimer = setTimeout(() => {
      this.setData({ filterDrawerVisible: false })
      this.filterDrawerTimer = null
    }, filterDrawerAnimationMs)
  },

  clearFilterDrawerTimer() {
    if (!this.filterDrawerTimer) return
    clearTimeout(this.filterDrawerTimer)
    this.filterDrawerTimer = null
  }
})
