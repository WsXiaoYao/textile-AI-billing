const orderStore = require('../../services/order-store')

Page({
  data: {
    detail: orderStore.getCustomerDetail('黔西-龙凤'),
    activeTab: 'sales',
    activeFilter: 'all',
    activeFundFilter: 'all',
    filteredSalesRecords: [],
    displayedFundRecords: []
  },

  onLoad(options = {}) {
    this.customerId = decodeURIComponent(options.id || '黔西-龙凤')
    this.loadDetail()
  },

  onShow() {
    this.loadDetail()
  },

  loadDetail() {
    const detail = orderStore.getCustomerDetail(this.customerId || '黔西-龙凤')
    this.setData({ detail }, () => {
      this.applyRecordFilter()
    })
  },

  onTabTap(event) {
    this.setData({
      activeTab: event.currentTarget.dataset.value
    })
  },

  onFilterTap(event) {
    this.setData({
      activeFilter: event.currentTarget.dataset.value
    }, () => {
      this.applyRecordFilter()
    })
  },

  onFundFilterTap(event) {
    this.setData({
      activeFundFilter: event.currentTarget.dataset.value
    }, () => {
      this.applyRecordFilter()
    })
  },

  applyRecordFilter() {
    const filter = this.data.activeFilter
    const fundFilter = this.data.activeFundFilter
    const salesRecords = this.data.detail.salesRecords || []
    const fundRecords = this.data.detail.fundRecords || []
    const filteredSalesRecords = salesRecords.filter(record => {
      if (filter === 'sale') return record.typeText === '销售单'
      if (filter === 'refund') return record.typeText === '退货单'
      if (filter === 'receivable') return record.canReceive
      return true
    })
    const displayedFundRecords = fundRecords.filter(record => {
      if (fundFilter === 'all') return true
      return record.flowKind === fundFilter
    })

    this.setData({
      filteredSalesRecords,
      displayedFundRecords
    })
  },

  onCallTap() {
    const phone = this.data.detail.customer.phone
    if (!phone) return
    wx.makePhoneCall({ phoneNumber: phone })
  },

  onStartOrderTap() {
    const customer = this.data.detail.customer
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

  onCustomerReceiptTap() {
    wx.navigateTo({
      url: `/pages/customer-receipt/index?id=${encodeURIComponent(this.data.detail.customer.id)}`
    })
  },

  onEditTap() {
    wx.navigateTo({
      url: `/pages/customer-edit/index?id=${encodeURIComponent(this.data.detail.customer.id)}`
    })
  },

  onRecordActionTap(event) {
    const id = event.currentTarget.dataset.id
    const record = this.data.detail.salesRecords.find(item => item.id === id)
    if (!record) return

    wx.navigateTo({
      url: record.canReceive
        ? `/pages/order-receipt/index?id=${id}`
        : `/pages/order-detail/index?id=${id}`
    })
  },

  onOpenOrderTap(event) {
    const id = event.currentTarget.dataset.id
    wx.navigateTo({
      url: `/pages/order-detail/index?id=${id}`
    })
  },

  onOpenFundTap(event) {
    const id = event.currentTarget.dataset.id
    wx.navigateTo({
      url: `/pages/fund-detail/index?id=${encodeURIComponent(id)}`
    })
  }
})
