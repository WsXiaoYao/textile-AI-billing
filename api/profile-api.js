const { dataRequest } = require('./request')

module.exports = {
  getCurrentOrg() {
    return dataRequest({ method: 'GET', url: '/organizations/current' })
  },
  getProfileHome() {
    return dataRequest({ method: 'GET', url: '/profile/home' })
  },
  getReceiptSettings() {
    return dataRequest({ method: 'GET', url: '/organizations/receipt-settings' })
  },
  listOrganizations(params) {
    return dataRequest({ method: 'GET', url: '/organizations', data: params })
  },
  saveReceiptSettings(payload) {
    return dataRequest({ method: 'PUT', url: '/organizations/receipt-settings', data: payload })
  },
  switchOrganization(orgId) {
    return dataRequest({ method: 'POST', url: '/organizations/switch', data: { orgId } })
  }
}
