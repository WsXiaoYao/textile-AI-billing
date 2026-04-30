const profileStore = require('../../services/profile-store')

Page({
  data: {
    keyword: '',
    organizations: [],
    selectedOrgId: ''
  },

  onLoad() {
    const current = profileStore.getCurrentOrg()
    this.setData({
      selectedOrgId: current.id
    }, () => {
      this.loadOrganizations()
    })
  },

  loadOrganizations() {
    this.setData({
      organizations: profileStore.getOrganizations(this.data.keyword).map(org => ({
        ...org,
        selected: org.id === this.data.selectedOrgId
      }))
    })
  },

  onKeywordInput(event) {
    this.setData({
      keyword: event.detail.value
    }, () => {
      this.loadOrganizations()
    })
  },

  onOrgTap(event) {
    this.setData({
      selectedOrgId: event.currentTarget.dataset.id
    }, () => {
      this.loadOrganizations()
    })
  },

  onCancelTap() {
    if (getCurrentPages().length > 1) {
      wx.navigateBack()
      return
    }
    wx.switchTab({ url: '/pages/profile/index' })
  },

  onConfirmTap() {
    const target = profileStore.switchOrganization(this.data.selectedOrgId)
    wx.showToast({
      title: `已切换到${target.name}`,
      icon: 'success'
    })
    setTimeout(() => {
      this.onCancelTap()
    }, 500)
  }
})
