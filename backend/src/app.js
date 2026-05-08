const fastify = require('fastify')
const cors = require('@fastify/cors')
const { env } = require('./env')
const { prisma } = require('./prisma')
const { healthRoutes } = require('./routes/health')
const { mockBridgeRoutes } = require('./routes/mock-bridge')

function buildApp(options = {}) {
  const app = fastify({
    logger: options.logger === false ? false : {
      level: env.LOG_LEVEL
    },
    requestIdHeader: 'x-request-id'
  })

  app.decorate('prisma', prisma)

  app.register(cors, {
    origin: true,
    credentials: true
  })

  app.register(healthRoutes)
  app.register(mockBridgeRoutes, { prefix: '/api/v1' })

  app.addHook('onClose', async instance => {
    await instance.prisma.$disconnect()
  })

  return app
}

module.exports = {
  buildApp
}
