const messageStorageKey = 'textile_messages_v1'

const seedMessages = [
  {
    id: 'msg-stock-2503-rice',
    type: 'inventory',
    typeText: '库存预警',
    title: '库存预警 · 25玛寸布 / 米色',
    summary: '投色仓库存 18，低于下限 20。',
    time: '2026-04-18 20:50',
    status: 'unread',
    priority: 'warning',
    actionText: '查看库存详情',
    actionUrl: '/pages/stock-summary/index',
    rows: [
      { label: '发生时间', value: '2026-04-18 20:50' },
      { label: '内容', value: '投色仓中 25玛寸布 / 米色库存 18 米，低于下限 20 米。' }
    ]
  },
  {
    id: 'msg-print-xs202604160005',
    type: 'print',
    typeText: '打印消息',
    title: '打印任务成功',
    summary: '销售单 XS202604160005 已打印完成。',
    time: '2026-04-18 20:42',
    status: 'read',
    priority: 'success',
    actionText: '查看销售单',
    actionUrl: '/pages/order-detail/index?id=XS202604160005',
    rows: [
      { label: '发生时间', value: '2026-04-18 20:42' },
      { label: '内容', value: '销售单 XS202604160005 已完成模板打印，可在销售单详情中继续分享或补打。' }
    ]
  },
  {
    id: 'msg-org-switch-sync',
    type: 'system',
    typeText: '组织消息',
    title: '组织切换提醒',
    summary: '已切换到聚云辅料，购物车缓存已刷新。',
    time: '2026-04-18 19:32',
    status: 'read',
    priority: 'primary',
    actionText: '',
    actionUrl: '',
    rows: [
      { label: '发生时间', value: '2026-04-18 19:32' },
      { label: '内容', value: '当前组织已切换为聚云辅料，订单、库存和客户数据将按该组织权限展示。' }
    ]
  }
]

function canUseStorage() {
  return typeof wx !== 'undefined' && wx.getStorageSync && wx.setStorageSync
}

function loadMessages() {
  if (!canUseStorage()) return seedMessages.map(normalizeMessage)

  const stored = wx.getStorageSync(messageStorageKey)
  if (Array.isArray(stored) && stored.length) {
    return stored.map(normalizeMessage)
  }

  const initial = seedMessages.map(normalizeMessage)
  wx.setStorageSync(messageStorageKey, initial)
  return initial
}

function saveMessages(messages) {
  if (!canUseStorage()) return
  wx.setStorageSync(messageStorageKey, messages.map(normalizeMessage))
}

function normalizeMessage(message) {
  const status = message.status === 'read' ? 'read' : 'unread'
  return {
    ...message,
    status,
    statusText: status === 'read' ? '已读' : '未读',
    statusTone: status === 'read' ? 'success' : 'warning',
    priority: message.priority || 'primary',
    rows: Array.isArray(message.rows) ? message.rows : []
  }
}

function getMessages(filter = 'unread') {
  const activeFilter = filter || 'unread'
  return loadMessages()
    .filter(message => {
      if (activeFilter === 'all') return true
      if (activeFilter === 'unread') return message.status === 'unread'
      if (activeFilter === 'read') return message.status === 'read'
      return message.type === activeFilter
    })
    .sort((a, b) => String(b.time || '').localeCompare(String(a.time || '')))
}

function getMessageStats() {
  const messages = loadMessages()
  return {
    total: messages.length,
    unread: messages.filter(message => message.status === 'unread').length
  }
}

function getMessageDetail(id) {
  const messages = loadMessages()
  const message = messages.find(item => item.id === id)
  return message ? normalizeMessage(message) : null
}

function markMessageRead(id) {
  const messages = loadMessages()
  const nextMessages = messages.map(message => message.id === id
    ? normalizeMessage({ ...message, status: 'read' })
    : normalizeMessage(message))
  saveMessages(nextMessages)
  return nextMessages.find(message => message.id === id) || null
}

function markAllRead() {
  const messages = loadMessages().map(message => normalizeMessage({ ...message, status: 'read' }))
  saveMessages(messages)
  return messages
}

module.exports = {
  getMessageDetail,
  getMessages,
  getMessageStats,
  markAllRead,
  markMessageRead
}
