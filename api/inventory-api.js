const { dataRequest } = require('./request')

module.exports = {
  adjustInventory(payload) {
    return dataRequest({ method: 'POST', url: '/inventory/adjustments', data: payload })
  },
  getAdjustContext(id) {
    return dataRequest({ method: 'GET', url: `/inventory/${encodeURIComponent(id)}/adjust-context` })
  },
  getInventoryItem(id) {
    return dataRequest({ method: 'GET', url: `/inventory/${encodeURIComponent(id)}` })
  },
  getInventorySummary(params) {
    return dataRequest({ method: 'GET', url: '/inventory/summary', data: params })
  },
  getWarehouseOptions() {
    return dataRequest({ method: 'GET', url: '/inventory-options/warehouses' })
  },
  queryInventory(params) {
    return dataRequest({ method: 'GET', url: '/inventory', data: params })
  }
}
