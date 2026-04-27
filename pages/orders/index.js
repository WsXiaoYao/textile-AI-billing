const statusTabs = [
  { label: '全部', value: 'all' },
  { label: '待收款', value: 'pending' },
  { label: '部分收款', value: 'partial' },
  { label: '已结清', value: 'settled' }
]

const orders = [
  {
    id: 'XS202604180003',
    no: 'XS202604180003',
    customer: '黔西-龙凤',
    goodsSummary: '25玛寸布 2条明细',
    printText: '未打印',
    statusText: '待收',
    statusTone: 'danger',
    receivableText: '¥320',
    amountTone: 'danger',
    receivableCents: 32000,
    paymentState: 'pending',
    workflow: 'receivable',
    actions: [
      { type: 'prepay', text: '预收冲抵 ¥100', tone: 'success' },
      { type: 'receive', text: '去收款', tone: 'primary' }
    ]
  },
  {
    id: 'XS202604160001',
    no: 'XS202604160001',
    customer: '四川古蔺-王端',
    goodsSummary: '280祥云 1条明细',
    printText: '已打印',
    statusText: '待收',
    statusTone: 'danger',
    receivableText: '¥1,575',
    amountTone: 'danger',
    receivableCents: 157500,
    paymentState: 'partial',
    workflow: 'receivable',
    actions: [
      { type: 'partial', text: '部分收款', tone: 'warning' }
    ]
  },
  {
    id: 'XS202604130001',
    no: 'XS202604130001',
    customer: '贵阳李总',
    goodsSummary: '3公分金线曲牙织带',
    printText: '已结清',
    statusText: '已结清',
    statusTone: 'success',
    receivableText: '¥0.00',
    amountTone: 'success',
    receivableCents: 0,
    paymentState: 'settled',
    workflow: 'receivable',
    actions: [
      { type: 'paid', text: '已收款', tone: 'success' }
    ]
  }
]

Page({
  data: {
    keyword: '',
    activeStatus: 'pending',
    statusTabs,
    orders,
    filteredOrders: [],
    summary: {
      title: '订单概览',
      metrics: [
        { key: 'receivable', label: '待收金额', value: '¥1,695', tone: 'danger' },
        { key: 'prepay', label: '使用预收', value: '¥100', tone: 'success' },
        { key: 'todo', label: '待处理', value: '3单', tone: 'primary' }
      ]
    }
  },

  onLoad() {
    this.applyFilters()
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
    this.setData({ activeStatus: event.detail.value }, () => {
      this.applyFilters()
    })
  },

  onFilterTap() {
    wx.showActionSheet({
      itemList: statusTabs.map(item => item.label),
      success: (result) => {
        const tab = statusTabs[result.tapIndex]
        if (!tab) return
        this.setData({ activeStatus: tab.value }, () => {
          this.applyFilters()
        })
      }
    })
  },

  onOpenOrder(event) {
    const order = this.data.orders.find(item => item.id === event.detail.id)
    if (!order) return
    wx.showToast({
      title: `${order.no} 详情待接入`,
      icon: 'none'
    })
  },

  onOrderAction(event) {
    const actionTextMap = {
      prepay: '已查看预收冲抵',
      receive: '收款流程待接入',
      partial: '查看部分收款记录',
      paid: '该订单已结清'
    }
    wx.showToast({
      title: actionTextMap[event.detail.action] || '操作待接入',
      icon: 'none'
    })
  },

  applyFilters() {
    const keyword = this.data.keyword.trim().toLowerCase()
    const activeStatus = this.data.activeStatus
    const filteredOrders = this.data.orders.filter(order => {
      const statusMatched = this.isStatusMatched(order, activeStatus)
      const text = `${order.no} ${order.customer} ${order.goodsSummary} ${order.printText}`.toLowerCase()
      return statusMatched && (!keyword || text.includes(keyword))
    })

    this.setData({ filteredOrders })
  },

  isStatusMatched(order, status) {
    if (status === 'all') return true
    if (status === 'pending') return order.workflow === 'receivable'
    if (status === 'partial') return order.paymentState === 'partial'
    if (status === 'settled') return order.paymentState === 'settled'
    return true
  }
})
