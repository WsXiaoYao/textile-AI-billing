const env = require('../config/env')
const mockAdapter = require('./adapters/mock-adapter')
const httpAdapter = require('./adapters/http-adapter')

function getAdapter() {
  return env.API_MODE === 'http' ? httpAdapter : mockAdapter
}

function request(options) {
  return getAdapter().request(options)
}

async function dataRequest(options) {
  const response = await request(options)
  return response.data
}

module.exports = {
  dataRequest,
  request
}
