const purchaseApi = require('../../api/purchase-api')

const dateOptions = [
  { label: '全部日期', value: 'all' },
  { label: '今天', value: 'today' },
  { label: '本周', value: 'week' },
  { label: '本月', value: 'month' }
]

const sortOptions = [
  { label: '采购日期 从新到旧', value: 'dateDesc' },
  { label: '采购日期 从旧到新', value: 'dateAsc' },
  { label: '金额 从高到低', value: 'amountDesc' },
  { label: '供应商 A-Z', value: 'supplierAsc' }
]

const emptyFilters = {
  supplierId: '',
  warehouseId: ''
}

const filterDrawerAnimationMs = 240

function cloneFilters(filters) {
  return {
    supplierId: filters.supplierId || '',
    warehouseId: filters.warehouseId || ''
  }
}

function buildFilterSections(filters, supplierOptions = [], warehouseOptions = []) {
  const suppliers = (supplierOptions || [])
    .filter(item => item.id)
    .map(item => ({
      label: item.name,
      value: item.id,
      active: filters.supplierId === item.id
    }))
  const warehouses = (warehouseOptions || [])
    .filter(item => item.id)
    .map(item => ({
      label: item.name,
      value: item.id,
      active: filters.warehouseId === item.id
    }))

  return [
    {
      key: 'supplierId',
      title: '供应商',
      options: suppliers.length ? suppliers : [{ label: '暂无供应商', value: '__empty__', disabled: true }]
    },
    {
      key: 'warehouseId',
      title: '仓库',
      options: warehouses.length ? warehouses : [{ label: '暂无仓库', value: '__empty__', disabled: true }]
    }
  ]
}

function getDateTime(dateText) {
  const parts = String(dateText || '').split('-').map(Number)
  if (parts.length !== 3) return 0
  return new Date(parts[0], parts[1] - 1, parts[2]).getTime()
}

function getReferenceDate(orders) {
  return (orders || []).reduce((latest, order) => {
    if (!latest || order.date > latest) return order.date
    return latest
  }, '')
}

function inDateRange(orderDate, dateValue, referenceDate) {
  if (!dateValue || dateValue === 'all' || !referenceDate) return true
  if (dateValue === 'today') return orderDate === referenceDate

  const orderTime = getDateTime(orderDate)
  const referenceTime = getDateTime(referenceDate)
  if (!orderTime || !referenceTime) return true

  if (dateValue === 'week') {
    const weekStart = referenceTime - 6 * 24 * 60 * 60 * 1000
    return orderTime >= weekStart && orderTime <= referenceTime
  }

  if (dateValue === 'month') {
    return orderDate.slice(0, 7) === referenceDate.slice(0, 7)
  }

  return true
}

