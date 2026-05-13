const authSession = require('./auth-session')

function getPermissions() {
  const auth = authSession.getAuth()
  return Array.isArray(auth && auth.permissions) ? auth.permissions : []
}

function hasPermission(code) {
  if (!code) return true
  return getPermissions().includes(code)
}

function canUseAny(codes = []) {
  return codes.some(code => hasPermission(code))
}

function filterByPermission(items = []) {
  return items.filter(item => {
    const codes = Array.isArray(item.permissions) ? item.permissions : []
    if (!codes.length) return true
    return canUseAny(codes)
  })
}

module.exports = {
  canUseAny,
  filterByPermission,
  getPermissions,
  hasPermission
}
