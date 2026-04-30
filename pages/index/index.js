const orderStore = require('../../services/order-store')
const productStore = require('../../services/product-store')

const defaultInputText = '给客户黔西-龙凤开个单子，要25玛寸布米色20米、25玛寸布深灰15米、280祥云H513-米10米'
const today = '2026-04-28'

const demoStock = {
  '829-1': 0,
  '829-2': 18,
  '829-3': 42,
  '829-4': 26,
  '831-1': 120,
  '831-2': 60,
  '831-3': 48,
  '831-4': 36
}
const customerPageSize = 12
const selectorPageSize = 12
const recentProductNames = ['25玛寸布', '280祥云', '3公分金线曲牙织带', '38密度海绵5公分']

function formatQuantity(value, unit) {
  const numberValue = Number(value || 0)
  const normalized = Number.isInteger(numberValue)
    ? String(numberValue)
    : String(numberValue).replace(/0+$/, '').replace(/\.$/, '')
  return `${normalized}${unit || ''}`
}

function formatCompactMoney(cents) {
  const value = Number(cents || 0) / 100
  const normalized = Number.isInteger(value)
    ? String(value)
    : value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
  return `¥${normalized}`
}

function getLineAmountCents(line) {
  return Math.round(Number(line.quantityValue || 0) * Number(line.unitPriceCents || 0))
}

function getVariantStock(variant) {
  if (Object.prototype.hasOwnProperty.call(demoStock, variant.id)) return demoStock[variant.id]
  return Number(variant.stockQty || 0)
}

function toCartLine(product, variant, quantityValue, options = {}) {
  const unit = variant.unit || product.unit || '件'
  return {
    id: options.id || `${product.id}-${variant.id}-${Date.now()}`,
    productId: product.id,
    variantId: variant.id,
    name: product.name,
    color: variant.color || '默认',
    spec: variant.color || '默认',
    category: product.category,
    quantityValue: Number(quantityValue || 1),
    unit,
    unitPriceCents: Number(variant.priceCents || 0),
    stockQty: getVariantStock(variant)
  }
}

function normalizeCartLines(lines) {
  const nextLines = lines.map((line, index) => {
    const amountCents = getLineAmountCents(line)
    return {
      ...line,
      amountCents,
      quantity: formatQuantity(line.quantityValue, line.unit),
      quantityText: formatQuantity(line.quantityValue, line.unit),
      unitPriceText: formatCompactMoney(line.unitPriceCents),
      amount: orderStore.formatMoney(amountCents),
      amountText: orderStore.formatMoney(amountCents),
      stockText: `库存 ${line.stockQty}`,
      stockTone: Number(line.stockQty) <= 0 ? 'danger' : 'normal',
      isLast: index === lines.length - 1
    }
  })
  const totalCents = nextLines.reduce((sum, line) => sum + line.amountCents, 0)
  const unit = nextLines[0] && nextLines.every(line => line.unit === nextLines[0].unit)
    ? nextLines[0].unit
    : '项'
  const totalQty = nextLines.reduce((sum, line) => sum + Number(line.quantityValue || 0), 0)

  return {
    cartItems: nextLines,
    totalCents,
    totalAmount: orderStore.formatMoney(totalCents),
    cartItemCount: nextLines.length,
    cartQtyText: `${totalQty}${unit}`
  }
}

function buildInitialCartLines() {
  const products = productStore.getProductList()
  const cloth = products.find(product => product.name === '25玛寸布') || products[0]
  const xiangyun = products.find(product => product.name === '280祥云') || products[1] || products[0]

  return normalizeCartLines([
    toCartLine(cloth, cloth.variants[0], 20, { id: 'cloth-rice' }),
    toCartLine(cloth, cloth.variants[1] || cloth.variants[0], 15, { id: 'cloth-gray' }),
    toCartLine(xiangyun, xiangyun.variants[0], 10, { id: 'xiangyun-rice' })
  ])
}

function toHomeCustomer(customer, index = 0) {
  const code = customer.code || `TC-${String(index + 1).padStart(3, '0')}`
  const name = customer.name || ''
  return {
    id: customer.id || customer.name,
    name,
    shortName: name.length > 6 ? `${name.slice(0, 6)}…` : name,
    code,
    tag: customer.tag || customer.category || '普通客户',
    phone: customer.phone || '',
    address: customer.address || '',
    contractAmount: customer.contractText || orderStore.formatMoney(customer.contractCents || 0),
    receivable: customer.receivableText || orderStore.formatMoney(customer.receivableCents || 0),
    receivableCents: Number(customer.receivableCents || 0),
    prepaidCents: Number(customer.prepaidCents || 0),
    wide: String(customer.name || '').length > 5,
    note: customer.remark || ''
  }
}