Page({
  data: {
    keyword: '',
    dateValue: 'all',
    dateLabel: '全部日期',
    sortOptions,
    sortIndex: 0,
    sortLabel: '排序',
    filterCount: 0,
    supplierOptions: [{ id: '', name: '供应商筛选' }],
    warehouseOptions: [{ id: '', name: '按仓库' }],
    filters: cloneFilters(emptyFilters),
    filterDraft: cloneFilters(emptyFilters),
    filterViewSections: buildFilterSections(emptyFilters),
    filterDraftCount: 0,
    filterDrawerVisible: false,
    filterDrawerActive: false,
    orders: [],
    displayedOrders: [],
    scrollTop: 0,
    showBackTop: false
  },

  onLoad(options = {}) {
    this.initialSupplierId = decodeURIComponent(options.supplierId || '')
    this.loadOrders()
  },

  onShow() {
    this.loadOrders()
  },

  onPullDownRefresh() {
    this.loadOrders(() => {
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

  onUnload() {
    this.clearFilterDrawerTimer()
  },

  async loadOrders(callback) {
    try {
      const [supplierOptions, warehouseOptions, orderResult] = await Promise.all([
        purchaseApi.getSupplierOptions(),
        purchaseApi.getWarehouseOptions(),
        purchaseApi.listPurchaseOrders()
      ])
      const suppliers = [{ id: '', name: '供应商筛选' }].concat(supplierOptions || [])
      const warehouses = [{ id: '', name: '按仓库' }].concat(warehouseOptions || [])
      this.orders = orderResult.list || []
      const filters = this.initialSupplierId
        ? { ...this.data.filters, supplierId: this.initialSupplierId }
        : this.data.filters
      const nextInitialState = this.initialSupplierId
        ? {
            filters,
          filterDraft: cloneFilters(filters),
          filterCount: this.countFilters(filters),
          dateValue: 'all',
          dateLabel: '全部日期'
          }
        : {}
      this.setData({
        supplierOptions: suppliers,
        warehouseOptions: warehouses,
        filterViewSections: buildFilterSections(this.data.filterDraft, suppliers, warehouses),
        ...nextInitialState
      }, () => {
        this.applyFilters(callback)
      })
      this.initialSupplierId = ''
    } catch (error) {
      wx.showToast({ title: error.message || '采购单加载失败', icon: 'none' })
      this.orders = []
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

  onDateTap() {
    wx.showActionSheet({
      itemList: dateOptions.map(item => item.label),
      success: res => {
        const option = dateOptions[res.tapIndex] || dateOptions[0]
        this.setData({
          dateValue: option.value,
          dateLabel: option.label
        }, () => {
          this.applyFilters()
        })
      }
    })
  },

  onSortChange(event) {
    const sortIndex = Number(event.detail.index || 0)
    const sortOption = sortOptions[sortIndex] || sortOptions[0]
    this.setData({
      sortIndex,
      sortLabel: sortOption.label.split(' ')[0] || '排序'
    }, () => {
      this.applyFilters()
    })
  },

  onFilterTap() {
    this.clearFilterDrawerTimer()
    const filterDraft = cloneFilters(this.data.filters)
    this.setData({
      filterDraft,
      filterViewSections: buildFilterSections(filterDraft, this.data.supplierOptions, this.data.warehouseOptions),
      filterDraftCount: this.countFilters(filterDraft),
      filterDrawerVisible: true,
      filterDrawerActive: false
    }, () => {
      wx.nextTick(() => {
        if (this.data.filterDrawerVisible) {
          this.setData({ filterDrawerActive: true })
        }
      })
    })
  },

  onFilterOptionTap(event) {
    const { key, value } = event.currentTarget.dataset
    if (value === '__empty__') return
    const filterDraft = cloneFilters(this.data.filterDraft)
    filterDraft[key] = filterDraft[key] === value ? '' : value
    this.setData({
      filterDraft,
      filterViewSections: buildFilterSections(filterDraft, this.data.supplierOptions, this.data.warehouseOptions),
      filterDraftCount: this.countFilters(filterDraft)
    })
  },

  onResetFilters() {
    const filterDraft = cloneFilters(emptyFilters)
    this.setData({
      filterDraft,
      filterViewSections: buildFilterSections(filterDraft, this.data.supplierOptions, this.data.warehouseOptions),
      filterDraftCount: 0
    })
  },

  onApplyFilters() {
    const filters = cloneFilters(this.data.filterDraft)
    this.setData({
      filters,
      filterCount: this.countFilters(filters)
    }, () => {
      this.applyFilters()
      this.closeFilterDrawer()
    })
  },

  onCancelFilter() {
    this.closeFilterDrawer()
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
  },

  noop() {},

  countFilters(filters) {
    return Object.keys(filters || {}).filter(key => Boolean(filters[key])).length
  },

  openSupplierFilter() {
    wx.showActionSheet({
      itemList: this.data.supplierOptions.map(item => item.name),
      success: res => {
        const supplier = this.data.supplierOptions[Number(res.tapIndex || 0)] || {}
        const filters = {
          ...this.data.filters,
          supplierId: supplier.id || ''
        }
        this.setData({
          filters,
          filterCount: this.countFilters(filters)
        }, () => {
          this.applyFilters()
        })
      }
    })
  },

  openWarehouseFilter() {
    wx.showActionSheet({
      itemList: this.data.warehouseOptions.map(item => item.name),
      success: res => {
        const warehouse = this.data.warehouseOptions[Number(res.tapIndex || 0)] || {}
        const filters = {
          ...this.data.filters,
          warehouseId: warehouse.id || ''
        }
        this.setData({
          filters,
          filterCount: this.countFilters(filters)
        }, () => {
          this.applyFilters()
        })
      }
    })
  },

  onOpenOrder(event) {
    wx.navigateTo({
      url: `/pages/purchase-order-detail/index?id=${encodeURIComponent(event.currentTarget.dataset.id)}`
    })
  },

  onAddTap() {
    wx.navigateTo({ url: '/pages/purchase-order-edit/index' })
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
    const filters = this.data.filters || emptyFilters
    const referenceDate = getReferenceDate(this.orders || [])
    const sortOption = sortOptions[this.data.sortIndex] || sortOptions[0]
    const displayedOrders = (this.orders || []).filter(order => {
      if (keyword && !order.searchText.includes(keyword)) return false
      if (filters.supplierId && order.supplierId !== filters.supplierId) return false
      if (filters.warehouseId && order.warehouseId !== filters.warehouseId) return false
      if (!inDateRange(order.date, this.data.dateValue, referenceDate)) return false
      return true
    })

    displayedOrders.sort((a, b) => {
      if (sortOption.value === 'dateAsc') return a.date.localeCompare(b.date)
      if (sortOption.value === 'amountDesc') return b.orderAmountCents - a.orderAmountCents
      if (sortOption.value === 'supplierAsc') return a.supplierName.localeCompare(b.supplierName, 'zh-Hans-CN')
      return b.date.localeCompare(a.date)
    })

    this.setData({
      displayedOrders,
      filterCount: this.countFilters(filters)
    }, callback)
  }
})
