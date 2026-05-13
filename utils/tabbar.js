const { hasPermission, canUseAny } = require('./permissions')

const tabItems = [
  {
    key: 'home',
    text: '首页',
    pagePath: '/pages/index/index',
    iconPath: '/assets/tabbar/home.png',
    selectedIconPath: '/assets/tabbar/home-active.png',
    permissions: ['sales:write']
  },
  {
    key: 'orders',
    text: '订单',
    pagePath: '/pages/orders/index',
    iconPath: '/assets/tabbar/orders.png',
    selectedIconPath: '/assets/tabbar/orders-active.png',
    permissions: ['sales:read']
  },
  {
    key: 'customers',
    text: '客户',
    pagePath: '/pages/customers/index',
    iconPath: '/assets/tabbar/customers.png',
    selectedIconPath: '/assets/tabbar/customers-active.png',
    permissions: ['customers:read']
  },
  {
    key: 'more',
    text: '更多',
    pagePath: '/pages/more/index',
    iconPath: '/assets/tabbar/more.png',
    selectedIconPath: '/assets/tabbar/more-active.png',
    permissions: [
      'products:read',
      'inventory:read',
      'warehouses:read',
      'suppliers:read',
      'purchase:read',
      'returns:read',
      'reports:read'
    ]
  },
  {
    key: 'profile',
    text: '我的',
    pagePath: '/pages/profile/index',
    iconPath: '/assets/tabbar/profile.png',
    selectedIconPath: '/assets/tabbar/profile-active.png',
    permissions: []
  }
]

function normalizePath(path = '') {
  const text = String(path || '')
  return text.startsWith('/') ? text : `/${text}`
}

function canAccessTab(item) {
  const permissions = Array.isArray(item.permissions) ? item.permissions : []
  if (!permissions.length) return true
  return canUseAny(permissions)
}

function getVisibleTabs() {
  return tabItems.filter(canAccessTab)
}

function getDefaultTabPath() {
  const tabs = getVisibleTabs()
  return tabs.length ? tabs[0].pagePath : '/pages/profile/index'
}

function canAccessTabPath(path) {
  const normalized = normalizePath(path)
  const item = tabItems.find(tab => tab.pagePath === normalized)
  return item ? canAccessTab(item) : true
}

function refreshTabBar(page, currentPath) {
  if (!page || typeof page.getTabBar !== 'function') return
  const tabBar = page.getTabBar()
  if (tabBar && typeof tabBar.refresh === 'function') {
    tabBar.refresh(normalizePath(currentPath || ''))
  }
}

function guardTabAccess(page, currentPath) {
  const normalized = normalizePath(currentPath)
  if (canAccessTabPath(normalized)) {
    refreshTabBar(page, normalized)
    return true
  }
  wx.switchTab({ url: getDefaultTabPath() })
  return false
}

module.exports = {
  canAccessTabPath,
  getDefaultTabPath,
  getVisibleTabs,
  guardTabAccess,
  hasPermission,
  refreshTabBar,
  tabItems
}
