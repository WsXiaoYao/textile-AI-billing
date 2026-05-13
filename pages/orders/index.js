const orderApi = require('../../api/order-api')
const { guardTabAccess } = require('../../utils/tabbar')

const sortOptions = [
  { label: '销售日期 从新到旧', value: 'dateDesc' },
  { label: '销售日期 从旧到新', value: 'dateAsc' },
  { label: '未收金额 从高到低', value: 'receivableDesc' },
  { label: '客户名称 A-Z', value: 'customerAsc' }
]

const statusTabs = [
  { label: '全部', value: 'all' },
  { label: '未收款', value: 'unpaid' },
  { label: '部分收款', value: 'partial' },
  { label: '已收款', value: 'paid' },
  { label: '超收款', value: 'overpaid' }
]

const quickPaymentStateValues = statusTabs
  .filter(item => item.value !== 'all')
  .map(item => item.value)

const filterSections = [
  {
    key: 'paymentState',
    title: '收款状态',
    options: [
      { label: '未收款', value: 'unpaid' },
      { label: '部分收款', value: 'partial' },
      { label: '已收款', value: 'paid' },
      { label: '超收款', value: 'overpaid' },
      { label: '已退款', value: 'refunded' },
      { label: '计入预收', value: 'prepaid' }
    ]
  },
  {
    key: 'deliveryState',
    title: '送货状态',
    options: [
      { label: '未送货', value: 'unshipped' },
      { label: '部分送货', value: 'partial' },
      { label: '全部送货', value: 'delivered' },
      { label: '超送货', value: 'overdelivered' },
      { label: '拒收', value: 'refused' }
    ]
  },
  {
    key: 'printState',
    title: '打印状态',
    options: [
      { label: '未打印', value: 'unprinted' },
      { label: '已打印', value: 'printed' }
    ]
  },
  {
    key: 'creator',
    title: '制单人',
    options: [
      { label: '王姐', value: '王姐' },
      { label: '涛', value: '涛' },
      { label: '邓', value: '邓' },
      { label: '航', value: '航' },
      { label: '旺', value: '旺' }
    ]
  }
]

const datePresets = [
  { label: '自定义', value: 'custom' },
  { label: '当日', value: 'today' },
  { label: '昨天', value: 'yesterday' },
  { label: '当月', value: 'month' },
  { label: '上月', value: 'lastMonth' }
]

const emptyFilters = {
  paymentState: '',
  deliveryState: '',
  printState: '',
  creator: ''
}

const today = '2026-05-11'
const pickerStartDate = '2024-01-01'
const filterDrawerAnimationMs = 240
const orderPageSize = 12

const defaultDateRange = {
  preset: 'custom',
  start: '2025-02-17',
  end: today
}

function cloneFilters(filters) {
  return {
    paymentState: filters.paymentState || '',
    deliveryState: filters.deliveryState || '',
    printState: filters.printState || '',
    creator: filters.creator || ''
  }
}

function buildFilterSections(filters) {
  return filterSections.map(section => ({
    ...section,
    options: section.options.map(option => ({
      ...option,
      active: filters[section.key] === option.value
    }))
  }))
}

function getActiveStatusFromFilters(filters) {
  return quickPaymentStateValues.includes(filters.paymentState) ? filters.paymentState : 'all'
}

function formatDateLabel(dateRange) {
  if (dateRange.preset === 'today') return '今天'
  if (dateRange.preset === 'yesterday') return '昨天'
  if (dateRange.preset === 'month') return '本月'
  if (dateRange.preset === 'lastMonth') return '上月'
  return `${dateRange.start}~今天`
}

function getPresetRange(value) {
  const rangeMap = {
    custom: { preset: 'custom', start: '2025-02-17', end: today },
    today: { preset: 'today', start: today, end: today },
    yesterday: { preset: 'yesterday', start: '2026-05-10', end: '2026-05-10' },
    month: { preset: 'month', start: '2026-05-01', end: today },
    lastMonth: { preset: 'lastMonth', start: '2026-04-01', end: '2026-04-30' }
  }
  return rangeMap[value] || rangeMap.custom
}

function emptySummary() {
  return {
    title: '订单概览',
    metrics: [
      { key: 'unreceived', label: '未收金额', value: '¥0.00', tone: 'danger' },
      { key: 'special', label: '特殊状态', value: '0单', tone: 'primary' },
      { key: 'closed', label: '已结清', value: '0单', tone: 'success' }
    ]
  }
}

