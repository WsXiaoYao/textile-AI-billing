const orderStore = require('../../services/order-store')
const productStore = require('../../services/product-store')

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
const quantityUnits = ['米', '条', '个', '件', '张', '斤', '码', '包', '卷', '片', '套', '支', '只']
const productAliasRules = [
  { name: '25玛寸布', aliases: ['25码的布', '25码布', '25玛寸布', '玛寸布'] },
  { name: '15米塑料打版膜', aliases: ['15米塑料打版膜', '15米塑料', '塑料打版膜', '打版膜'] },
  { name: '38密度海绵5公分', aliases: ['38密度海绵5公分', '38密度海绵', '海绵5公分', '38密度'] },
  { name: '皇冠双色大边', aliases: ['皇冠双色大边', '双色大边'] },
  { name: '虎牙中边织带', aliases: ['虎牙中边织带', '虎牙织带'] },
  { name: '法国绒双线', aliases: ['法国绒双线', '法国荣双谢'] }
]
const customerAliasRules = [
  { name: '云南-徐加飞', aliases: ['云南老徐', '云南徐加飞', '老徐'] },
  { name: '镇雄五德镇-唐修碧', aliases: ['镇雄五德镇唐姐', '唐姐', '镇雄五德镇唐修碧'] },
  { name: '纳雍县百兴镇-何琴飞（华盛通）', aliases: ['纳雍百兴镇何琴飞华盛通', '纳雍百兴镇何琴飞', '何琴飞华盛通'] }
]

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
  const unit = options.unit || variant.unit || product.unit || '件'
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

function normalizeKeyword(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[，,。.;；:：、/\\|()（）【】\[\]{}<>《》\-－—_]/g, '')
}

function getProductAliases(product) {
  const rule = productAliasRules.find(item => item.name === product.name)
  return [product.name].concat(rule ? rule.aliases : [])
    .map(alias => normalizeKeyword(alias))
    .filter(alias => alias && alias.length >= 2)
}

function trimColorSuffix(value) {
  return String(value || '').replace(/色$/, '')
}

function getVariantAliases(product, variant) {
  const color = String(variant.color || '默认')
  const normalizedProductName = normalizeKeyword(product.name)
  const aliases = [
    color,
    trimColorSuffix(color),
    color.replace(product.name, ''),
    color.split('-').pop(),
    trimColorSuffix(color.split('-').pop()),
    color.split('－').pop(),
    trimColorSuffix(color.split('－').pop())
  ]

  const normalizedColor = normalizeKeyword(color)
  if (normalizedProductName && normalizedColor.startsWith(normalizedProductName)) {
    aliases.push(normalizedColor.slice(normalizedProductName.length))
  }
  if (color === '咖') aliases.push('咖色')
  if (product.name === '280祥云' && color === 'H516-灰蓝') aliases.push('灰')

  return aliases
    .map(alias => normalizeKeyword(alias))
    .filter(alias => alias && (alias.length >= 2 || alias === '灰'))
}

function findCustomerInText(text) {
  const normalizedText = normalizeKeyword(text)
  const customers = orderStore.getCustomerList()

  for (const rule of customerAliasRules) {
    if (rule.aliases.some(alias => normalizedText.includes(normalizeKeyword(alias)))) {
      const customer = customers.find(item => item.name === rule.name)
      if (customer) return customer
    }
  }

  return customers
    .filter(customer => {
      const name = normalizeKeyword(customer.name)
      const phone = normalizeKeyword(customer.phone)
      return (name && normalizedText.includes(name)) || (phone && normalizedText.includes(phone))
    })
    .sort((a, b) => String(b.name || '').length - String(a.name || '').length)[0] || null
}

function findProductInSegment(segment, products, currentProduct) {
  const normalizedSegment = normalizeKeyword(segment)
  const matched = products.find(product => getProductAliases(product).some(alias => normalizedSegment.includes(alias)))
  return matched || currentProduct || null
}

