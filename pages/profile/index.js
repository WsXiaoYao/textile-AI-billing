const profileStore = require('../../services/profile-store')
const profileApi = require('../../api/profile-api')
const { guardTabAccess } = require('../../utils/tabbar')

Page({
  data: {
    profile: profileStore.getProfileHome(),
    loading: false
  },

  onShow() {
    if (!guardTabAccess(this, '/pages/profile/index')) return
    this.loadProfile()
  },

  async loadProfile() {
    this.setData({ loading: true })
    try {
      const profile = await profileApi.getProfileHome()
      this.setData({ profile })
    } catch (error) {
      this.setData({ profile: profileStore.getProfileHome() })
      wx.showToast({
        title: error.message || '我的信息加载失败',
        icon: 'none'
      })
    } finally {
      this.setData({ loading: false })
    }
  },

  onSwitchAccountTap() {
    wx.navigateTo({ url: '/pages/login/index' })
  },

  onToolTap(event) {
    const key = event.currentTarget.dataset.key
    const routeMap = {
      'receipt-code': '/pages/org-receipt-code/index',
      'staff-permission': '/pages/employees/index',
      'message-center': '/pages/profile/message-center'
    }

    if (routeMap[key]) {
      wx.navigateTo({ url: routeMap[key] })
      return
    }

    const titleMap = {
      'staff-permission': '员工权限',
      'print-settings': '打印设置',
      'message-center': '消息中心',
      manual: '操作手册',
      support: '套餐购买'
    }

    wx.showToast({
      title: `${titleMap[key] || '功能'}稍后开放`,
      icon: 'none'
    })
  }
})
