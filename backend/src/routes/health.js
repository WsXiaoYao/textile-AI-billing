const { ok } = require('../response')

async function healthRoutes(app) {
  app.get('/health', async request => {
    const db = await app.prisma.$queryRaw`select 1 as ok`

    return ok({
      service: 'textile-ai-billing-backend',
      status: 'ok',
      database: Array.isArray(db) && db.length ? 'ok' : 'unknown',
      time: new Date().toISOString()
    }, request.id)
  })
}

module.exports = {
  healthRoutes
}
