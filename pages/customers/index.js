const orderStore = require('../../services/order-store')

const sortOptions = [
  { label: '最近下单 从新到旧', value: 'dateDesc' },
  { label: '最近下单 从旧到新', value: 'dateAsc' },
  { label: '欠款金额 从高到低', value: 'receivableDesc' },
  { label: '合同金额 从高到低', value: 'contractDesc' },
  { label: '客户名称 A-Z', value: 'nameAsc' }
]

const statusTabs = [
  { label: '全部', value: 'all' },
  { label: '有欠款', value: 'receivable' },
  { label: '已结清', value: 'settled' },
  { label: '有预收', value: 'prepaid' },
  { label: '最近下单', value: 'active' }
]

const filterSections = [
  {
    key: 'balanceState',
    title: '往来状态',
    options: [
      { label: '有欠款', value: 'receivable' },
      { label: '已结清', value: 'settled' },
      { label: '有预收', value: 'prepaid' }
    ]
  },
  {
    key: 'category',
    title: '客户分类',
    options: [
      { label: '贵州客户', value: '贵州客户' },
      { label: '外地客户', value: '外地客户' },
      { label: '物流客户', value: '物流客户' },
      { label: '批发客户', value: '批发客户' },
      { label: '零售客户', value: '零售客户' }
    ]
  },
  {
    key: 'area',
    title: '客户区域',
    options: [
      { label: '贵州', value: '贵州' },
      { label: '云南', value: '云南' },
      { label: '四川', value: '四川' },
      { label: '重庆', value: '重庆' },
      { label: '湖南', value: '湖南' },
      { label: '广西', value: '广西' },
      { label: '未分区', value: '未分区' }
    ]
  },
  {
    key: 'level',
    title: '客户等级',
    options: [
      { label: '重点客户', value: 'key' },
      { label: '普通客户', value: 'normal' }
    ]
  },
  {
    key: 'activityState',
    title: '活跃状态',
    options: [
      { label: '最近下单', value: 'active' },
      { label: '较久未下单', value: 'silent' }
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
  balanceState: '',
  category: '',
  area: '',
  level: '',
  activityState: ''
}

const today = '2026-04-28'
const pickerStartDate = '2024-01-01'
const filterDrawerAnimationMs = 240
const customerInitialLimit = 18
const customerPageSize = 18

const defaultDateRange = {
  preset: 'custom',
  start: '2025-02-17',
  end: today
}

function cloneFilters(filters) {
  return {
    balanceState: filters.balanceState || '',
    category: filters.category || '',
    area: filters.area || '',
    level: filters.level || '',
    activityState: filters.activityState || ''
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
  if (['receivable', 'settled', 'prepaid'].includes(filters.balanceState)) {
    return filters.balanceState
  }
  if (filters.activityState === 'active') return 'active'
  return 'all'
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
    yesterday: { preset: 'yesterday', start: '2026-04-27', end: '2026-04-27' },
    month: { preset: 'month', start: '2026-04-01', end: today },
    lastMonth: { preset: 'lastMonth', start: '2026-03-01', end: '2026-03-31' }
  }
  return rangeMap[value] || rangeMap.custom
}

Page({
  data: {
    keyword: '',
    displayedCustomers: [],
    filteredTotal: 0,
    customerRenderCount: 0,
    customerHasMore: false,
    customerLoadingMore: false,
    summary: orderStore.getCustomerSummary(),
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
    panelStyle: ''
  },

  onLoad() {
    this.loadCustomers()
  },

  onShow() {
    this.loadCustomers()
  },

  onPullDownRefresh() {
    this.loadCustomers(() => {
      wx.stopPullDownRefresh()
    })
  },

  onReachBottom() {
    this.loadMoreCustomers()
  },

  onUnload() {
    this.clearFilterDrawerTimer()
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
    const status = event.detail.value
    const filters = cloneFilters(this.data.filters)
    filters.balanceState = ''
    filters.activityState = ''

    if (['receivable', 'settled', 'prepaid'].includes(status)) {
      filters.balanceState = status
    }

    if (status === 'active') {
      filters.activityState = 'active'
    }

    this.setData({
      activeStatus: getActiveStatusFromFilters(filters),
      filters,
      filterCount: this.countFilters(filters)
    }, () => {
      this.applyFilters()
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
      this.applyFilters()
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
      this.applyFilters()
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
      this.applyFilters()
    })
  },

  onClosePanel() {
    this.setData({ panelVisible: false })
  },

  onOpenCustomer(event) {
    wx.navigateTo({
      url: `/pages/customer-detail/index?id=${encodeURIComponent(event.detail.id)}`
    })
  },

  onAddCustomerTap() {
    wx.navigateTo({ url: '/pages/customer-edit/index' })
  },

  onStartOrder(event) {
    const customer = this.findCustomer(event.detail.id)
    if (!customer) return

    const app = getApp()
    app.globalData.selectedCustomer = {
      name: customer.name,
      code: customer.code,
      tag: customer.tag,
      contractAmount: customer.contractText,
      receivable: customer.receivableText
    }
    wx.switchTab({ url: '/pages/index/index' })
  },

  onViewOrders(event) {
    const customer = this.findCustomer(event.detail.id)
    if (!customer) return

    const app = getApp()
    app.globalData.orderKeyword = customer.name
    wx.switchTab({ url: '/pages/orders/index' })
  },

  noop() {},

  loadCustomers(callback) {
    this.customers = orderStore.getCustomerList()
    this.setData({
      summary: orderStore.getCustomerSummary()
    }, () => {
      this.applyFilters(callback)
    })
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

  applyFilters(callback) {
    const keyword = this.data.keyword.trim().toLowerCase()
    const filters = this.data.filters
    const dateRange = this.data.dateRange
    const customers = this.customers || []
    const filteredCustomers = this.sortCustomers(customers.filter(customer => {
      const text = [
        customer.name,
        customer.code,
        customer.tag,
        customer.category,
        customer.area,
        customer.phone,
        customer.address,
        customer.lastOrderNo,
        customer.recentGoods,
        customer.creatorsText
      ].join(' ').toLowerCase()

      return (!keyword || text.includes(keyword)) &&
        this.isDateMatched(customer, dateRange) &&
        this.isFilterMatched(customer, filters)
    }))

    this.filteredCustomers = filteredCustomers
    this.resetCustomerWindow(callback)
  },

  resetCustomerWindow(callback) {
    const filteredCustomers = this.filteredCustomers || []
    const nextCount = Math.min(customerInitialLimit, filteredCustomers.length)
    this.setData({
      displayedCustomers: filteredCustomers.slice(0, nextCount),
      filteredTotal: filteredCustomers.length,
      customerRenderCount: nextCount,
      customerHasMore: nextCount < filteredCustomers.length,
      customerLoadingMore: false
    }, callback)
  },

  loadMoreCustomers() {
    if (this.data.customerLoadingMore || !this.data.customerHasMore) return

    const filteredCustomers = this.filteredCustomers || []
    const currentCount = this.data.customerRenderCount
    const nextCount = Math.min(currentCount + customerPageSize, filteredCustomers.length)
    const nextItems = filteredCustomers.slice(currentCount, nextCount)

    this.setData({
      customerLoadingMore: true
    }, () => {
      this.setData({
        displayedCustomers: this.data.displayedCustomers.concat(nextItems),
        customerRenderCount: nextCount,
        customerHasMore: nextCount < filteredCustomers.length,
        customerLoadingMore: false
      })
    })
  },

  sortCustomers(list) {
    const sortValue = this.data.sortValue
    const sorted = list.slice()
    sorted.sort((a, b) => {
      if (sortValue === 'dateAsc') return a.lastOrderDate.localeCompare(b.lastOrderDate)
      if (sortValue === 'receivableDesc') return b.receivableCents - a.receivableCents
      if (sortValue === 'contractDesc') return b.contractCents - a.contractCents
      if (sortValue === 'nameAsc') return a.name.localeCompare(b.name, 'zh-Hans-CN')
      return b.lastOrderDate.localeCompare(a.lastOrderDate)
    })
    return sorted
  },

  isDateMatched(customer, dateRange) {
    if (!customer.lastOrderDate) return true
    return customer.lastOrderDate >= dateRange.start && customer.lastOrderDate <= dateRange.end
  },

  isFilterMatched(customer, filters) {
    if (filters.balanceState && customer.statusKey !== filters.balanceState) return false
    if (filters.category && customer.category !== filters.category) return false
    if (filters.area && customer.area !== filters.area) return false
    if (filters.level && customer.level !== filters.level) return false
    if (filters.activityState && customer.activeState !== filters.activityState) return false

    return true
  },

  findCustomer(id) {
    return (this.customers || []).find(customer => customer.id === id)
  },

  countFilters(filters) {
    return Object.keys(filters).filter(key => Boolean(filters[key])).length
  }
})
