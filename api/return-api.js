const { dataRequest } = require('./request')

module.exports = {
  getCustomerOptions() {
    return dataRequest({ method: 'GET', url: '/return-options/customers' })
  },
  getProductOptions(params) {
    return dataRequest({ method: 'GET', url: '/return-options/products', data: params })
  },
  getReturnOrder(id) {
    return dataRequest({ method: 'GET', url: `/return-orders/${encodeURIComponent(id)}` })
  },
  getReturnOrderForm(id) {
    return dataRequest({ method: 'GET', url: `/return-orders/${encodeURIComponent(id)}/form` })
  },
  getReturnSummary(params) {
    return dataRequest({ method: 'GET', url: '/return-orders/summary', data: params })
  },
  getWarehouseOptions() {
    return dataRequest({ method: 'GET', url: '/return-options/warehouses' })
  },
  listReturnOrders(params) {
    return dataRequest({ method: 'GET', url: '/return-orders', data: params })
  },
  saveReturnOrder(payload) {
    const method = payload && payload.id ? 'PUT' : 'POST'
    const url = payload && payload.id ? `/return-orders/${encodeURIComponent(payload.id)}` : '/return-orders'
    return dataRequest({ method, url, data: payload })
  },
  submitReturnOrder(payload) {
    return dataRequest({ method: 'POST', url: '/return-orders/submit', data: payload })
  }
}
