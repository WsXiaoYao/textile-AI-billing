const purchaseStore = require('../../services/purchase-store')

const statusTabs = [
  { label: '全部', value: 'all' },
  { label: '草稿', value: 'draft' },
  { label: '已提交', value: 'submitted' }
]

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
    activeStatus: 'all',
    statusTabs,
    dateValue: 'week',
    dateLabel: '本周',
    sortOptions,
    sortIndex: 0,
    sortLabel: '排序',
    filterCount: 0,
    supplierOptions: [{ id: '', name: '供应商筛选' }],
    supplierIndex: 0,
    warehouseOptions: [{ id: '', name: '按仓库' }],
    warehouseIndex: 0,
    orders: [],
    displayedOrders: []
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

  loadOrders(callback) {
    const suppliers = [{ id: '', name: '供应商筛选' }].concat(purchaseStore.getSupplierOptions())
    const warehouses = [{ id: '', name: '按仓库' }].concat(purchaseStore.getWarehouseOptions())
    this.orders = purchaseStore.getPurchaseOrderList()
    const supplierIndex = this.initialSupplierId
      ? Math.max(0, suppliers.findIndex(supplier => supplier.id === this.initialSupplierId))
      : this.data.supplierIndex
    const nextDateState = this.initialSupplierId
      ? { dateValue: 'all', dateLabel: '全部日期' }
      : {}
    this.setData({
      supplierOptions: suppliers,
      supplierIndex,
      warehouseOptions: warehouses,
      ...nextDateState
    }, () => {
      this.applyFilters(callback)
    })
    this.initialSupplierId = ''
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
    this.setData({
      activeStatus: event.detail.value || 'all'
    }, () => {
      this.applyFilters()
    })
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
    wx.showActionSheet({
      itemList: ['供应商筛选', '仓库筛选', '清空筛选'],
      success: res => {
        if (res.tapIndex === 0) {
          this.openSupplierFilter()
          return
        }
        if (res.tapIndex === 1) {
          this.openWarehouseFilter()
          return
        }
        this.setData({
          supplierIndex: 0,
          warehouseIndex: 0
        }, () => {
          this.applyFilters()
        })
      }
    })
  },

  openSupplierFilter() {
    wx.showActionSheet({
      itemList: this.data.supplierOptions.map(item => item.name),
      success: res => {
        this.setData({ supplierIndex: Number(res.tapIndex || 0) }, () => {
          this.applyFilters()
        })
      }
    })
  },

  openWarehouseFilter() {
    wx.showActionSheet({
      itemList: this.data.warehouseOptions.map(item => item.name),
      success: res => {
        this.setData({ warehouseIndex: Number(res.tapIndex || 0) }, () => {
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
    const supplier = this.data.supplierOptions[this.data.supplierIndex] || {}
    const warehouse = this.data.warehouseOptions[this.data.warehouseIndex] || {}
    const activeStatus = this.data.activeStatus
    const referenceDate = getReferenceDate(this.orders || [])
    const sortOption = sortOptions[this.data.sortIndex] || sortOptions[0]
    const displayedOrders = (this.orders || []).filter(order => {
      if (keyword && !order.searchText.includes(keyword)) return false
      if (activeStatus !== 'all' && order.statusKey !== activeStatus) return false
      if (supplier.id && order.supplierId !== supplier.id) return false
      if (warehouse.id && order.warehouseName !== warehouse.name) return false
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
      filterCount: (supplier.id ? 1 : 0) + (warehouse.id ? 1 : 0)
    }, callback)
  }
})
