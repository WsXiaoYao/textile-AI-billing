const messageStore = require('../../services/message-store')

const filters = [
  { key: 'unread', label: '未读' },
  { key: 'read', label: '已读' },
  { key: 'inventory', label: '库存预警' },
  { key: 'print', label: '打印消息' }
]

Page({
  data: {
    activeFilter: 'unread',
    activeFilterLabel: '未读',
    filters,
    messages: [],
    stats: messageStore.getMessageStats()
  },

  onLoad() {
    this.loadMessages()
  },

  onShow() {
    this.loadMessages()
  },

  onPullDownRefresh() {
    this.loadMessages(() => wx.stopPullDownRefresh())
  },

  loadMessages(callback) {
    const activeFilter = this.data.activeFilter
    const activeFilterItem = filters.find(item => item.key === activeFilter) || filters[0]
    this.setData({
      activeFilterLabel: activeFilterItem.label,
      messages: messageStore.getMessages(activeFilter),
      stats: messageStore.getMessageStats()
    }, callback)
  },

  onFilterTap(event) {
    const key = event.currentTarget.dataset.key
    this.setData({ activeFilter: key }, () => this.loadMessages())
  },

  onMessageTap(event) {
    const id = event.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/profile/message-detail?id=${encodeURIComponent(id)}` })
  },

  onMarkAllReadTap() {
    messageStore.markAllRead()
    wx.showToast({ title: '已全部标记为已读', icon: 'none' })
    this.loadMessages()
  },

  onBackTap() {
    if (getCurrentPages().length > 1) {
      wx.navigateBack()
      return
    }

    wx.switchTab({ url: '/pages/profile/index' })
  }
})
