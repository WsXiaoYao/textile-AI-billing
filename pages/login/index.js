const authApi = require('../../api/auth-api')
const env = require('../../config/env')
const authSession = require('../../utils/auth-session')

function wxLogin() {
  return new Promise((resolve, reject) => {
    if (typeof wx === 'undefined' || !wx.login) {
      reject(new Error('微信登录能力不可用'))
      return
    }

    wx.login({
      success: resolve,
      fail: reject
    })
  })
}

function goFallback() {
  const pages = getCurrentPages()
  if (pages.length > 1) {
    wx.navigateBack()
    return
  }
  wx.switchTab({ url: '/pages/index/index' })
}

function isPhoneVerificationError(message) {
  return /短信验证|手机.*验证|绑定.*手机.*验证|verify/i.test(String(message || ''))
}

Page({
  data: {
    isMockMode: env.API_MODE === 'mock',
    loading: false
  },

  saveLogin(payload) {
    authSession.saveAuth(payload)
    getApp().globalData.auth = payload
    wx.showToast({ title: '登录成功', icon: 'success' })
    setTimeout(goFallback, 300)
  },

  async onGetPhoneNumber(event) {
    if (this.data.loading) return
    const detail = event.detail || {}
    if (!detail.code) {
      if (isPhoneVerificationError(detail.errMsg)) {
        wx.showModal({
          title: '手机号授权未完成',
          content: '当前微信绑定的手机号需要先完成短信验证。开发者工具里建议点“开发环境模拟登录”；要测真实授权，请用真机预览并按微信提示完成验证。',
          showCancel: false
        })
        return
      }

      wx.showToast({
        title: detail.errMsg && detail.errMsg.includes('deny') ? '已取消授权' : '未获取到手机号授权',
        icon: 'none'
      })
      return
    }

    this.setData({ loading: true })
    try {
      const loginResult = await wxLogin()
      const payload = await authApi.wechatPhoneLogin({
        phoneCode: detail.code,
        loginCode: loginResult.code
      })
      this.saveLogin(payload)
    } catch (error) {
      if (isPhoneVerificationError(error.message)) {
        wx.showModal({
          title: '手机号授权未完成',
          content: '当前微信绑定的手机号需要先完成短信验证。开发者工具里建议点“开发环境模拟登录”；要测真实授权，请用真机预览并按微信提示完成验证。',
          showCancel: false
        })
        return
      }

      wx.showToast({
        title: error.message || '登录失败',
        icon: 'none'
      })
    } finally {
      this.setData({ loading: false })
    }
  },

  async onMockLogin() {
    if (this.data.loading) return

    this.setData({ loading: true })
    try {
      const payload = await authApi.wechatPhoneLogin({
        mockPhone: '1358270496',
        loginCode: `dev-${Date.now()}`
      })
      this.saveLogin(payload)
    } catch (error) {
      wx.showToast({
        title: error.message || '模拟登录失败',
        icon: 'none'
      })
    } finally {
      this.setData({ loading: false })
    }
  },

  goBack() {
    goFallback()
  }
})
