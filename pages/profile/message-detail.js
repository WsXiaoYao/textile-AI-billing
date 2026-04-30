const messageStore = require('../../services/message-store')

Page({
  data: {
    id: '',
    detail: null
  },

  onLoad(options) {
    const id = decodeURIComponent(options.id || '')
    const detail = messageStore.markMessageRead(id) || messageStore.getMessageDetail(id)
    this.setData({ id, detail })
  },

  onBackTap() {
    if (getCurrentPages().length > 1) {
      wx.navigateBack()
      return
    }

    wx.switchTab({ url: '/pages/profile/index' })
  },

  onActionTap() {
    const actionUrl = this.data.detail && this.data.detail.actionUrl
    if (!actionUrl) return

    wx.navigateTo({ url: actionUrl })
  }
})
