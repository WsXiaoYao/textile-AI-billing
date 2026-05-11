const { dataRequest } = require('./request')

module.exports = {
  listAccounts(params) {
    return dataRequest({ method: 'GET', url: '/accounts', data: params })
  },
  saveAccount(payload) {
    const method = payload && payload.id ? 'PUT' : 'POST'
    const url = payload && payload.id ? `/accounts/${encodeURIComponent(payload.id)}` : '/accounts'
    return dataRequest({ method, url, data: payload })
  }
}
