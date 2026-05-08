const mockAdapter = require('../../../api/adapters/mock-adapter')
const { fail } = require('../response')

function getPayload(request) {
  if (request.method === 'GET') return request.query || {}
  return request.body || {}
}

async function mockBridgeRoutes(app) {
  app.all('/*', async (request, reply) => {
    try {
      const response = await mockAdapter.request({
        method: request.method,
        url: request.url,
        data: getPayload(request),
        header: request.headers
      })

      return {
        ...response,
        traceId: request.id
      }
    } catch (error) {
      const statusCode = /not found/i.test(error.message || '') ? 404 : 500
      reply.code(statusCode)
      return fail(error.message, {
        code: statusCode,
        traceId: request.id
      })
    }
  })
}

module.exports = {
  mockBridgeRoutes
}
