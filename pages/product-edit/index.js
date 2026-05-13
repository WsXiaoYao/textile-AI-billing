const productStore = require('../../services/product-store')
const warehouseStore = require('../../services/warehouse-store')
const validator = require('../../utils/form-validation')

function getUnitOptions() {
  const units = []
  productStore.getProductList().forEach(product => {
    if (product.unit) units.push(product.unit)
    ;(product.variants || []).forEach(variant => {
      if (variant.unit) units.push(variant.unit)
    })
  })
  return Array.from(new Set(units.concat(['米', '件', '条', '张', '个'])))
}

function withVariantUnitIndexes(form, unitOptions) {
  return {
    ...form,
    variants: (form.variants || []).map(variant => {
      const unit = variant.unit || form.unit || unitOptions[0] || '件'
      const unitIndex = unitOptions.indexOf(unit)
      return {
        ...variant,
        unit,
        unitIndex: unitIndex >= 0 ? unitIndex : 0,
        imageUrl: variant.imageUrl || productStore.getVariantDefaultImage()
      }
    })
  }
}

Page({
  data: {
    form: productStore.getProductForm(),
    modeTitle: '新增产品',
    categoryOptions: [],
    categoryIndex: -1,
    warehouseOptions: [],
    warehouseIndex: -1,
    unitOptions: getUnitOptions(),
    unitIndex: -1
  },

  onLoad(options = {}) {
    const id = decodeURIComponent(options.id || '')
    const form = withVariantUnitIndexes(productStore.getProductForm(id), this.data.unitOptions)
    const categoryOptions = productStore.getCategories().map(category => category.name)
    const warehouseOptions = warehouseStore.getWarehouseNames()
    this.setData({
      form,
      modeTitle: form.mode === 'edit' ? '修改产品' : '新增产品',
      categoryOptions,
      warehouseOptions,
      categoryIndex: categoryOptions.indexOf(form.category),
      warehouseIndex: warehouseOptions.indexOf(form.warehouse),
      unitIndex: this.data.unitOptions.indexOf(form.unit)
    })
  },

  updateField(key, value) {
    this.setData({
      form: {
        ...this.data.form,
        [key]: value
      }
    })
  },

  onNameInput(event) {
    this.updateField('name', event.detail.value.slice(0, 80))
  },

  onNoInput(event) {
    this.updateField('no', event.detail.value.slice(0, 50))
  },

  onRemarkInput(event) {
    this.updateField('remark', event.detail.value.slice(0, 120))
  },

  chooseImage(success) {
    if (wx.chooseMedia) {
      wx.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sourceType: ['album', 'camera'],
        success: result => {
          const file = result.tempFiles && result.tempFiles[0]
          success(file && file.tempFilePath)
        }
      })
      return
    }

    wx.chooseImage({
      count: 1,
      sourceType: ['album', 'camera'],
      success: result => {
        success(result.tempFilePaths && result.tempFilePaths[0])
      }
    })
  },

  onProductImageTap() {
    this.chooseImage(path => {
      if (!path) return
      this.updateField('imageUrl', path)
    })
  },

  onCategoryChange(event) {
    const categoryIndex = Number(event.detail.value)
    this.setData({
      categoryIndex,
      form: {
        ...this.data.form,
        category: this.data.categoryOptions[categoryIndex] || ''
      }
    })
  },

  onWarehouseChange(event) {
    const warehouseIndex = Number(event.detail.value)
    this.setData({
      warehouseIndex,
      form: {
        ...this.data.form,
        warehouse: this.data.warehouseOptions[warehouseIndex] || ''
      }
    })
  },

  onUnitChange(event) {
    const unitIndex = Number(event.detail.value)
    this.setData({
      unitIndex,
      form: {
        ...this.data.form,
        unit: this.data.unitOptions[unitIndex] || ''
      }
    })
  },

  onVariantUnitChange(event) {
    const index = Number(event.currentTarget.dataset.index)
    const unitIndex = Number(event.detail.value)
    const unit = this.data.unitOptions[unitIndex] || this.data.unitOptions[0] || '件'
    const variants = this.data.form.variants.slice()
    variants[index] = {
      ...variants[index],
      unit,
      unitIndex
    }
    this.setData({
      form: {
        ...this.data.form,
        variants
      }
    })
  },

  onVariantInput(event) {
    const index = Number(event.currentTarget.dataset.index)
    const key = event.currentTarget.dataset.key
    const numberKeys = ['price', 'costPrice', 'stockQty', 'lowerLimitQty']
    const value = numberKeys.includes(key)
      ? validator.normalizeDecimalInput(event.detail.value, { maxDecimal: key === 'stockQty' || key === 'lowerLimitQty' ? 3 : 2 })
      : event.detail.value.slice(0, 50)
    const variants = this.data.form.variants.slice()
    variants[index] = {
      ...variants[index],
      [key]: value
    }
    this.setData({
      form: {
        ...this.data.form,
        variants
      }
    })
  },

  chooseVariantImage(index) {
    const handlePath = path => {
      if (!path) return
      const variants = this.data.form.variants.slice()
      variants[index] = {
        ...variants[index],
        imageUrl: path
      }
      this.setData({
        form: {
          ...this.data.form,
          variants
        }
      })
    }

    this.chooseImage(handlePath)
  },

  onVariantImageTap(event) {
    this.chooseVariantImage(Number(event.currentTarget.dataset.index))
  },

  onAddVariantTap() {
    const unit = this.data.form.unit || this.data.unitOptions[0] || '件'
    const unitIndex = this.data.unitOptions.indexOf(unit)
    const variants = this.data.form.variants.concat({
      id: `new-${Date.now()}`,
      color: '',
      unit,
      unitIndex: unitIndex >= 0 ? unitIndex : 0,
      imageUrl: productStore.getVariantDefaultImage(),
      stockQty: '',
      lowerLimitQty: '',
      price: '',
      costPrice: ''
    })
    this.setData({
      form: {
        ...this.data.form,
        variants
      }
    })
  },

  onRemoveVariantTap(event) {
    if (this.data.form.variants.length <= 1) return
    const index = Number(event.currentTarget.dataset.index)
    const variants = this.data.form.variants.filter((_, itemIndex) => itemIndex !== index)
    this.setData({
      form: {
        ...this.data.form,
        variants
      }
    })
  },

  onCancelTap() {
    if (getCurrentPages().length > 1) {
      wx.navigateBack()
      return
    }
    wx.navigateTo({ url: '/pages/products/index' })
  },

  onSaveTap() {
    const form = {
      ...this.data.form,
      name: validator.trimText(this.data.form.name),
      no: validator.trimText(this.data.form.no),
      remark: validator.trimText(this.data.form.remark),
      variants: (this.data.form.variants || []).map(variant => ({
        ...variant,
        color: validator.trimText(variant.color),
        price: validator.normalizeDecimalInput(variant.price, { maxDecimal: 2 }),
        costPrice: validator.normalizeDecimalInput(variant.costPrice, { maxDecimal: 2 }),
        stockQty: validator.normalizeDecimalInput(variant.stockQty, { maxDecimal: 3 }),
        lowerLimitQty: validator.normalizeDecimalInput(variant.lowerLimitQty, { maxDecimal: 3 })
      }))
    }
    const errors = []
    validator.requireText(errors, '产品名称', form.name)
    validator.maxLength(errors, '产品名称', form.name, 80)
    validator.maxLength(errors, '产品编号', form.no, 50)
    if (!form.category) errors.push('请选择产品分类')
    if (!form.warehouse) errors.push('请选择默认仓库')
    validator.maxLength(errors, '备注', form.remark, 120)
    if (!form.variants.length) errors.push('请至少添加一个颜色规格')
    form.variants.forEach((variant, index) => {
      if (!variant.color) errors.push(`第${index + 1}个颜色请输入颜色名称`)
      if (!variant.unit) errors.push(`第${index + 1}个颜色请选择单位`)
      if (variant.price && !validator.isNonNegativeAmount(variant.price)) errors.push(`第${index + 1}个颜色售价格式不正确`)
      if (variant.costPrice && !validator.isNonNegativeAmount(variant.costPrice)) errors.push(`第${index + 1}个颜色进价格式不正确`)
      if (variant.stockQty && !/^\d+(\.\d{1,3})?$/.test(variant.stockQty)) errors.push(`第${index + 1}个颜色库存格式不正确`)
      if (variant.lowerLimitQty && !/^\d+(\.\d{1,3})?$/.test(variant.lowerLimitQty)) errors.push(`第${index + 1}个颜色库存下限格式不正确`)
    })
    if (validator.showFirstError(errors)) {
      this.setData({ form })
      return
    }

    const result = productStore.saveProductForm(form)
    if (!result.ok) {
      wx.showToast({
        title: result.message,
        icon: 'none'
      })
      return
    }

    wx.showToast({
      title: '产品已保存',
      icon: 'success'
    })

    setTimeout(() => {
      const pages = getCurrentPages()
      const previousPage = pages[pages.length - 2]
      if (previousPage && previousPage.route === 'pages/product-detail/index' && previousPage.loadProduct) {
        previousPage.productId = result.product.id
        previousPage.loadProduct()
        wx.navigateBack()
        return
      }
      wx.navigateTo({
        url: `/pages/product-detail/index?id=${encodeURIComponent(result.product.id)}`
      })
    }, 500)
  }
})