function findVariantInSegment(segment, product) {
  const normalizedSegment = normalizeKeyword(segment)
  const variants = product.variants || []
  return variants.find(variant => {
    return getVariantAliases(product, variant).some(alias => alias && normalizedSegment.includes(alias))
  }) || variants[0]
}

function getMentionedVariants(segment, product) {
  const normalizedSegment = normalizeKeyword(segment)
  const mentions = (product.variants || [])
    .map(variant => {
      const aliases = getVariantAliases(product, variant)
      const matchedAlias = aliases
        .map(alias => ({ alias, index: normalizedSegment.indexOf(alias) }))
        .filter(item => item.index >= 0)
        .sort((a, b) => b.alias.length - a.alias.length)[0]
      return matchedAlias ? { variant, alias: matchedAlias.alias, index: matchedAlias.index } : null
    })
    .filter(Boolean)
    .sort((a, b) => a.index - b.index)

  return mentions.filter((mention, index) => {
    const previous = mentions.slice(0, index).find(item => {
      return mention.index >= item.index && mention.index < item.index + item.alias.length
    })
    return !previous
  })
}

function getEachQuantity(segment) {
  const unitPattern = quantityUnits.join('|')
  const match = String(segment || '').match(new RegExp(`各(?:要|来)?\\s*(\\d+(?:\\.\\d+)?)\\s*(${unitPattern})`))
  if (!match) return null
  return {
    quantityValue: Number(match[1] || 1),
    unit: match[2]
  }
}

function hasQuantityText(segment) {
  const unitPattern = quantityUnits.join('|')
  return new RegExp(`\\d+(?:\\.\\d+)?\\s*(${unitPattern})`).test(String(segment || ''))
}

function getQuantityAfterVariant(segment, mention, product, variant, fallbackQuantity) {
  if (fallbackQuantity) return fallbackQuantity

  const normalizedSegment = normalizeKeyword(segment)
  const tail = normalizedSegment.slice(mention.index + mention.alias.length)
  const unitPattern = quantityUnits.join('|')
  const match = tail.match(new RegExp(`^(?:要|来)?(\\d+(?:\\.\\d+)?)(${unitPattern})`))
    || tail.match(new RegExp(`(?:要|来)?(\\d+(?:\\.\\d+)?)(${unitPattern})`))

  if (match) {
    return {
      quantityValue: Number(match[1] || 1),
      unit: match[2] || variant.unit || product.unit || '件'
    }
  }

  return parseQuantity(segment, product, variant)
}

