const { dataRequest } = require('./request')

module.exports = {
  getSupplier(id) {
    return dataRequest({ method: 'GET', url: `/suppliers/${encodeURIComponent(id)}` })
  },
  getSupplierForm(id) {
    return dataRequest({ method: 'GET', url: `/suppliers/${encodeURIComponent(id)}/form` })
  },
  listSuppliers(params) {
    return dataRequest({ method: 'GET', url: '/suppliers', data: params })
  },
  saveSupplier(payload) {
    const method = payload && payload.id ? 'PUT' : 'POST'
    const url = payload && payload.id ? `/suppliers/${encodeURIComponent(payload.id)}` : '/suppliers'
    return dataRequest({ method, url, data: payload })
  },
  toggleSupplierStatus(id) {
    return dataRequest({ method: 'POST', url: `/suppliers/${encodeURIComponent(id)}/status` })
  }
}
