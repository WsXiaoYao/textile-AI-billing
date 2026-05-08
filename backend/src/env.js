const path = require('path')
const dotenv = require('dotenv')

dotenv.config({ path: path.join(__dirname, '..', '.env') })

const env = {
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://xiaoyao@127.0.0.1:5432/textile_ai_billing',
  HOST: process.env.HOST || '127.0.0.1',
  PORT: Number(process.env.PORT || 3000),
  LOG_LEVEL: process.env.LOG_LEVEL || 'info'
}

process.env.DATABASE_URL = env.DATABASE_URL

module.exports = {
  env
}