function parseQuantity(segment, product, variant) {
  const unitPattern = quantityUnits.join('|')
  const quantityRegExp = new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(${unitPattern})`, 'g')
  const matches = []
  let match = quantityRegExp.exec(segment)
  while (match) {
    matches.push(match)
    match = quantityRegExp.exec(segment)
  }

  if (matches.length) {
    return {
      quantityValue: Number(matches[matches.length - 1][1] || 1),
      unit: matches[matches.length - 1][2] || variant.unit || product.unit || '件'
    }
  }

  const productIndex = segment.indexOf(product.name)
  const tail = productIndex >= 0 ? segment.slice(productIndex + product.name.length) : segment
  const numberMatch = tail.match(/(\d+(?:\.\d+)?)/)
  return {
    quantityValue: Number(numberMatch ? numberMatch[1] : 1),
    unit: variant.unit || product.unit || '件'
  }
}

function parseSegmentLines(segment, product, indexSeed) {
  const mentions = getMentionedVariants(segment, product)
  const eachQuantity = getEachQuantity(segment)

  if (mentions.length) {
    return mentions.map((mention, index) => {
      const parsedQty = getQuantityAfterVariant(segment, mention, product, mention.variant, eachQuantity)
      return toCartLine(product, mention.variant, parsedQty.quantityValue, {
        id: `recognized-${Date.now()}-${indexSeed}-${index}`,
        unit: parsedQty.unit
      })
    })
  }

  const variant = findVariantInSegment(segment, product)
  const parsedQty = parseQuantity(segment, product, variant)
  if (product.name === '25玛寸布' && parsedQty.unit === '码') {
    return []
  }
  return [toCartLine(product, variant, parsedQty.quantityValue, {
    id: `recognized-${Date.now()}-${indexSeed}`,
    unit: parsedQty.unit
  })]
}

function parseOrderText(text) {
  const products = productStore.getProductList()
    .slice()
    .sort((a, b) => String(b.name || '').length - String(a.name || '').length)
  const segments = String(text || '')
    .split(/[，,、;；\n]+/)
    .map(item => item.trim())
    .filter(Boolean)
  const items = []
  const warnings = []
  const pendingItems = []
  const unrecognizedSegments = []
  let currentProduct = null
  let pendingSegments = []

  segments.forEach((segment, index) => {
    const product = findProductInSegment(segment, products, currentProduct)
    if (!product) {
      unrecognizedSegments.push(segment)
      return
    }
    if (product !== currentProduct) pendingSegments = []
    currentProduct = product

    const mentions = getMentionedVariants(segment, product)
    const hasQuantity = hasQuantityText(segment)
    const eachQuantity = getEachQuantity(segment)

    if (!mentions.length && hasQuantity && (product.variants || []).length > 1) {
      const fallbackVariant = product.variants[0]
      const parsedQty = parseQuantity(segment, product, fallbackVariant)
      pendingItems.push({
        id: `pending-${Date.now()}-${index}`,
        product,
        segment,
        quantityValue: parsedQty.quantityValue,
        unit: parsedQty.unit,
        question: `第一条 ${product.name} 要哪个规格/颜色？`
      })
      return
    }

    if (mentions.length && !hasQuantity && !eachQuantity) {
      pendingSegments.push(segment)
      return
    }

    const parseSource = eachQuantity && pendingSegments.length
      ? pendingSegments.concat(segment).join('、')
      : segment
    if (eachQuantity) pendingSegments = []

    const lines = parseSegmentLines(parseSource, product, index)
    lines.forEach(line => {
      items.push(line)
      if (Number(line.stockQty) <= 0) {
        warnings.push(`${line.name}${line.color ? `/${line.color}` : ''} 库存为 0`)
      }
    })
  })

  return {
    customer: findCustomerInText(text),
    items,
    pendingItems,
    unrecognizedSegments,
    warnings,
    rawText: text
  }
}

function getLineProductNames(lines) {
  const names = []
  lines.forEach(line => {
    if (line.name && !names.includes(line.name)) names.push(line.name)
  })
  return names
}

function buildRecognitionCard(result, status = 'success') {
  const productNames = getLineProductNames(result.items)
  const recognizedParts = []
  if (result.customer) recognizedParts.push(`客户：${result.customer.name}`)
  if (productNames.length) recognizedParts.push(`商品：${productNames.join('、')}`)

  if (status === 'pending') {
    const pending = result.pendingItems[0]
    const waitingText = pending
      ? `${pending.product.name} 缺少规格/颜色，数量 ${formatQuantity(pending.quantityValue, pending.unit)}`
      : (result.warnings && result.warnings.length ? result.warnings.join('；') : '还有信息需要补充')
    return {
      visible: true,
      tone: 'pending',
      title: '识别到部分信息，需确认',
      badge: '待客户确认',
      recognizedText: recognizedParts.length ? recognizedParts.join('　') : '已识别部分开单信息',
      waitingText,
      hintText: pending ? pending.question : '本次识别存在库存异常，请先调整商品或数量。',
      footText: '确认前不加入购物车，补齐后再显示最终卡片。'
    }
  }

  if (status === 'failed') {
    return {
      visible: true,
      tone: 'failed',
      title: '未识别到商品信息',
      badge: '待补充',
      recognizedText: result.customer ? `已识别客户：${result.customer.name}` : '客户和商品都还不明确',
      waitingText: result.unrecognizedSegments.length ? `未识别：${result.unrecognizedSegments.join('、')}` : '请输入品名、规格/颜色和数量',
      hintText: '可以像聊天一样补一句：25玛寸布米色20米。',
      footText: '补充后点击识别，系统会继续尝试解析。'
    }
  }

  return {
    visible: true,
    tone: 'success',
    title: '已识别并加入购物车',
    badge: '已加入',
    recognizedText: recognizedParts.length ? recognizedParts.join('　') : '已识别商品明细',
    waitingText: `本次识别 ${result.items.length} 条明细`,
    hintText: result.warnings.length ? result.warnings[0] : '可点击卡片进入购物车调整。',
    footText: ''
  }
}

function buildPendingRecognition(result) {
  const pending = result.pendingItems[0]
  if (!pending) return null
  return {
    customer: result.customer,
    items: result.items,
    pendingItem: pending,
    rawText: result.rawText
  }
}

function isClarificationOnlyText(text) {
  const value = String(text || '').trim()
  if (!value) return false
  if (hasQuantityText(value)) return false
  return /(第.{0,4}条|颜色|规格|是|换成|改成)/.test(value)
}

function mergeCartLines(currentLines, recognizedLines) {
  const nextLines = currentLines.slice()

  recognizedLines.forEach(line => {
    const index = nextLines.findIndex(item => item.productId === line.productId && item.variantId === line.variantId)
    if (index >= 0) {
      nextLines[index] = {
        ...nextLines[index],
        quantityValue: Number(nextLines[index].quantityValue || 0) + Number(line.quantityValue || 0)
      }
      return
    }
    nextLines.push(line)
  })

  return nextLines
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
  return normalizeCartLines([])
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
    switchMessage: '输入后点击识别',
    recognitionCard: null,
    pendingRecognition: null,
    inputText: '',
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
      recognitionCard: null,
      pendingRecognition: null,
      inputText: ''
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
      inputText: '',
      switchMessage: '会话已重置',
      recognitionCard: null,
      pendingRecognition: null,
      ...normalizeCartLines([])
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

    if (this.data.pendingRecognition) {
      const pending = this.data.pendingRecognition
      const pendingItem = pending.pendingItem
      const variant = findVariantInSegment(draftText, pendingItem.product)
      const hasMatchedVariant = getMentionedVariants(draftText, pendingItem.product)
        .some(mention => mention.variant.id === variant.id)

      if (!hasMatchedVariant) {
        this.setData({
          inputText: draftText,
          draftText: '',
          recognitionCard: {
            visible: true,
            tone: 'pending',
            title: '还需要确认规格/颜色',
            badge: '待客户确认',
            recognizedText: `商品：${pendingItem.product.name}`,
            waitingText: pendingItem.question,
            hintText: '可以回复：第一条是米色，或者直接说深灰。',
            footText: '确认前不会加入购物车。'
          }
        })
        return
      }

      const confirmedLine = toCartLine(pendingItem.product, variant, pendingItem.quantityValue, {
        id: `confirmed-${Date.now()}`,
        unit: pendingItem.unit
      })
      const confirmedResult = {
        customer: pending.customer,
        items: pending.items.concat(confirmedLine),
        warnings: Number(confirmedLine.stockQty) <= 0 ? [`${confirmedLine.name}/${confirmedLine.color} 库存为 0`] : [],
        rawText: `${pending.rawText}\n${draftText}`,
        pendingItems: [],
        unrecognizedSegments: []
      }
      const nextState = {}
      if (confirmedResult.customer) {
        Object.assign(nextState, buildCustomerState(confirmedResult.customer), { activeCustomer: 0 })
      }
      if (confirmedResult.warnings.length) {
        this.setData({
          ...nextState,
          draftText: '',
          inputText: draftText,
          pendingRecognition: pending,
          recognitionCard: buildRecognitionCard(confirmedResult, 'pending'),
          switchMessage: '识别到库存异常，未加入购物车'
        })
        wx.showToast({
          title: confirmedResult.warnings[0],
          icon: 'none'
        })
        return
      }
      const mergedLines = mergeCartLines(this.data.cartItems, confirmedResult.items)
      this.setData({
        ...nextState,
        draftText: '',
        inputText: draftText,
        pendingRecognition: null,
        recognitionCard: buildRecognitionCard(confirmedResult, 'success'),
        switchMessage: `已补齐，加入 ${confirmedResult.items.length} 条明细`,
        ...normalizeCartLines(mergedLines)
      })
      return
    }

    if (isClarificationOnlyText(draftText)) {
      this.setData({
        inputText: draftText,
        draftText: '',
        recognitionCard: {
          visible: true,
          tone: 'failed',
          title: '没有可补充的识别结果',
          badge: '待补充',
          recognizedText: '当前没有上一轮待确认的开单内容',
          waitingText: `无法单独识别：${draftText}`,
          hintText: '请先输入完整开单内容，出现待确认卡片后再补充颜色或规格。',
          footText: '例如：给黔西-龙凤开单，25玛寸布20米、深灰15米。'
        },
        switchMessage: '缺少上一轮待确认上下文'
      })
      wx.showToast({
        title: '请先输入完整开单内容',
        icon: 'none'
      })
      return
    }

    const result = parseOrderText(draftText)
    if (result.pendingItems.length || result.warnings.length) {
      const nextState = {}
      if (result.customer) {
        Object.assign(nextState, buildCustomerState(result.customer), { activeCustomer: 0 })
      }
      this.setData({
        ...nextState,
        draftText: '',
        inputText: draftText,
        pendingRecognition: result.pendingItems.length ? buildPendingRecognition(result) : null,
        recognitionCard: buildRecognitionCard(result, 'pending'),
        switchMessage: result.pendingItems.length ? '识别到部分信息，需确认' : '识别到库存异常，未加入购物车'
      })
      if (result.warnings.length && !result.pendingItems.length) {
        wx.showToast({
          title: result.warnings[0],
          icon: 'none'
        })
      }
      return
    }

    if (!result.items.length) {
      this.setData({
        inputText: draftText,
        draftText: '',
        pendingRecognition: null,
        recognitionCard: buildRecognitionCard(result, 'failed'),
        switchMessage: '未识别到商品，请补充品名、颜色和数量'
      })
      wx.showToast({
        title: '未识别到商品',
        icon: 'none'
      })
      return
    }

    const nextState = {}
    if (result.customer) {
      Object.assign(nextState, buildCustomerState(result.customer), { activeCustomer: 0 })
    }

    const mergedLines = mergeCartLines(this.data.cartItems, result.items)
    const warningText = result.warnings.length
      ? `已识别 ${result.items.length} 条，部分低库存`
      : `已识别 ${result.items.length} 条并加入购物车`

    if (result.warnings.length) {
      wx.showToast({
        title: result.warnings[0],
        icon: 'none'
      })
    }

    this.setData({
      ...nextState,
      draftText: '',
      inputText: draftText,
      pendingRecognition: null,
      recognitionCard: buildRecognitionCard(result, 'success'),
      switchMessage: warningText,
      ...normalizeCartLines(mergedLines)
    })
  },

  buildCheckoutDraft() {
    const contractCents = this.data.totalCents
    const prepaidCents = Number(this.data.currentCustomer.prepaidCents || 0)

    return {
      customer: this.data.currentCustomer,
      items: this.data.cartItems,
      totalCents: this.data.totalCents,
      discountCents: 0,
      contractCents,
      prepaidCents,
      usePrepaidCents: 0,
      unpaidCents: contractCents,
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
