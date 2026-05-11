const { dataRequest } = require('./request')

module.exports = {
  listCategories(params) {
    return dataRequest({ method: 'GET', url: '/customer-categories', data: params })
  },
  saveCategory(payload) {
    const method = payload && payload.id ? 'PUT' : 'POST'
    const url = payload && payload.id ? `/customer-categories/${encodeURIComponent(payload.id)}` : '/customer-categories'
    return dataRequest({ method, url, data: payload })
  }
}