function buildCustomerState(selectedCustomer) {
  const allCustomers = orderStore.getCustomerList()
  const selected = selectedCustomer
    ? toHomeCustomer(selectedCustomer)
    : toHomeCustomer(allCustomers.find(customer => customer.name === '黔西-龙凤') || allCustomers[0])
  const quickSource = [selected]
    .concat(allCustomers.map(toHomeCustomer).filter(customer => customer.name !== selected.name))
    .slice(0, 3)

  return {
    currentCustomer: selected,
    customers: quickSource,
    customerOptions: allCustomers.map(toHomeCustomer),
    customerMatchedOptions: allCustomers.map(toHomeCustomer),
    filteredCustomerOptions: allCustomers.slice(0, customerPageSize).map(toHomeCustomer),
    customerListLimit: customerPageSize,
    customerHasMore: allCustomers.length > customerPageSize
  }
}

function getSelectorProductModels(keyword = '', selectedVariantId = '', filter = 'recent') {
  const normalizedKeyword = String(keyword || '').trim().toLowerCase()
  const products = productStore.getProductList()
    .filter(product => {
      const matchesKeyword = !normalizedKeyword || product.searchText.includes(normalizedKeyword)
      if (!matchesKeyword) return false
      if (!normalizedKeyword && filter === 'recent') return recentProductNames.includes(product.name)
      return true
    })

  return products
    .map(product => {
      const variants = product.variants
        .filter(variant => filter !== 'low' || getVariantStock(variant) <= 20)
        .slice(0, 6)
        .map(variant => ({
          id: variant.id,
          productId: product.id,
          color: variant.color || '默认',
          priceText: variant.priceText,
          stockText: String(getVariantStock(variant)),
          selected: variant.id === selectedVariantId
        }))

      return {
        id: product.id,
        name: product.name,
        category: product.category,
        productNo: product.no,
        variants
      }
    })
    .filter(product => product.variants.length)
}

function buildSelectorState(keyword = '', selectedVariantId = '', filter = 'recent', limit = selectorPageSize) {
  const matchedProducts = getSelectorProductModels(keyword, selectedVariantId, filter)
  return {
    selectorProducts: matchedProducts.slice(0, limit),
    selectorListLimit: limit,
    selectorHasMore: matchedProducts.length > limit
  }
}

