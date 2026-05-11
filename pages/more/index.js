const sections = [
  {
    title: '商品与库存',
    desc: '经营主数据和库存动作统一从这里进入',
    tone: 'primary',
    items: [
      { key: 'products', title: '产品管理', icon: '/assets/icons/lucide/ui/layout-grid-blue.svg' },
      { key: 'categories', title: '产品分类', icon: '/assets/icons/lucide/ui/list-dark.svg' },
      { key: 'stock-summary', title: '库存总览', icon: '/assets/icons/lucide/ui/gauge-dark.svg' },
      { key: 'warehouses', title: '仓库管理', icon: '/assets/icons/lucide/ui/warehouse-dark.svg' }
    ]
  },
  {
    title: '采购与往来',
    desc: '供应商、采购和退换按业务链路进入',
    tone: 'warning',
    items: [
      { key: 'customer-categories', title: '客户分类', icon: '/assets/icons/lucide/ui/users-orange.svg' },
      { key: 'suppliers', title: '供应商', icon: '/assets/icons/lucide/ui/handshake-dark.svg' },
      { key: 'purchase-orders', title: '采购单', icon: '/assets/icons/lucide/ui/shopping-bag-orange.svg' },
      { key: 'purchase-returns', title: '退货单', icon: '/assets/icons/lucide/ui/undo-2-dark.svg' }
    ]
  },
  {
    title: '统计报表',
    desc: '统计和报表',
    tone: 'warning',
    items: [
      { key: 'receivable-report', title: '销售欠款总览', icon: '/assets/icons/lucide/ui/receipt-orange.svg' },
      { key: 'product-sales-report', title: '产品销售总览', icon: '/assets/icons/lucide/ui/target-orange.svg' },
      { key: 'customer-sales-report', title: '客户销售总览', icon: '/assets/icons/lucide/ui/users-orange.svg' }
    ]
  }
]

Page({
  data: {
    sections
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
