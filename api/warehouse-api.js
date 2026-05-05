const { dataRequest } = require('./request')

module.exports = {
  getWarehouse(id) {
    return dataRequest({ method: 'GET', url: `/warehouses/${encodeURIComponent(id)}` })
  },
  getWarehouseForm(id) {
    return dataRequest({ method: 'GET', url: `/warehouses/${encodeURIComponent(id)}/form` })
  },
  getWarehouseNames() {
    return dataRequest({ method: 'GET', url: '/warehouses/names' })
  },
  getWarehouseSummary() {
    return dataRequest({ method: 'GET', url: '/warehouses/summary' })
  },
  listWarehouses(params) {
    return dataRequest({ method: 'GET', url: '/warehouses', data: params })
  },
  saveWarehouse(payload) {
    const method = payload && payload.id ? 'PUT' : 'POST'
    const url = payload && payload.id ? `/warehouses/${encodeURIComponent(payload.id)}` : '/warehouses'
    return dataRequest({ method, url, data: payload })
  },
  toggleWarehouseStatus(id) {
    return dataRequest({ method: 'POST', url: `/warehouses/${encodeURIComponent(id)}/status` })
  }
}
