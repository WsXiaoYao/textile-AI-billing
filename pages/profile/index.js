const profileStore = require('../../services/profile-store')

Page({
  data: {
    profile: profileStore.getProfileHome()
  },

  onShow() {
    this.setData({
      profile: profileStore.getProfileHome()
    })
  },

  onSwitchOrgTap() {
    wx.navigateTo({ url: '/pages/org-switch/index' })
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
