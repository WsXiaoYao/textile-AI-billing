const authApi = require('../../api/auth-api')
const authSession = require('../../utils/auth-session')
const { getDefaultTabPath } = require('../../utils/tabbar')
const env = require('../../config/env')

const isLocalApi = /127\.0\.0\.1|localhost/i.test(env.API_BASE_URL || '')
const isMockMode = Boolean(env.AUTH_MOCK_LOGIN || isLocalApi)

const mockAccounts = [
  {
    label: '老板账号',
    phone: '1358270496',
    role: '老板',
    tenantCode: 'tenant-juyun-main',
    tenantName: '聚云掌柜主租户',
    orgCode: 'org-main',
    org: '聚云掌柜',
    desc: '主组织完整业务数据'
  },
  {
    label: '销售小王',
    phone: '13800000001',
    role: '销售',
    tenantCode: 'tenant-sales-demo',
    tenantName: '销售演示租户',
    orgCode: 'org-sales-demo',
    org: '销售演示组织',
    desc: '客户、销售单和收款测试'
  },
  {
    label: '仓库小李',
    phone: '13800000002',
    role: '仓管',
    tenantCode: 'tenant-warehouse-demo',
    tenantName: '仓库演示租户',
    orgCode: 'org-warehouse-demo',
    org: '仓库演示组织',
    desc: '库存、采购和低库存测试'
  },
  {
    label: '财务小陈',
    phone: '13800000003',
    role: '财务',
    tenantCode: 'tenant-finance-demo',
    tenantName: '财务演示租户',
    orgCode: 'org-finance-demo',
    org: '财务演示组织',
    desc: '欠款、超收和资金流水测试'
  }
]

function buildMockTenants(accounts) {
  const tenantMap = {}
  accounts.forEach(account => {
    const tenantCode = account.tenantCode || 'tenant-juyun-main'
    if (!tenantMap[tenantCode]) {
      tenantMap[tenantCode] = {
        code: tenantCode,
        name: account.tenantName || account.org || '聚云掌柜主租户',
        orgCode: account.orgCode || 'org-main',
        orgName: account.org || '聚云掌柜',
        accounts: []
      }
    }
    tenantMap[tenantCode].accounts.push(account)
  })
  return Object.keys(tenantMap).map(code => tenantMap[code])
}

const fallbackMockTenants = buildMockTenants(mockAccounts)

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
  const url = getDefaultTabPath()
  wx.reLaunch({
    url,
    fail() {
      wx.switchTab({ url })
    }
  })
}

function isPhoneVerificationError(message) {
  return /短信验证|手机.*验证|绑定.*手机.*验证|verify/i.test(String(message || ''))
}

function showMockModeNotice() {
  wx.showModal({
    title: '当前是开发登录模式',
    content: '本地后端已开启模拟微信登录。请点“开发环境登录”进入系统；如果要测试真实微信手机号授权，需要先关闭后端 WECHAT_MOCK_LOGIN 并配置微信 AppId 和 AppSecret。',
    showCancel: false
  })
}

function unwrapLoginPayload(response) {
  if (response && response.token && response.currentOrg && response.employee) return response
  if (response && response.data && response.data.token && response.data.currentOrg && response.data.employee) {
    return response.data
  }
  const message = response && response.message && response.message !== 'ok'
    ? response.message
    : '登录返回数据异常，请重试'
  throw new Error(message)
}

Page({
  data: {
    isMockMode,
    mockTenants: fallbackMockTenants,
    mockTenantIndex: 0,
    selectedMockTenant: fallbackMockTenants[0],
    mockTenantAccounts: fallbackMockTenants[0].accounts,
    mockAccountIndex: 0,
    selectedMockAccount: fallbackMockTenants[0].accounts[0],
    loading: false
  },

  onLoad() {
    if (this.data.isMockMode) this.loadMockOptions()
  },

  async loadMockOptions() {
    try {
      const result = await authApi.getMockOptions()
      if (!result || !Array.isArray(result.tenants) || !result.tenants.length) return
      this.applyMockTenants(result.tenants, 0, 0)
    } catch (error) {
      this.applyMockTenants(fallbackMockTenants, 0, 0)
    }
  },

  applyMockTenants(tenants, tenantIndex, accountIndex) {
    const safeTenants = Array.isArray(tenants) && tenants.length ? tenants : fallbackMockTenants
    const selectedTenant = safeTenants[tenantIndex] || safeTenants[0]
    const accounts = selectedTenant && Array.isArray(selectedTenant.accounts) && selectedTenant.accounts.length
      ? selectedTenant.accounts
      : mockAccounts
    const selectedAccount = accounts[accountIndex] || accounts[0]
    this.setData({
      mockTenants: safeTenants,
      mockTenantIndex: tenantIndex || 0,
      selectedMockTenant: selectedTenant,
      mockTenantAccounts: accounts,
      mockAccountIndex: accountIndex || 0,
      selectedMockAccount: selectedAccount
    })
  },

  saveLogin(payload) {
    const loginPayload = unwrapLoginPayload(payload)
    authSession.saveAuth(loginPayload)
    getApp().globalData.auth = loginPayload
    wx.showToast({ title: '登录成功', icon: 'success' })
    setTimeout(goFallback, 300)
  },

  async onGetPhoneNumber(event) {
    if (this.data.loading) return
    if (this.data.isMockMode) {
      showMockModeNotice()
      return
    }

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
    const account = this.data.selectedMockAccount || mockAccounts[0]

    this.setData({ loading: true })
    try {
      const payload = await authApi.wechatPhoneLogin({
        mockPhone: account.phone,
        mockTenantCode: account.tenantCode,
        mockOrgCode: account.orgCode,
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

  onMockTenantChange(event) {
    const index = Number(event.detail.value || 0)
    this.applyMockTenants(this.data.mockTenants, index, 0)
  },

  onMockAccountChange(event) {
    const index = Number(event.detail.value || 0)
    const accounts = this.data.mockTenantAccounts && this.data.mockTenantAccounts.length
      ? this.data.mockTenantAccounts
      : mockAccounts
    this.setData({
      mockAccountIndex: index,
      selectedMockAccount: accounts[index] || accounts[0]
    })
  },

  goBack() {
    goFallback()
  }
})
