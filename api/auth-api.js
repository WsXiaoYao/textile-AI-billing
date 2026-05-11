const { dataRequest } = require('./request')

function wechatPhoneLogin(payload) {
  return dataRequest({
    method: 'POST',
    url: '/auth/wechat-phone-login',
    data: payload
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
  logout,
  wechatPhoneLogin
}
