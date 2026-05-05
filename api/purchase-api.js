const { dataRequest } = require('./request')

module.exports = {
  getProductOptions(params) {
    return dataRequest({ method: 'GET', url: '/purchase-options/products', data: params })
  },
  getPurchaseOrder(id) {
    return dataRequest({ method: 'GET', url: `/purchase-orders/${encodeURIComponent(id)}` })
  },
  getPurchaseOrderForm(id) {
    return dataRequest({ method: 'GET', url: `/purchase-orders/${encodeURIComponent(id)}/form` })
  },
  getSupplierOptions() {
    return dataRequest({ method: 'GET', url: '/purchase-options/suppliers' })
  },
  getWarehouseOptions() {
    return dataRequest({ method: 'GET', url: '/purchase-options/warehouses' })
  },
  listPurchaseOrders(params) {
    return dataRequest({ method: 'GET', url: '/purchase-orders', data: params })
  },
  savePurchaseOrder(payload) {
    const method = payload && payload.id ? 'PUT' : 'POST'
    const url = payload && payload.id ? `/purchase-orders/${encodeURIComponent(payload.id)}` : '/purchase-orders'
    return dataRequest({ method, url, data: payload })
  },
  submitPurchaseOrder(payload) {
    return dataRequest({ method: 'POST', url: '/purchase-orders/submit', data: payload })
  }
}
