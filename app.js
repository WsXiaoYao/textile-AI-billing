App({
  onLaunch() {
    this.globalData.bootedAt = Date.now()
  },
  globalData: {
    bootedAt: 0,
    selectedCustomer: null,
    orderKeyword: ''
  }
})
