const { dataRequest } = require('./request')

module.exports = {
  recognizeSalesIntent(payload) {
    return dataRequest({ method: 'POST', url: '/ai/sales-intent', data: payload })
  }
}
