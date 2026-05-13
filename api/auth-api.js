const { dataRequest } = require('./request')

function wechatPhoneLogin(payload) {
  return dataRequest({
    method: 'POST',
    url: '/auth/wechat-phone-login',
    data: payload
  })
}

function getMockOptions() {
  return dataRequest({
    method: 'GET',
    url: '/auth/mock-options'
  })
}

function getMe() {
  return dataRequest({
    method: 'GET',
    url: '/auth/me'
  })
}

function logout() {
  return dataRequest({
    method: 'POST',
    url: '/auth/logout'
  })
}

module.exports = {
  getMe,
  getMockOptions,
  logout,
  wechatPhoneLogin
}
