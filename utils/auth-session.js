const TOKEN_KEY = 'juyun_auth_token'
const AUTH_KEY = 'juyun_auth_payload'

function hasWxStorage() {
  return typeof wx !== 'undefined' && wx.getStorageSync && wx.setStorageSync
}

function getToken() {
  if (!hasWxStorage()) return ''
  try {
    return wx.getStorageSync(TOKEN_KEY) || ''
  } catch (error) {
    return ''
  }
}

function getAuth() {
  if (!hasWxStorage()) return null
  try {
    return wx.getStorageSync(AUTH_KEY) || null
  } catch (error) {
    return null
  }
}

function getCurrentOrgId(fallback = '') {
  const auth = getAuth()
  return auth && auth.currentOrg && auth.currentOrg.id ? auth.currentOrg.id : fallback
}

function saveAuth(payload) {
  if (!hasWxStorage() || !payload) return
  if (payload.token) {
    wx.setStorageSync(TOKEN_KEY, payload.token)
  }
  wx.setStorageSync(AUTH_KEY, payload)
}

function mergeAuth(payload) {
  if (!hasWxStorage() || !payload) return
  const current = getAuth() || {}
  saveAuth({
    ...current,
    ...payload,
    token: payload.token || current.token || getToken()
  })
}

function clearAuth() {
  if (!hasWxStorage()) return
  try {
    wx.removeStorageSync(TOKEN_KEY)
    wx.removeStorageSync(AUTH_KEY)
  } catch (error) {
    // Storage clear failure should not block logout UI.
  }
}

module.exports = {
  clearAuth,
  getAuth,
  getCurrentOrgId,
  getToken,
  mergeAuth,
  saveAuth
}
