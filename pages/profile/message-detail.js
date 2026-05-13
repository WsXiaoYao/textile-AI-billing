const messageApi = require('../../api/message-api')
const messageStore = require('../../services/message-store')

Page({
  data: {
    id: '',
    detail: null
  },

  onLoad(options) {
    const id = decodeURIComponent(options.id || '')
    this.setData({ id }, () => this.loadDetail())
  },

  async loadDetail() {
    try {
      const detail = await messageApi.markMessageRead(this.data.id)
      this.setData({ detail })
    } catch (error) {
      const detail = messageStore.markMessageRead(this.data.id) || messageStore.getMessageDetail(this.data.id)
      this.setData({ detail })
      wx.showToast({
        title: error.message || '消息详情加载失败',
        icon: 'none'
      })
    }
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
