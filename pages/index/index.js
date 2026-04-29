Page({
  data: {
    currentCustomer: {
      name: '黔西-龙凤',
      code: 'TC-001',
      tag: '贵州客户',
      contractAmount: '¥472.50',
      receivable: '¥0'
    },
    customers: [
      { id: 'qianxi-longfeng', name: '黔西-龙凤' },
      { id: 'hezhang-yanglan', name: '赫章杨兰物流', wide: true },
      { id: 'xu-jiafei', name: '徐加飞' }
    ],
    activeCustomer: 0,
    switchMessage: '客户切换完成',
    inputText: '给客户黔西-龙凤开个单子，要25玛寸布米色20米、25玛寸布深灰15米、280祥云H513-米10米',
    draftText: '',
    cartItems: [
      {
        id: 'cloth-rice',
        name: '25玛寸布',
        spec: '25玛-米色',
        quantity: '20米',
        amount: '¥30',
        isLast: false
      },
      {
        id: 'cloth-gray',
        name: '25玛寸布',
        spec: '25玛-深灰',
        quantity: '15米',
        amount: '¥22.50',
        isLast: false
      },
      {
        id: 'xiangyun',
        name: '280祥云',
        spec: 'H513-米',
        quantity: '10米',
        amount: '¥420',
        isLast: true
      }
    ],
    totalAmount: '¥472.50'
  },

  onShow() {
    const app = getApp()
    const selectedCustomer = app.globalData.selectedCustomer
    if (!selectedCustomer) return

    app.globalData.selectedCustomer = null
    this.setData({
      currentCustomer: selectedCustomer,
      customers: this.mergeQuickCustomers(selectedCustomer),
      activeCustomer: 0,
      switchMessage: '客户切换完成',
      inputText: `给客户${selectedCustomer.name}开个单子，要25玛寸布米色20米、25玛寸布深灰15米、280祥云H513-米10米`
    })
  },

  onCustomerSelect(event) {
    const index = event.detail.index
    this.setData({
      activeCustomer: index,
      switchMessage: '客户切换完成'
    })
  },

  onMoreCustomers() {
    wx.showToast({
      title: '客户列表待接入',
      icon: 'none'
    })
  },

  onResetSession() {
    this.setData({
      draftText: '',
      switchMessage: '会话已重置'
    })
  },

  onOpenCart() {
    wx.showToast({
      title: '购物车待接入',
      icon: 'none'
    })
  },

  onDraftChange(event) {
    this.setData({
      draftText: event.detail.value
    })
  },

  onRecognize() {
    wx.showToast({
      title: '识别逻辑待接入',
      icon: 'none'
    })
  },

  mergeQuickCustomers(customer) {
    const nextCustomers = this.data.customers.filter(item => item.name !== customer.name)
    return [
      { id: customer.code, name: customer.name, wide: customer.name.length > 4 },
      ...nextCustomers
    ].slice(0, 3)
  }
})
