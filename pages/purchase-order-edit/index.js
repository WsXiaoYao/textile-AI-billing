const purchaseStore = require('../../services/purchase-store')
const purchaseApi = require('../../api/purchase-api')
const validator = require('../../utils/form-validation')

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
  return {
    ...form,
    items: (form.items || []).map(stripLineViewState)
  }
}

function normalizeItems(items) {
  return items.map((item, index) => purchaseStore.normalizeLine(stripLineViewState(item), index))
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
      priceText: purchaseStore.formatMoney(option.priceCents)
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
  const orderAmountCents = items.reduce((sum, item) => sum + item.amountCents, 0)
  const discountCents = Number(form.discountCents || 0)
  return {
    ...form,
    items: items.map(item => getLineOptionView(item, productChoices || [])),
    orderAmountCents,
    contractAmountCents: Math.max(0, orderAmountCents - discountCents),
    orderAmountText: purchaseStore.formatMoney(orderAmountCents),
    contractAmountText: purchaseStore.formatMoney(Math.max(0, orderAmountCents - discountCents))
  }
}

Page({
  data: {
    form: purchaseStore.getPurchaseOrderForm(),
    supplierOptions: [],
    supplierIndex: 0,
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
    this.loadForm(options.id)
  },

  onUnload() {
    this.clearSelectorTimer()
  },

  async loadForm(id) {
    try {
      const [supplierOptions, warehouseOptions, productOptions, sourceForm] = await Promise.all([
        purchaseApi.getSupplierOptions(),
        purchaseApi.getWarehouseOptions(),
        purchaseApi.getProductOptions({ limit: 160 }),
        id ? purchaseApi.getPurchaseOrderForm(id) : purchaseApi.getPurchaseOrderForm()
      ])
      const productChoices = buildProductChoices(productOptions || [])
      const initialItems = sourceForm.items && sourceForm.items.length
        ? sourceForm.items
        : productOptions && productOptions.length
          ? [purchaseStore.createLineFromOption(productOptions[0])]
          : []
      const form = recalcForm({ ...sourceForm, items: initialItems }, productChoices)
      const supplierIndex = Math.max(0, (supplierOptions || []).findIndex(item => item.id === form.supplierId || item.name === form.supplierName))
      const warehouseIndex = Math.max(0, (warehouseOptions || []).findIndex(item => item.id === form.warehouseId || item.name === form.warehouseName))

      this.setData({
        form,
        supplierOptions: supplierOptions || [],
        supplierIndex,
        warehouseOptions: warehouseOptions || [],
        warehouseIndex,
        productOptions: productOptions || [],
        productChoices
      })
    } catch (error) {
      wx.showToast({ title: error.message || '采购单表单加载失败', icon: 'none' })
    }
  },

  setForm(nextForm) {
    this.setData({
      form: recalcForm(nextForm, this.data.productChoices)
    })
  },

  onSupplierChange(event) {
    const supplierIndex = Number(event.detail.value || 0)
    const supplier = this.data.supplierOptions[supplierIndex]
    this.setData({
      supplierIndex,
      form: {
        ...this.data.form,
        supplierId: supplier.id,
        supplierName: supplier.name
      }
    })
  },

  onDateChange(event) {
    this.setForm({
      ...this.data.form,
      date: event.detail.value
    })
  },

  onWarehouseChange(event) {
    const warehouseIndex = Number(event.detail.value || 0)
    const warehouse = this.data.warehouseOptions[warehouseIndex]
	    this.setData({
	      warehouseIndex,
	      form: {
	        ...this.data.form,
	        warehouseName: warehouse.name,
	        warehouseId: warehouse.id
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
    const quantity = purchaseStore.parseQty(validator.normalizeDecimalInput(event.detail.value, { maxDecimal: 2 }))
    this.setForm({
      ...this.data.form,
      items: this.data.form.items.map(item => item.id === id ? { ...item, quantity } : item)
    })
  },

  onPriceInput(event) {
    const id = event.currentTarget.dataset.id
    const unitPriceCents = purchaseStore.parseAmountInput(validator.normalizeDecimalInput(event.detail.value, { maxDecimal: 2 }))
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
      wx.showToast({ title: '没有可采购产品', icon: 'none' })
      return
    }
    this.setForm({
      ...this.data.form,
      items: this.data.form.items.concat(purchaseStore.createLineFromOption(option))
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
    wx.navigateTo({ url: '/pages/purchase-orders/index' })
  },

  async onSubmitTap() {
    const form = stripFormViewState(this.data.form)
    const errors = []
    if (!form.supplierId) errors.push('请选择供应商')
    if (!form.warehouseId && !form.warehouseName) errors.push('请选择仓库')
    validator.maxLength(errors, '备注', form.remark, 120)
    if (!form.items || !form.items.length) errors.push('请添加采购明细')
    ;(form.items || []).forEach((item, index) => {
      if (!item.productId || !item.variantId) errors.push(`第${index + 1}条请选择产品`)
      if (Number(item.quantity || 0) <= 0) errors.push(`第${index + 1}条采购数量必须大于0`)
      if (Number(item.unitPriceCents || 0) <= 0) errors.push(`第${index + 1}条采购单价必须大于0`)
    })
    if (validator.showFirstError(errors)) return

    try {
      const result = await purchaseApi.submitPurchaseOrder(form)
      wx.showToast({ title: '采购单已提交', icon: 'success' })
      setTimeout(() => {
        wx.redirectTo({
          url: `/pages/purchase-order-detail/index?id=${encodeURIComponent(result.order.id)}`
        })
      }, 500)
    } catch (error) {
      wx.showToast({ title: error.message || '采购单提交失败', icon: 'none' })
    }
  }
})
