App({
  onLaunch() {
    this.globalData.bootedAt = Date.now()
  },
  globalData: {
    bootedAt: 0
  }
})