Page({
  data: {
    keyword: '',
    orders: [],
    filteredOrders: [],
    page: 1,
    total: 0,
    hasMore: false,
    loading: false,
    loadingMore: false,
    summary: emptySummary(),
    sortOptions,
    sortValue: 'dateDesc',
    sortIndex: 0,
    sortLabel: '排序',
    statusTabs,
    activeStatus: 'all',
    filters: cloneFilters(emptyFilters),
    filterDraft: cloneFilters(emptyFilters),
    filterViewSections: buildFilterSections(emptyFilters),
    filterDraftCount: 0,
    filterCount: 0,
    filterDrawerVisible: false,
    filterDrawerActive: false,
    datePresets,
    dateRange: { ...defaultDateRange },
    dateDraft: { ...defaultDateRange },
    dateLabel: formatDateLabel(defaultDateRange),
    pickerStartDate,
    pickerEndDate: today,
    panelVisible: false,
    panelType: '',
    panelPosition: 'bottom',
    panelRound: false,
    panelStyle: '',
    showBackTop: false
  },

  onLoad() {
    this.skipNextShowLoad = true
    this.loadOrders()
  },

  onShow() {
    if (!guardTabAccess(this, '/pages/orders/index')) return
    if (this.skipNextShowLoad) {
      this.skipNextShowLoad = false
      return
    }
    const consumed = this.consumePendingKeyword()
    if (!consumed) this.loadOrders(null, { reset: true })
  },

  onPullDownRefresh() {
    this.loadOrders(() => {
      wx.stopPullDownRefresh()
    }, { reset: true })
  },

  onReachBottom() {
    this.loadMoreOrders()
  },

  onPageScroll(event) {
    const showBackTop = Number(event.scrollTop || 0) > 700
    if (showBackTop !== this.data.showBackTop) this.setData({ showBackTop })
  },

  onBackTopTap() {
    wx.pageScrollTo({ scrollTop: 0, duration: 240 })
    this.setData({ showBackTop: false })
  },

  onUnload() {
    this.clearFilterDrawerTimer()
    if (this.searchTimer) {
      clearTimeout(this.searchTimer)
      this.searchTimer = null
    }
  },

  onKeywordInput(event) {
    this.setData({ keyword: event.detail.value }, () => {
      this.scheduleReload()
    })
  },

  onKeywordConfirm() {
    this.loadOrders(null, { reset: true })
  },

  onStatusChange(event) {
    const status = event.detail.value
    const filters = cloneFilters(this.data.filters)
    filters.paymentState = status === 'all' ? '' : status
    this.setData({
      activeStatus: getActiveStatusFromFilters(filters),
      filters,
      filterCount: this.countFilters(filters)
    }, () => {
      this.loadOrders(null, { reset: true })
    })
  },

  onDateTap() {
    this.setData({
      dateDraft: { ...this.data.dateRange },
      panelVisible: true,
      panelType: 'date',
      panelPosition: 'bottom',
      panelRound: true,
      panelStyle: 'height: 432rpx; background: #ffffff;'
    })
  },

  onFilterTap() {
    this.clearFilterDrawerTimer()
    const filterDraft = cloneFilters(this.data.filters)
    this.setData({
      filterDraft,
      filterViewSections: buildFilterSections(filterDraft),
      filterDraftCount: this.countFilters(filterDraft),
      filterDrawerVisible: true,
      filterDrawerActive: false,
      panelVisible: false
    }, () => {
      wx.nextTick(() => {
        if (this.data.filterDrawerVisible) {
          this.setData({ filterDrawerActive: true })
        }
      })
    })
  },

  onSortChange(event) {
    const sortIndex = event.detail.index
    const selected = sortOptions[sortIndex]
    if (!selected) return
    this.setData({
      sortIndex,
      sortValue: selected.value,
      sortLabel: '排序'
    }, () => {
      this.loadOrders(null, { reset: true })
    })
  },

  onFilterOptionTap(event) {
    const { key, value } = event.currentTarget.dataset
    const filterDraft = cloneFilters(this.data.filterDraft)
    filterDraft[key] = filterDraft[key] === value ? '' : value
    this.setData({
      filterDraft,
      filterViewSections: buildFilterSections(filterDraft),
      filterDraftCount: this.countFilters(filterDraft)
    })
  },

  onResetFilters() {
    const filterDraft = cloneFilters(emptyFilters)
    this.setData({
      filterDraft,
      filterViewSections: buildFilterSections(filterDraft),
      filterDraftCount: 0
    })
  },

  onApplyFilters() {
    const filters = cloneFilters(this.data.filterDraft)
    this.setData({
      activeStatus: getActiveStatusFromFilters(filters),
      filters,
      filterCount: this.countFilters(filters)
    }, () => {
      this.loadOrders(null, { reset: true })
      this.closeFilterDrawer()
    })
  },

  onCancelFilter() {
    this.closeFilterDrawer()
  },

  onSelectDatePreset(event) {
    const value = event.currentTarget.dataset.value
    this.setData({ dateDraft: getPresetRange(value) })
  },

  onStartDateChange(event) {
    const start = event.detail.value
    const end = start > this.data.dateDraft.end ? start : this.data.dateDraft.end
    this.setData({
      dateDraft: {
        ...this.data.dateDraft,
        preset: 'custom',
        start,
        end
      }
    })
  },

  onEndDateChange(event) {
    const end = event.detail.value
    const start = end < this.data.dateDraft.start ? end : this.data.dateDraft.start
    this.setData({
      dateDraft: {
        ...this.data.dateDraft,
        preset: 'custom',
        start,
        end
      }
    })
  },

  onCancelDate() {
    this.setData({ panelVisible: false })
  },

  onConfirmDate() {
    const dateRange = { ...this.data.dateDraft }
    this.setData({
      dateRange,
      dateLabel: formatDateLabel(dateRange),
      panelVisible: false
    }, () => {
      this.loadOrders(null, { reset: true })
    })
  },

  onClosePanel() {
    this.setData({ panelVisible: false })
  },

  onOpenOrder(event) {
    wx.navigateTo({
      url: `/pages/order-detail/index?id=${event.detail.id}`
    })
  },

  noop() {},

  consumePendingKeyword() {
    const app = getApp()
    const keyword = app.globalData.orderKeyword
    if (!keyword) return false

    app.globalData.orderKeyword = ''
    const filters = cloneFilters(emptyFilters)
    this.setData({
      keyword,
      activeStatus: 'all',
      filters,
      filterDraft: cloneFilters(filters),
      filterViewSections: buildFilterSections(filters),
      filterDraftCount: 0,
      filterCount: 0,
      dateRange: { ...defaultDateRange },
      dateDraft: { ...defaultDateRange },
      dateLabel: formatDateLabel(defaultDateRange),
      sortValue: 'dateDesc',
      sortIndex: 0
    }, () => {
      this.loadOrders(null, { reset: true })
    })
    return true
  },

  buildOrderQuery(page) {
    const filters = this.data.filters
    const dateRange = this.data.dateRange
    return {
      page,
      pageSize: orderPageSize,
      keyword: this.data.keyword.trim(),
      sortKey: this.data.sortValue,
      startDate: dateRange.start,
      endDate: dateRange.end,
      paymentState: filters.paymentState,
      deliveryState: filters.deliveryState,
      printState: filters.printState,
      creator: filters.creator
    }
  },

  async loadOrders(callback, options = {}) {
    const reset = options.reset !== false
    const page = reset ? 1 : Math.max(Number(this.data.page || 1) + 1, 1)
    if (this.data.loading || this.data.loadingMore) return
    this.setData(reset ? { loading: true } : { loadingMore: true })
    try {
      const [ordersResult, summary] = await Promise.all([
        orderApi.listOrders(this.buildOrderQuery(page)),
        reset ? orderApi.getOrderSummary(this.buildOrderQuery(1)) : Promise.resolve(this.data.summary)
      ])
      const nextOrders = reset ? (ordersResult.list || []) : this.data.orders.concat(ordersResult.list || [])
      this.setData({
        orders: nextOrders,
        filteredOrders: nextOrders,
        summary: summary || emptySummary(),
        page: ordersResult.page || page,
        total: ordersResult.total || nextOrders.length,
        hasMore: Boolean(ordersResult.hasMore),
        loading: false,
        loadingMore: false
      }, () => {
        if (callback) callback()
      })
    } catch (error) {
      this.setData({
        loading: false,
        loadingMore: false
      })
      wx.showToast({
        title: error.message || '订单加载失败',
        icon: 'none'
      })
      if (callback) callback()
    }
  },

  loadMoreOrders() {
    if (!this.data.hasMore || this.data.loading || this.data.loadingMore) return
    this.loadOrders(null, { reset: false })
  },

  scheduleReload() {
    if (this.searchTimer) clearTimeout(this.searchTimer)
    this.searchTimer = setTimeout(() => {
      this.searchTimer = null
      this.loadOrders(null, { reset: true })
    }, 300)
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

  applyFilters() {
    this.loadOrders(null, { reset: true })
  },

  sortOrders(list) {
    const sortValue = this.data.sortValue
    const sorted = list.slice()
    sorted.sort((a, b) => {
      if (sortValue === 'dateAsc') return a.saleDate.localeCompare(b.saleDate)
      if (sortValue === 'receivableDesc') return b.receivableCents - a.receivableCents
      if (sortValue === 'customerAsc') return a.customer.localeCompare(b.customer, 'zh-Hans-CN')
      return b.saleDate.localeCompare(a.saleDate)
    })
    return sorted
  },

  isDateMatched(order, dateRange) {
    return order.saleDate >= dateRange.start && order.saleDate <= dateRange.end
  },

  isFilterMatched(order, filters) {
    if (filters.paymentState && order.paymentState !== filters.paymentState) return false
    if (filters.deliveryState && order.deliveryState !== filters.deliveryState) return false
    if (filters.printState && order.printState !== filters.printState) return false
    if (filters.creator && order.creator !== filters.creator) return false

    return true
  },

  countFilters(filters) {
    return Object.keys(filters).filter(key => Boolean(filters[key])).length
  }
})
