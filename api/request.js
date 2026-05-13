const env = require('../config/env')
const httpAdapter = require('./adapters/http-adapter')

function request(options) {
  return httpAdapter.request(options)
}

async function dataRequest(options) {
  const response = await request(options)
  return response.data
}

module.exports = {
  dataRequest,
  request
}
