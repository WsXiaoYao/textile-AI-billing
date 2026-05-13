const { filterByPermission } = require('../../utils/permissions')
const { guardTabAccess } = require('../../utils/tabbar')

const sections = [
  {
    title: '商品与库存',
    desc: '经营主数据和库存动作统一从这里进入',
    tone: 'primary',
    items: [
      { key: 'products', title: '产品管理', icon: '/assets/icons/lucide/ui/layout-grid-blue.svg', permissions: ['products:read'] },
      { key: 'categories', title: '产品分类', icon: '/assets/icons/lucide/ui/list-dark.svg', permissions: ['products:read'] },
      { key: 'stock-summary', title: '库存总览', icon: '/assets/icons/lucide/ui/gauge-dark.svg', permissions: ['inventory:read'] },
      { key: 'warehouses', title: '仓库管理', icon: '/assets/icons/lucide/ui/warehouse-dark.svg', permissions: ['warehouses:read'] }
    ]
  },
  {
    title: '采购与往来',
    desc: '供应商、采购和退换按业务链路进入',
    tone: 'warning',
    items: [
      { key: 'customer-categories', title: '客户分类', icon: '/assets/icons/lucide/ui/users-orange.svg', permissions: ['customers:read'] },
      { key: 'suppliers', title: '供应商', icon: '/assets/icons/lucide/ui/handshake-dark.svg', permissions: ['suppliers:read'] },
      { key: 'purchase-orders', title: '采购单', icon: '/assets/icons/lucide/ui/shopping-bag-orange.svg', permissions: ['purchase:read'] },
      { key: 'purchase-returns', title: '退货单', icon: '/assets/icons/lucide/ui/undo-2-dark.svg', permissions: ['returns:read'] }
    ]
  },
  {
    title: '统计报表',
    desc: '统计和报表',
    tone: 'warning',
    items: [
      { key: 'receivable-report', title: '销售欠款总览', icon: '/assets/icons/lucide/ui/receipt-orange.svg', permissions: ['reports:read', 'sales:read'] },
      { key: 'product-sales-report', title: '产品销售总览', icon: '/assets/icons/lucide/ui/target-orange.svg', permissions: ['reports:read', 'sales:read'] },
      { key: 'customer-sales-report', title: '客户销售总览', icon: '/assets/icons/lucide/ui/users-orange.svg', permissions: ['reports:read', 'customers:read'] }
    ]
  }
]

Page({
  data: {
    sections: []
  },

  onShow() {
    if (!guardTabAccess(this, '/pages/more/index')) return
    this.setData({
      sections: sections
        .map(section => ({
          ...section,
          items: filterByPermission(section.items)
        }))
        .filter(section => section.items.length)
    })
  },

  onToolTap(event) {
    const key = event.currentTarget.dataset.key
    const title = event.currentTarget.dataset.title

    const routeMap = {
      products: '/pages/products/index',
      categories: '/pages/product-categories/index',
      'stock-summary': '/pages/stock-summary/index',
      warehouses: '/pages/warehouses/index',
      'customer-categories': '/pages/customer-categories/index',
      suppliers: '/pages/suppliers/index',
      'purchase-orders': '/pages/purchase-orders/index',
      'purchase-returns': '/pages/purchase-returns/index'
    }

    if (routeMap[key]) {
      wx.navigateTo({ url: routeMap[key] })
      return
    }

    wx.showToast({
      title: `${title}待接入`,
      icon: 'none'
    })
  }
})
