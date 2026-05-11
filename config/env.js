const runtimeEnv = typeof process !== 'undefined' && process.env ? process.env : {}

const config = {
  API_MODE: runtimeEnv.API_MODE || 'http',
  API_BASE_URL: runtimeEnv.API_BASE_URL || 'http://127.0.0.1:3000/api/v1',
  API_TIMEOUT: 15000,
  MOCK_DELAY: 80,
  DEFAULT_ORG_ID: 'org-main'
}

module.exports = config
