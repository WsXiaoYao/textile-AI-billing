const { dataRequest } = require('./request')

module.exports = {
  addImportTask(payload) {
    return dataRequest({ method: 'POST', url: '/customers/import-tasks', data: payload })
  },
  exportCustomers(params) {
    return dataRequest({ method: 'GET', url: '/customers/export', data: params })
  },
  getCustomerDetail(id) {
    return dataRequest({ method: 'GET', url: `/customers/${encodeURIComponent(id)}` })
  },
  getCustomerSummary(params) {
    return dataRequest({ method: 'GET', url: '/customers/summary', data: params })
  },
  getFundDetail(id) {
    return dataRequest({ method: 'GET', url: `/fund-records/${encodeURIComponent(id)}` })
  },
  getImportExportCenter() {
    return dataRequest({ method: 'GET', url: '/customers/import-export' })
  },
  getImportTask(id) {
    return dataRequest({ method: 'GET', url: `/customers/import-tasks/${encodeURIComponent(id)}` })
  },
  getReceiptContext(id, params) {
    return dataRequest({ method: 'GET', url: `/customers/${encodeURIComponent(id)}/receipt-context`, data: params })
  },
  getTemplate() {
    return dataRequest({ method: 'GET', url: '/customers/import-template' })
  },
  listCustomerFundRecords(id, params) {
    return dataRequest({ method: 'GET', url: `/customers/${encodeURIComponent(id)}/fund-records`, data: params })
  },
  listCustomerOrders(id, params) {
    return dataRequest({ method: 'GET', url: `/customers/${encodeURIComponent(id)}/sales-orders`, data: params })
  },
  listCustomers(params) {
    return dataRequest({ method: 'GET', url: '/customers', data: params })
  },
  recordReceipt(id, payload) {
    return dataRequest({ method: 'POST', url: `/customers/${encodeURIComponent(id)}/receipts`, data: payload })
  },
  saveCustomer(payload) {
    const method = payload && payload.id ? 'PUT' : 'POST'
    const url = payload && payload.id ? `/customers/${encodeURIComponent(payload.id)}` : '/customers'
    return dataRequest({ method, url, data: payload })
  },
  updateImportTask(id, payload) {
    return dataRequest({ method: 'PUT', url: `/customers/import-tasks/${encodeURIComponent(id)}`, data: payload })
  }
}
