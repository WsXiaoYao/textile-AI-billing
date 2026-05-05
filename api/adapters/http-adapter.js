const env = require('../../config/env')
const { makeRequestId, normalizeResponse } = require('../utils')

function joinUrl(path) {
  if (/^https?:\/\//i.test(path)) return path
  return `${env.API_BASE_URL}${path}`
}

function request(options = {}) {
  const method = String(options.method || 'GET').toUpperCase()
  const path = options.url || options.path || '/'
  const url = joinUrl(path)

  return new Promise((resolve, reject) => {
    if (typeof wx === 'undefined' || !wx.request) {
      reject(new Error('wx.request 不可用，请在微信小程序运行环境中调用。'))
      return
    }

    wx.request({
      url,
      method,
      data: options.data || {},
      timeout: env.API_TIMEOUT,
      header: {
        'content-type': 'application/json',
        'X-Org-Id': env.DEFAULT_ORG_ID,
        'X-Request-Id': makeRequestId(),
        ...(options.header || {})
      },
      success(res) {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`接口请求失败：HTTP ${res.statusCode}`))
          return
        }

        const normalized = normalizeResponse(res.data)
        if (normalized.code !== 0) {
          reject(new Error(normalized.message || '接口请求失败'))
          return
        }

        resolve(normalized)
      },
      fail(error) {
        reject(new Error(error.errMsg || '网络请求失败'))
      }
    })
  })
}

module.exports = {
  request
}
