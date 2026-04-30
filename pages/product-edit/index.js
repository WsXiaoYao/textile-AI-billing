const productStore = require('../../services/product-store')
const warehouseStore = require('../../services/warehouse-store')

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
    this.updateField('name', event.detail.value)
  },

  onNoInput(event) {
    this.updateField('no', event.detail.value)
  },

  onRemarkInput(event) {
    this.updateField('remark', event.detail.value)
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
    const variants = this.data.form.variants.slice()
    variants[index] = {
      ...variants[index],
      [key]: event.detail.value
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
    const result = productStore.saveProductForm(this.data.form)
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
