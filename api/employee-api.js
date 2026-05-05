const { dataRequest } = require('./request')

module.exports = {
  getEmployee(id) {
    return dataRequest({ method: 'GET', url: `/employees/${encodeURIComponent(id)}` })
  },
  getEmployeeForm(id) {
    return dataRequest({ method: 'GET', url: `/employees/${encodeURIComponent(id)}/form` })
  },
  getRoleList(params) {
    return dataRequest({ method: 'GET', url: '/employees/roles', data: params })
  },
  getWarehouseOptions() {
    return dataRequest({ method: 'GET', url: '/employees/warehouse-options' })
  },
  listEmployees(params) {
    return dataRequest({ method: 'GET', url: '/employees', data: params })
  },
  saveEmployee(payload) {
    const method = payload && payload.id ? 'PUT' : 'POST'
    const url = payload && payload.id ? `/employees/${encodeURIComponent(payload.id)}` : '/employees'
    return dataRequest({ method, url, data: payload })
  },
  updateEmployeeStatus(id, statusKey) {
    return dataRequest({ method: 'POST', url: `/employees/${encodeURIComponent(id)}/status`, data: { statusKey } })
  }
}
