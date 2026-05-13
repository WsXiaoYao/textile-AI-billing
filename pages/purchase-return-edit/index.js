const returnApi = require('../../api/return-api')
const validator = require('../../utils/form-validation')

const emptyForm = {
  mode: 'create',
  id: '',
  no: '',
  salesOrderId: '',
  salesOrderNo: '',
  sourceText: '未关联销售单',
  customerId: '',
  customerName: '',
  customerPhone: '',
  customerAddress: '',
  date: '',
  warehouseId: '',
  warehouseName: '',
  refundCents: 0,
  refundInput: '0.00',
  refundText: '¥0.00',
  returnToPrepay: false,
  remark: '',
  items: [],
  itemAmountCents: 0,
  itemAmountText: '¥0.00',
  statusKey: 'pending',
  statusText: '未退款',
  statusTone: 'danger'
}

function formatMoney(cents) {
  const absCents = Math.abs(Number(cents || 0))
  const yuan = Math.floor(absCents / 100)
  const fen = absCents % 100
  const sign = Number(cents || 0) < 0 ? '-' : ''
  return `${sign}¥${String(yuan).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}${fen ? `.${String(fen).padStart(2, '0')}` : ''}`
}

function formatAmountInput(cents) {
  return (Number(cents || 0) / 100).toFixed(2)
}

function formatNumber(value) {
  const number = Number(value || 0)
  if (Number.isInteger(number)) return String(number)
  return String(Number(number.toFixed(2)))
}

function parseAmountInput(value) {
  return Math.round(Number(String(value || '').replace(/[^\d.]/g, '') || 0) * 100)
}

function parseQty(value) {
  const number = Number(String(value || '').replace(/[^\d.]/g, ''))
  return Number.isFinite(number) ? number : 0
}

function normalizeLine(line, index = 0) {
  const quantity = Number(line.quantity || 0)
  const unitPriceCents = Number(line.unitPriceCents || line.unitCents || 0)
  const amountCents = Math.round(quantity * unitPriceCents)
  const unit = line.unit || '件'
  return {
    ...line,
    id: line.id || `line-${Date.now()}-${index}`,
    quantity,
    quantityInput: formatNumber(quantity),
    quantityText: `${formatNumber(quantity)} ${unit}`,
    unitPriceCents,
    unitPriceInput: formatAmountInput(unitPriceCents),
    unitPriceText: formatMoney(unitPriceCents),
    amountCents,
    amountText: formatMoney(amountCents),
    stockText: line.stockText || `库存 ${formatNumber(line.stockQty || 0)}${unit}`
  }
}

