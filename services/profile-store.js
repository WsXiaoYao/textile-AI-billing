const profileStorageKey = 'textile_profile_v1'
const receiptStorageKey = 'textile_org_receipt_code_v1'
const messageStore = require('./message-store')

const defaultUser = {
  name: '王姐',
  phone: '1358270496',
  role: '老板'
}

const organizations = [
  {
    id: 'org-main',
    name: '聚云纺织',
    desc: '纺织面料 · 3 个仓库 · 老板',
    role: '老板',
    warehouseCount: 3,
    permissionText: '3 个仓库',
    receiptStatus: '已设置收款码'
  },
  {
    id: 'org-fabric',
    name: '聚云辅料',
    desc: '辅料业务组织 · 2 个仓库',
    role: '采购员',
    warehouseCount: 2,
    permissionText: '2 个仓库',
    receiptStatus: '可切换'
  },
  {
    id: 'org-home',
    name: '聚云家纺',
    desc: '家纺订单组织 · 财务可见',
    role: '财务',
    warehouseCount: 1,
    permissionText: '1 个仓库',
    receiptStatus: '可切换'
  }
]

function canUseStorage() {
  return typeof wx !== 'undefined' && wx.getStorageSync && wx.setStorageSync
}

function loadProfileState() {
  if (!canUseStorage()) return { currentOrgId: organizations[0].id }
  const stored = wx.getStorageSync(profileStorageKey)
  if (stored && stored.currentOrgId) return stored
  const initial = { currentOrgId: organizations[0].id }
  wx.setStorageSync(profileStorageKey, initial)
  return initial
}

function saveProfileState(state) {
  if (!canUseStorage()) return
  wx.setStorageSync(profileStorageKey, state)
}

function getCurrentOrg() {
  const state = loadProfileState()
  return organizations.find(org => org.id === state.currentOrgId) || organizations[0]
}

function getOrganizations(keyword = '') {
  const activeOrg = getCurrentOrg()
  const normalizedKeyword = String(keyword || '').trim().toLowerCase()
  return organizations
    .filter(org => !normalizedKeyword || [org.name, org.desc, org.role].join(' ').toLowerCase().includes(normalizedKeyword))
    .map(org => ({
      ...org,
      active: org.id === activeOrg.id,
      actionText: org.id === activeOrg.id ? '当前' : '可切换',
      actionTone: org.id === activeOrg.id ? 'success' : 'primary'
    }))
}

function switchOrganization(orgId) {
  const target = organizations.find(org => org.id === orgId) || organizations[0]
  saveProfileState({ currentOrgId: target.id })
  return target
}

function getProfileHome() {
  const org = getCurrentOrg()
  const messageStats = messageStore.getMessageStats()
  return {
    user: defaultUser,
    org,
    settings: [
      { key: 'receipt-code', title: '收款码设置', icon: '/assets/icons/lucide/ui/qr-code-blue.svg', tone: 'primary' },
      { key: 'staff-permission', title: '员工权限', icon: '/assets/icons/lucide/ui/users-green.svg', tone: 'success' },
      { key: 'print-settings', title: '打印设置', icon: '/assets/icons/lucide/ui/printer-orange.svg', tone: 'warning' },
      { key: 'message-center', title: '消息中心', icon: '/assets/icons/lucide/ui/bell-dark.svg', tone: 'primary', badge: messageStats.unread }
    ],
    helps: [
      { key: 'manual', title: '操作手册', icon: '/assets/icons/lucide/ui/file-text-purple.svg', tone: 'purple' },
      { key: 'support', title: '套餐购买', icon: '/assets/icons/lucide/ui/shield-check-green.svg', tone: 'success' }
    ]
  }
}

function getReceiptSettings() {
  const org = getCurrentOrg()
  if (!canUseStorage()) {
    return {
      org,
      imagePath: '',
      note: '门店统一收款码，打印模板与分享票据优先使用。'
    }
  }

  const stored = wx.getStorageSync(receiptStorageKey) || {}
  const settings = stored[org.id] || {}
  return {
    org,
    imagePath: settings.imagePath || '',
    note: settings.note || '门店统一收款码，打印模板与分享票据优先使用。'
  }
}

function saveReceiptSettings(settings) {
  const org = getCurrentOrg()
  if (canUseStorage()) {
    const stored = wx.getStorageSync(receiptStorageKey) || {}
    stored[org.id] = {
      imagePath: settings.imagePath || '',
      note: String(settings.note || '').trim()
    }
    wx.setStorageSync(receiptStorageKey, stored)
  }

  return getReceiptSettings()
}

module.exports = {
  getCurrentOrg,
  getOrganizations,
  getProfileHome,
  getReceiptSettings,
  saveReceiptSettings,
  switchOrganization
}
