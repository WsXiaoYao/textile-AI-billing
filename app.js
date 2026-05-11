const authSession = require('./utils/auth-session')

App({
  onLaunch() {
    this.globalData.bootedAt = Date.now()
    this.globalData.auth = authSession.getAuth()
  },
  globalData: {
    auth: null,
    bootedAt: 0,
    selectedCustomer: null,
    pendingCheckoutOrder: null,
    orderKeyword: ''
  }
})