function createLineFromOption(option) {
  return normalizeLine({
    id: `line-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    productId: option.productId,
    variantId: option.variantId,
    productName: option.productName,
    color: option.color,
    unit: option.unit,
    stockQty: option.stockQty,
    quantity: 1,
    unitPriceCents: option.priceCents
  })
}

function stripLineViewState(line) {
  const {
    variantOptions,
    productIndex,
    variantIndex,
    selected,
    quantityInput,
    unitPriceInput,
    quantityText,
    unitPriceText,
    amountText,
    stockText,
    amountCents,
    ...rest
  } = line
  return rest
}

function stripFormViewState(form) {
  const {
    refundInput,
    refundText,
    itemAmountText,
    itemAmountCents,
    statusText,
    statusTone,
    refundDirectionText,
    searchText,
    itemSummary,
    itemCount,
    ...rest
  } = form
  return {
    ...rest,
    items: (form.items || []).map(stripLineViewState)
  }
}

function normalizeItems(items) {
  return items.map((item, index) => normalizeLine(stripLineViewState(item), index))
}

function buildProductChoices(productOptions) {
  const choiceMap = {}
  const choices = []
  productOptions.forEach(option => {
    if (!choiceMap[option.productId]) {
      choiceMap[option.productId] = {
        id: option.productId,
        productNo: option.productNo,
        name: option.productName,
        category: option.categoryLeaf || '未分类',
        categoryPathText: option.categoryPathText || '',
        searchText: '',
        variants: []
      }
      choices.push(choiceMap[option.productId])
    }
    const nextOption = {
      ...option,
      stockText: `${option.stockQty}${option.unit}`,
      priceText: formatMoney(option.priceCents)
    }
    choiceMap[option.productId].variants.push(nextOption)
    choiceMap[option.productId].searchText = [
      choiceMap[option.productId].name,
      choiceMap[option.productId].productNo,
      choiceMap[option.productId].category,
      choiceMap[option.productId].categoryPathText,
      choiceMap[option.productId].variants.map(item => `${item.color} ${item.searchText}`).join(' ')
    ].join(' ').toLowerCase()
  })
  return choices
}

function getOptionStockText(option) {
  return `${option.stockQty}${option.unit}`
}

function getLineOptionView(line, productChoices) {
  const productIndex = Math.max(0, productChoices.findIndex(product => product.id === line.productId))
  const product = productChoices[productIndex] || { variants: [] }
  const variantOptions = product.variants || []
  const variantIndex = Math.max(0, variantOptions.findIndex(variant => variant.variantId === line.variantId))
  return {
    ...line,
    productIndex,
    variantIndex,
    variantOptions
  }
}

function applyOptionToLine(line, option) {
  return {
    ...line,
    productId: option.productId,
    variantId: option.variantId,
    productName: option.productName,
    color: option.color,
    unit: option.unit,
    stockQty: option.stockQty,
    unitPriceCents: option.priceCents
  }
}

function recalcForm(form, productChoices) {
  const items = normalizeItems(form.items || [])
  const itemAmountCents = items.reduce((sum, item) => sum + item.amountCents, 0)
  return {
    ...form,
    refundInput: formatAmountInput(form.refundCents || 0),
    refundText: formatMoney(form.refundCents || 0),
    itemAmountCents,
    itemAmountText: formatMoney(itemAmountCents),
    items: items.map(item => getLineOptionView(item, productChoices || []))
  }
}

Page({
  data: {
    form: emptyForm,
    customerOptions: [],
    customerIndex: 0,
    warehouseOptions: [],
    warehouseIndex: 0,
    productOptions: [],
    productChoices: [],
    selectorVisible: false,
    selectorActive: false,
    selectorLineId: '',
    selectorKeyword: '',
    selectorLineSummary: null,
    selectorProducts: [],
    selectorTotal: 0,
    selectorHasMore: false
  },

  onLoad(options = {}) {
    this.salesOrderId = options.salesOrderId || ''
    this.loadForm(options.id, this.salesOrderId)
  },

  onUnload() {
    this.clearSelectorTimer()
  },

  async loadForm(id, salesOrderId) {
    try {
      const [customerOptions, warehouseOptions, productOptions, formData] = await Promise.all([
        returnApi.getCustomerOptions(),
        returnApi.getWarehouseOptions(),
        returnApi.getProductOptions({ limit: 220 }),
        returnApi.getReturnOrderForm(id, salesOrderId ? { salesOrderId } : undefined)
      ])
      const productChoices = buildProductChoices(productOptions || [])
      const initialForm = {
        ...emptyForm,
        ...(formData || {}),
        items: (formData && formData.items && formData.items.length)
          ? formData.items
          : ((productOptions && productOptions[0]) ? [createLineFromOption(productOptions[0])] : [])
      }
      const form = recalcForm(initialForm, productChoices)
      if (!form.refundCents && form.itemAmountCents) {
        form.refundCents = form.itemAmountCents
        form.refundInput = formatAmountInput(form.itemAmountCents)
        form.refundText = formatMoney(form.itemAmountCents)
      }
      const customerIndex = Math.max(0, (customerOptions || []).findIndex(item => item.id === form.customerId || item.name === form.customerName))
      const warehouseIndex = Math.max(0, (warehouseOptions || []).findIndex(item => item.id === form.warehouseId || item.name === form.warehouseName))

      this.setData({
        form,
        customerOptions: customerOptions || [],
        customerIndex,
        warehouseOptions: warehouseOptions || [],
        warehouseIndex,
        productOptions: productOptions || [],
        productChoices
      })
    } catch (error) {
      wx.showToast({ title: error.message || '退货单加载失败', icon: 'none' })
    }
  },

  setForm(nextForm) {
    this.setData({
      form: recalcForm(nextForm, this.data.productChoices)
    })
  },

  onCustomerChange(event) {
    const customerIndex = Number(event.detail.value || 0)
    const customer = this.data.customerOptions[customerIndex]
    this.setData({
      customerIndex,
      form: {
        ...this.data.form,
        customerId: customer.id,
        customerName: customer.name,
        customerPhone: customer.phone,
        customerAddress: customer.address
      }
    })
  },

  onDateChange(event) {
    this.setForm({
      ...this.data.form,
      date: event.detail.value
    })
  },

  onRefundInput(event) {
    this.setForm({
      ...this.data.form,
      refundCents: parseAmountInput(validator.normalizeDecimalInput(event.detail.value, { maxDecimal: 2 }))
    })
  },

  onPrepayChange(event) {
    this.setForm({
      ...this.data.form,
      returnToPrepay: Boolean(event.detail.value)
    })
  },

  onWarehouseChange(event) {
    const warehouseIndex = Number(event.detail.value || 0)
    const warehouse = this.data.warehouseOptions[warehouseIndex]
    this.setData({
      warehouseIndex,
      form: {
        ...this.data.form,
        warehouseId: warehouse.id,
        warehouseName: warehouse.name
      }
    })
  },

  onRemarkInput(event) {
    this.setForm({
      ...this.data.form,
      remark: event.detail.value.slice(0, 120)
    })
  },

  openProductSelector(event) {
    const id = event.currentTarget.dataset.id
    const line = this.data.form.items.find(item => item.id === id)
    this.clearSelectorTimer()
    this.setData({
      selectorVisible: true,
      selectorActive: false,
      selectorLineId: id,
      selectorKeyword: '',
      selectorLineSummary: line || null
    }, () => {
      this.updateSelectorProducts()
      this.selectorTimer = setTimeout(() => {
        this.setData({ selectorActive: true })
      }, 20)
    })
  },

  onSelectorKeywordInput(event) {
    this.setData({ selectorKeyword: event.detail.value }, () => {
      this.updateSelectorProducts()
    })
  },

  updateSelectorProducts() {
    const keyword = this.data.selectorKeyword.trim().toLowerCase()
    const line = this.data.form.items.find(item => item.id === this.data.selectorLineId)
    const matchedProducts = (this.data.productChoices || []).filter(product => {
      if (!keyword) return true
      return product.searchText.includes(keyword)
    })
    const selectorProducts = matchedProducts.slice(0, 24).map(product => {
      const productMatched = !keyword || [
        product.name,
        product.productNo,
        product.category,
        product.categoryPathText
      ].join(' ').toLowerCase().includes(keyword)
      const variants = product.variants.filter(option => {
        if (productMatched) return true
        return option.searchText.includes(keyword)
      }).slice(0, 8).map(option => ({
        ...option,
        selected: line && line.productId === option.productId && line.variantId === option.variantId,
        stockText: getOptionStockText(option)
      }))
      return {
        ...product,
        variants
      }
    }).filter(product => product.variants.length)

    this.setData({
      selectorProducts,
      selectorTotal: matchedProducts.length,
      selectorHasMore: matchedProducts.length > selectorProducts.length
    })
  },

  onSelectProductVariant(event) {
    const optionId = event.currentTarget.dataset.optionId
    const option = this.data.productOptions.find(item => item.id === optionId)
    if (!option) return
    this.setForm({
      ...this.data.form,
      items: this.data.form.items.map(item => item.id === this.data.selectorLineId ? applyOptionToLine(item, option) : item)
    })
    this.closeProductSelector()
  },

  closeProductSelector() {
    this.clearSelectorTimer()
    this.setData({ selectorActive: false })
    this.selectorTimer = setTimeout(() => {
      this.setData({
        selectorVisible: false,
        selectorLineId: '',
        selectorKeyword: '',
        selectorLineSummary: null,
        selectorProducts: [],
        selectorTotal: 0,
        selectorHasMore: false
      })
    }, 220)
  },

  clearSelectorTimer() {
    if (!this.selectorTimer) return
    clearTimeout(this.selectorTimer)
    this.selectorTimer = null
  },

  noop() {},

  onQtyInput(event) {
    const id = event.currentTarget.dataset.id
    const quantity = parseQty(validator.normalizeDecimalInput(event.detail.value, { maxDecimal: 2 }))
    this.setForm({
      ...this.data.form,
      items: this.data.form.items.map(item => item.id === id ? { ...item, quantity } : item)
    })
  },

  onPriceInput(event) {
    const id = event.currentTarget.dataset.id
    const unitPriceCents = parseAmountInput(validator.normalizeDecimalInput(event.detail.value, { maxDecimal: 2 }))
    this.setForm({
      ...this.data.form,
      items: this.data.form.items.map(item => item.id === id ? { ...item, unitPriceCents } : item)
    })
  },

  onStepTap(event) {
    const id = event.currentTarget.dataset.id
    const delta = Number(event.currentTarget.dataset.delta || 0)
    this.setForm({
      ...this.data.form,
      items: this.data.form.items.map(item => {
        if (item.id !== id) return item
        return {
          ...item,
          quantity: Math.max(0, Number(item.quantity || 0) + delta)
        }
      })
    })
  },

  onAddItemTap() {
    const existingIds = this.data.form.items.map(item => `${item.productId}__${item.variantId}`)
    const option = this.data.productOptions.find(item => !existingIds.includes(item.id)) ||
      this.data.productOptions[0]
    if (!option) {
      wx.showToast({ title: '没有可退货产品', icon: 'none' })
      return
    }
    this.setForm({
      ...this.data.form,
      items: this.data.form.items.concat(createLineFromOption(option))
    })
  },

  onRemoveItemTap(event) {
    const id = event.currentTarget.dataset.id
    if (this.data.form.items.length <= 1) {
      wx.showToast({ title: '至少保留一条明细', icon: 'none' })
      return
    }
    this.setForm({
      ...this.data.form,
      items: this.data.form.items.filter(item => item.id !== id)
    })
  },

  onCancelTap() {
    if (getCurrentPages().length > 1) {
      wx.navigateBack()
      return
    }
    wx.navigateTo({ url: '/pages/purchase-returns/index' })
  },

  async onSubmitTap() {
    const form = stripFormViewState(this.data.form)
    const errors = []
    if (!form.customerId) errors.push('请选择客户')
    if (!form.warehouseId && !form.warehouseName) errors.push('请选择仓库')
    validator.maxLength(errors, '备注', form.remark, 120)
    if (!form.items || !form.items.length) errors.push('请添加退货明细')
    ;(form.items || []).forEach((item, index) => {
      if (!item.productId || !item.variantId) errors.push(`第${index + 1}条请选择产品`)
      if (Number(item.quantity || 0) <= 0) errors.push(`第${index + 1}条退货数量必须大于0`)
      if (Number(item.unitPriceCents || 0) <= 0) errors.push(`第${index + 1}条退货单价必须大于0`)
    })
    const itemAmountCents = (form.items || []).reduce((sum, item) => sum + Math.round(Number(item.quantity || 0) * Number(item.unitPriceCents || 0)), 0)
    if (Number(form.refundCents || 0) <= 0) errors.push('退款金额必须大于0')
    if (Number(form.refundCents || 0) > itemAmountCents) errors.push('退款金额不能大于明细金额')
    if (validator.showFirstError(errors)) return

    try {
      const result = await returnApi.submitReturnOrder(form)
      wx.showToast({ title: '退货单已提交', icon: 'success' })
      setTimeout(() => {
        wx.redirectTo({
          url: `/pages/purchase-return-detail/index?id=${encodeURIComponent((result.order || result).id)}`
        })
      }, 500)
    } catch (error) {
      wx.showToast({ title: error.message || '提交失败', icon: 'none' })
    }
  }
})
