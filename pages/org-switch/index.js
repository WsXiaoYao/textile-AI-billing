const profileApi = require('../../api/profile-api')
const authSession = require('../../utils/auth-session')

Page({
  data: {
    keyword: '',
    organizations: [],
    selectedOrgId: '',
    loading: false,
    switching: false
  },

  onLoad() {
    this.loadOrganizations()
  },

  async loadOrganizations() {
    this.setData({ loading: true })
    try {
      const result = await profileApi.listOrganizations({ keyword: this.data.keyword })
      const list = Array.isArray(result) ? result : result.list || []
      const current = list.find(org => org.active) || list[0] || {}
      const selectedOrgId = this.data.selectedOrgId || current.id || ''
      this.setData({
        selectedOrgId,
        organizations: list.map(org => ({
          ...org,
          selected: org.id === selectedOrgId
        }))
      })
    } catch (error) {
      wx.showToast({
        title: error.message || '组织列表加载失败',
        icon: 'none'
      })
    } finally {
      this.setData({ loading: false })
    }
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

  async onConfirmTap() {
    if (!this.data.selectedOrgId || this.data.switching) return
    const target = this.data.organizations.find(org => org.id === this.data.selectedOrgId)
    this.setData({ switching: true })
    try {
      const auth = await profileApi.switchOrganization(this.data.selectedOrgId)
      authSession.mergeAuth(auth)
    } catch (error) {
      wx.showToast({
        title: error.message || '组织切换失败',
        icon: 'none'
      })
      this.setData({ switching: false })
      return
    }
    wx.showToast({
      title: `已切换到${target ? target.name : '新组织'}`,
      icon: 'success'
    })
    setTimeout(() => {
      this.onCancelTap()
    }, 500)
  }
})
