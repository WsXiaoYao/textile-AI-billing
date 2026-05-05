const { dataRequest } = require('./request')

module.exports = {
  createOrder(payload) {
    return dataRequest({ method: 'POST', url: '/sales-orders', data: payload })
  },
  getOrderDetail(id) {
    return dataRequest({ method: 'GET', url: `/sales-orders/${encodeURIComponent(id)}` })
  },
  getOrderSummary(params) {
    return dataRequest({ method: 'GET', url: '/sales-orders/summary', data: params })
  },
  getReceiptContext(id) {
    return dataRequest({ method: 'GET', url: `/sales-orders/${encodeURIComponent(id)}/receipt-context` })
  },
  listOrders(params) {
    return dataRequest({ method: 'GET', url: '/sales-orders', data: params })
  },
  markPrinted(id) {
    return dataRequest({ method: 'POST', url: `/sales-orders/${encodeURIComponent(id)}/print` })
  },
  recordReceipt(id, payload) {
    return dataRequest({ method: 'POST', url: `/sales-orders/${encodeURIComponent(id)}/receipts`, data: payload })
  }
}
