const { dataRequest } = require('./request')

module.exports = {
  getMessageDetail(id) {
    return dataRequest({ method: 'GET', url: `/messages/${encodeURIComponent(id)}` })
  },
  getMessageStats() {
    return dataRequest({ method: 'GET', url: '/messages/stats' })
  },
  listMessages(params) {
    return dataRequest({ method: 'GET', url: '/messages', data: params })
  },
  markAllRead() {
    return dataRequest({ method: 'POST', url: '/messages/read-all' })
  },
  markMessageRead(id) {
    return dataRequest({ method: 'POST', url: `/messages/${encodeURIComponent(id)}/read` })
  }
}
