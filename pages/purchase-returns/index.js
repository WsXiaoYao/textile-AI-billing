const returnStore = require('../../services/return-store')

const statusTabs = [
  { label: '全部', value: 'all' },
  { label: '未退款', value: 'pending' },
  { label: '部分退款', value: 'partial' },
  { label: '计入预收', value: 'prepay' }
]

const dateOptions = [
  { label: '全部日期', value: 'all' },
  { label: '今天', value: 'today' },
  { label: '本周', value: 'week' },
  { label: '本月', value: 'month' }
]

const sortOptions = [
  { label: '退货日期 从新到旧', value: 'dateDesc' },
  { label: '退货日期 从旧到新', value: 'dateAsc' },
  { label: '金额 从高到低', value: 'amountDesc' },
  { label: '客户名称 A-Z', value: 'customerAsc' }
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
    customerOptions: [{ id: '', name: '客户筛选' }],
    customerIndex: 0,
    warehouseOptions: [{ id: '', name: '按仓库' }],
    warehouseIndex: 0,
    summary: returnStore.getReturnSummary([]),
    returns: [],
    displayedReturns: []
  },

  onLoad() {
    this.loadReturns()
  },

  onShow() {
    this.loadReturns()
  },

  onPullDownRefresh() {
    this.loadReturns(() => {
      wx.stopPullDownRefresh()
    })
  },

  loadReturns(callback) {
    this.returns = returnStore.getReturnOrderList()
    this.setData({
      customerOptions: [{ id: '', name: '客户筛选' }].concat(returnStore.getCustomerOptions()),
      warehouseOptions: [{ id: '', name: '按仓库' }].concat(returnStore.getWarehouseOptions())
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
      itemList: ['客户筛选', '仓库筛选', '清空筛选'],
      success: res => {
        if (res.tapIndex === 0) {
          this.openCustomerFilter()
          return
        }
        if (res.tapIndex === 1) {
          this.openWarehouseFilter()
          return
        }
        this.setData({
          customerIndex: 0,
          warehouseIndex: 0
        }, () => {
          this.applyFilters()
        })
      }
    })
  },

  openCustomerFilter() {
    wx.showActionSheet({
      itemList: this.data.customerOptions.map(item => item.name),
      success: res => {
        this.setData({ customerIndex: Number(res.tapIndex || 0) }, () => {
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

  onOpenReturn(event) {
    wx.navigateTo({
      url: `/pages/purchase-return-detail/index?id=${encodeURIComponent(event.currentTarget.dataset.id)}`
    })
  },

  onAddTap() {
    wx.navigateTo({ url: '/pages/purchase-return-edit/index' })
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
    const customer = this.data.customerOptions[this.data.customerIndex] || {}
    const warehouse = this.data.warehouseOptions[this.data.warehouseIndex] || {}
    const activeStatus = this.data.activeStatus
    const referenceDate = getReferenceDate(this.returns || [])
    const sortOption = sortOptions[this.data.sortIndex] || sortOptions[0]
    const displayedReturns = (this.returns || []).filter(order => {
      if (keyword && !order.searchText.includes(keyword)) return false
      if (activeStatus !== 'all' && order.statusKey !== activeStatus) return false
      if (customer.id && order.customerId !== customer.id && order.customerName !== customer.name) return false
      if (warehouse.id && order.warehouseName !== warehouse.name) return false
      if (!inDateRange(order.date, this.data.dateValue, referenceDate)) return false
      return true
    })

    displayedReturns.sort((a, b) => {
      if (sortOption.value === 'dateAsc') return a.date.localeCompare(b.date)
      if (sortOption.value === 'amountDesc') return b.refundCents - a.refundCents
      if (sortOption.value === 'customerAsc') return a.customerName.localeCompare(b.customerName, 'zh-Hans-CN')
      return b.date.localeCompare(a.date)
    })

    this.setData({
      displayedReturns,
      summary: returnStore.getReturnSummary(displayedReturns),
      filterCount: (customer.id ? 1 : 0) + (warehouse.id ? 1 : 0)
    }, callback)
  }
})
