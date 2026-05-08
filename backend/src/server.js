const { buildApp } = require('./app')
const { env } = require('./env')

const app = buildApp()

async function start() {
  try {
    await app.listen({
      host: env.HOST,
      port: env.PORT
    })
  } catch (error) {
    app.log.error(error)
    process.exit(1)
  }
}

start()
