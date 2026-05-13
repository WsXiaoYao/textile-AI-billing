const runtimeEnv = typeof process !== 'undefined' && process.env ? process.env : {}

const config = {
  API_BASE_URL: runtimeEnv.API_BASE_URL || 'http://192.168.1.172:3000/api/v1',
  API_TIMEOUT: 15000,
  DEFAULT_ORG_ID: 'org-main',
  AUTH_MOCK_LOGIN: true
}

module.exports = config