Page({
  data: {
    currentCustomer: {},
    customers: [],
    customerOptions: [],
    customerMatchedOptions: [],
    filteredCustomerOptions: [],
    customerListLimit: customerPageSize,
    customerHasMore: false,
    activeCustomer: 0,
    switchMessage: '客户切换完成',
    inputText: defaultInputText,
    draftText: '',
    cartItems: [],
    totalCents: 0,
    totalAmount: '¥0',
    cartItemCount: 0,
    cartQtyText: '0项',
    cartSheetVisible: false,
    cartSheetActive: false,
    customerSheetVisible: false,
    customerSheetActive: false,
    customerKeyword: '',
    productSheetVisible: false,
    productSheetActive: false,
    selectorKeyword: '',
    selectorProducts: [],
    selectorTargetLineId: '',
    selectorCurrentLine: null,
    selectorSelectedVariantId: '',
    selectorSelectedProductId: '',
    selectorFilter: 'recent',
    selectorListLimit: selectorPageSize,
    selectorHasMore: false
  },

  onLoad() {
    const customerState = buildCustomerState()
    this.setData({
      ...customerState,
      ...buildInitialCartLines()
    })
  },

  onShow() {
    const app = getApp()
    const selectedCustomer = app.globalData.selectedCustomer
    if (!selectedCustomer) {
      if (!this.hasOpenSheet()) this.restoreNativeTabBar()
      return
    }

    app.globalData.selectedCustomer = null
    const customerState = buildCustomerState(selectedCustomer)
    this.setData({
      ...customerState,
      activeCustomer: 0,
      switchMessage: '客户切换完成',
      inputText: `给客户${customerState.currentCustomer.name}开个单子，要25玛寸布米色20米、25玛寸布深灰15米、280祥云H513-米10米`
    })
  },

  onHide() {
    this.restoreNativeTabBar()
  },

  noop() {},

  syncCart(lines) {
    this.setData(normalizeCartLines(lines))
  },

  hasOpenSheet() {
    return this.data.cartSheetVisible || this.data.customerSheetVisible || this.data.productSheetVisible
  },

  hideNativeTabBar() {
    if (!wx.hideTabBar) return
    wx.hideTabBar({
      animation: true,
      fail() {}
    })
  },

  restoreNativeTabBar() {
    if (!wx.showTabBar) return
    wx.showTabBar({
      animation: true,
      fail() {}
    })
  },

  showSheet(visibleKey, activeKey) {
    this.hideNativeTabBar()
    this.setData({ [visibleKey]: true })
    setTimeout(() => {
      this.setData({ [activeKey]: true })
    }, 20)
  },

  hideSheet(visibleKey, activeKey) {
    this.setData({ [activeKey]: false })
    setTimeout(() => {
      this.setData({ [visibleKey]: false })
      const hasOtherSheet = ['cartSheetVisible', 'customerSheetVisible', 'productSheetVisible']
        .some(key => key !== visibleKey && this.data[key])
      if (!hasOtherSheet) this.restoreNativeTabBar()
    }, 180)
  },

  onCustomerSelect(event) {
    const index = Number(event.detail.index || 0)
    const selected = this.data.customers[index]
    if (!selected) return

    const customerState = buildCustomerState(selected)
    this.setData({
      ...customerState,
      activeCustomer: 0,
      switchMessage: '客户切换完成'
    })
  },

  onMoreCustomers() {
    const matched = this.data.customerOptions
    this.setData({
      customerKeyword: '',
      customerMatchedOptions: matched,
      filteredCustomerOptions: matched.slice(0, customerPageSize),
      customerListLimit: customerPageSize,
      customerHasMore: matched.length > customerPageSize
    })
    this.showSheet('customerSheetVisible', 'customerSheetActive')
  },

  onCloseCustomerSheet() {
    this.hideSheet('customerSheetVisible', 'customerSheetActive')
  },

  onCustomerKeywordInput(event) {
    const keyword = String(event.detail.value || '').trim().toLowerCase()
    const matched = this.data.customerOptions
      .filter(customer => {
        if (!keyword) return true
        return [
          customer.name,
          customer.phone,
          customer.code,
          customer.tag
        ].join(' ').toLowerCase().includes(keyword)
      })

    this.setData({
      customerKeyword: event.detail.value,
      customerMatchedOptions: matched,
      filteredCustomerOptions: matched.slice(0, customerPageSize),
      customerListLimit: customerPageSize,
      customerHasMore: matched.length > customerPageSize
    })
  },

  onCustomerListReachBottom() {
    if (!this.data.customerHasMore) return

    const nextLimit = this.data.customerListLimit + customerPageSize
    const matched = this.data.customerMatchedOptions
    this.setData({
      customerListLimit: nextLimit,
      filteredCustomerOptions: matched.slice(0, nextLimit),
      customerHasMore: matched.length > nextLimit
    })
  },

  onCustomerOptionTap(event) {
    const id = event.currentTarget.dataset.id
    const selected = this.data.customerOptions.find(customer => customer.id === id)
    if (!selected) return

    const customerState = buildCustomerState(selected)
    this.setData({
      ...customerState,
      activeCustomer: 0,
      switchMessage: '客户切换完成'
    })
    this.onCloseCustomerSheet()
  },

  onNewCustomerTap() {
    this.onCloseCustomerSheet()
    setTimeout(() => {
      wx.navigateTo({ url: '/pages/customer-edit/index' })
    }, 180)
  },

  onReceivableTap() {
    wx.navigateTo({
      url: `/pages/customer-receipt/index?id=${encodeURIComponent(this.data.currentCustomer.id || this.data.currentCustomer.name)}`
    })
  },

  onResetSession() {
    this.setData({
      draftText: '',
      switchMessage: '会话已重置'
    })
  },

  onOpenCart() {
    this.showSheet('cartSheetVisible', 'cartSheetActive')
  },

  onCloseCart() {
    this.hideSheet('cartSheetVisible', 'cartSheetActive')
  },

  onCartStepTap(event) {
    const { id, delta } = event.currentTarget.dataset
    const next = this.data.cartItems.map(line => {
      if (line.id !== id) return line
      return {
        ...line,
        quantityValue: Math.max(Number(line.quantityValue || 0) + Number(delta || 0), 1)
      }
    })
    this.syncCart(next)
  },

  onCartQtyInput(event) {
    const id = event.currentTarget.dataset.id
    const value = Math.max(Number(String(event.detail.value || '').replace(/[^\d.]/g, '')) || 1, 1)
    const next = this.data.cartItems.map(line => line.id === id ? { ...line, quantityValue: value } : line)
    this.syncCart(next)
  },

  onRemoveCartItem(event) {
    const id = event.currentTarget.dataset.id
    const next = this.data.cartItems.filter(line => line.id !== id)
    this.syncCart(next)
  },

  onClearCart() {
    this.syncCart([])
  },

  onShareCart() {
    wx.showToast({
      title: '分享单据待接入',
      icon: 'none'
    })
  },

  onAddCartItem() {
    this.openProductSelector('')
  },

  onOpenProductSelector(event) {
    this.openProductSelector(event.currentTarget.dataset.id)
  },

  openProductSelector(lineId) {
    const currentLine = this.data.cartItems.find(line => line.id === lineId) || null
    const selectedVariantId = currentLine ? currentLine.variantId : ''

    this.setData({
      selectorTargetLineId: lineId || '',
      selectorCurrentLine: currentLine,
      selectorKeyword: '',
      selectorFilter: 'recent',
      selectorSelectedVariantId: selectedVariantId,
      selectorSelectedProductId: currentLine ? currentLine.productId : '',
      ...buildSelectorState('', selectedVariantId, 'recent')
    })
    this.showSheet('productSheetVisible', 'productSheetActive')
  },

  onCloseProductSheet() {
    this.hideSheet('productSheetVisible', 'productSheetActive')
  },

  onSelectorKeywordInput(event) {
    const keyword = event.detail.value
    this.setData({
      selectorKeyword: keyword,
      ...buildSelectorState(keyword, this.data.selectorSelectedVariantId, this.data.selectorFilter)
    })
  },

  onSelectorFilterTap(event) {
    const value = event.currentTarget.dataset.value
    this.setData({
      selectorFilter: value,
      ...buildSelectorState(this.data.selectorKeyword, this.data.selectorSelectedVariantId, value)
    })
  },

  onSelectProductVariant(event) {
    const { productId, variantId } = event.currentTarget.dataset
    this.setData({
      selectorSelectedProductId: productId,
      selectorSelectedVariantId: variantId,
      ...buildSelectorState(this.data.selectorKeyword, variantId, this.data.selectorFilter, this.data.selectorListLimit)
    })
  },

  onSelectorListReachBottom() {
    if (!this.data.selectorHasMore) return

    const nextLimit = this.data.selectorListLimit + selectorPageSize
    this.setData({
      ...buildSelectorState(
        this.data.selectorKeyword,
        this.data.selectorSelectedVariantId,
        this.data.selectorFilter,
        nextLimit
      )
    })
  },

  onConfirmProductReplace() {
    const products = productStore.getProductList()
    const product = products.find(item => item.id === this.data.selectorSelectedProductId)
    const variant = product && product.variants.find(item => item.id === this.data.selectorSelectedVariantId)

    if (!product || !variant) {
      wx.showToast({
        title: '请选择商品颜色',
        icon: 'none'
      })
      return
    }

    const targetLineId = this.data.selectorTargetLineId
    const currentLine = this.data.cartItems.find(line => line.id === targetLineId)
    let next
    if (targetLineId && currentLine) {
      next = this.data.cartItems.map(line => {
        if (line.id !== targetLineId) return line
        return toCartLine(product, variant, line.quantityValue, { id: line.id })
      })
    } else {
      next = this.data.cartItems.concat(toCartLine(product, variant, 1, { id: `line-${Date.now()}` }))
    }

    this.syncCart(next)
    this.onCloseProductSheet()
  },

  onDraftChange(event) {
    this.setData({
      draftText: event.detail.value
    })
  },

  onRecognize() {
    const draftText = String(this.data.draftText || '').trim()
    if (!draftText) {
      wx.showToast({
        title: '请输入客户、商品、数量',
        icon: 'none'
      })
      return
    }

    this.setData({
      draftText: '',
      inputText: draftText,
      switchMessage: '识别完成，已加入购物车'
    })
  },

  buildCheckoutDraft() {
    const contractCents = Math.max(this.data.totalCents - 7250, 0)
    const usePrepaidCents = Math.min(8000, contractCents)

    return {
      customer: this.data.currentCustomer,
      items: this.data.cartItems,
      totalCents: this.data.totalCents,
      discountCents: Math.max(this.data.totalCents - contractCents, 0),
      contractCents,
      prepaidCents: 10000,
      usePrepaidCents,
      unpaidCents: Math.max(contractCents - usePrepaidCents, 0),
      warehouse: '默认仓',
      saleDate: today,
      remark: '',
      sourceText: this.data.inputText
    }
  },

  onSubmitCart() {
    if (!this.data.cartItems.length) {
      wx.showToast({
        title: '购物车暂无商品',
        icon: 'none'
      })
      return
    }

    getApp().globalData.pendingCheckoutOrder = this.buildCheckoutDraft()
    this.restoreNativeTabBar()
    wx.navigateTo({ url: '/pages/index/order-confirm' })
  }
})
