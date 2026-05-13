const customerApi = require('../../api/customer-api')
const categoryApi = require('../../api/customer-category-api')
const validator = require('../../utils/form-validation')

const fieldLimits = {
  name: 120,
  phone: 30,
  address: 255,
  remark: 500
}

function getEmptyForm() {
  return {
    mode: 'create',
    id: '',
    name: '',
    phone: '',
    category: '',
    address: '',
    openingReceivable: '',
    remark: ''
  }
}

function trimValue(value) {
  return String(value || '').trim()
}

function isValidPhone(value) {
  if (!value) return true
  return /^1\d{10}$/.test(value)
}

function isValidAmount(value) {
  if (!value) return true
  if (!/^\d+(\.\d{1,2})?$/.test(value)) return false
  return Number(value) <= 999999999.99
}

Page({
  data: {
    form: getEmptyForm(),
    modeTitle: '新增客户',
    categoryOptions: [],
    categoryIndex: -1,
    formErrors: {},
    saving: false
  },

  async onLoad(options = {}) {
    const id = decodeURIComponent(options.id || '')
    await this.loadCategories()
    if (!id) {
      const form = getEmptyForm()
      this.setData({
        form,
        modeTitle: '新增客户',
        categoryIndex: -1
      })
      return
    }

    let form = getEmptyForm()
    try {
      const detail = await customerApi.getCustomerDetail(id)
      form = detail.form || {
        ...getEmptyForm(),
        mode: 'edit',
        id,
        name: detail.customer && detail.customer.name || '',
        phone: detail.customer && detail.customer.phone || '',
        category: detail.customer && detail.customer.category || '',
        address: detail.customer && detail.customer.address || '',
        openingReceivable: detail.customer && detail.customer.opening_debt || '',
        remark: detail.customer && detail.customer.remark || ''
      }
    } catch (error) {
      wx.showToast({
        title: error.message || '客户资料加载失败',
        icon: 'none'
      })
    }
    this.setData({
      form,
      modeTitle: form.mode === 'edit' ? '修改客户' : '新增客户',
      categoryIndex: this.findCategoryIndex(form)
    })
  },

  async loadCategories() {
    try {
      const result = await categoryApi.listCategories()
      const categoryOptions = (result.list || []).map(category => ({
        id: category.id,
        name: category.name
      }))
      this.setData({ categoryOptions })
    } catch (error) {
      wx.showToast({
        title: error.message || '客户分类加载失败',
        icon: 'none'
      })
    }
  },

  findCategoryIndex(form) {
    const options = this.data.categoryOptions || []
    const id = form.categoryId || form.customer_category_id || ''
    if (id) return options.findIndex(option => option.id === id)
    return options.findIndex(option => option.name === form.category)
  },

  updateField(key, value) {
    const formErrors = { ...this.data.formErrors }
    delete formErrors[key]
    this.setData({
      form: {
        ...this.data.form,
        [key]: value
      },
      formErrors
    })
  },

  onNameInput(event) {
    this.updateField('name', event.detail.value)
  },

  onPhoneInput(event) {
    this.updateField('phone', validator.digitsOnly(event.detail.value, 11))
  },

  onAddressInput(event) {
    this.updateField('address', event.detail.value)
  },

  onOpeningInput(event) {
    this.updateField('openingReceivable', validator.normalizeDecimalInput(event.detail.value, { maxDecimal: 2 }))
  },

  onRemarkInput(event) {
    this.updateField('remark', event.detail.value)
  },

  onCategoryChange(event) {
    const categoryIndex = Number(event.detail.value)
    const selected = this.data.categoryOptions[categoryIndex]
    const formErrors = { ...this.data.formErrors }
    delete formErrors.category
    this.setData({
      categoryIndex,
      formErrors,
      form: {
        ...this.data.form,
        categoryId: selected ? selected.id : '',
        customer_category_id: selected ? selected.id : '',
        category: selected ? selected.name : '',
        customer_category: selected ? selected.name : ''
      }
    })
  },

  validateForm() {
    const form = this.data.form || {}
    const errors = {}
    const name = trimValue(form.name)
    const phone = trimValue(form.phone)
    const address = trimValue(form.address)
    const openingReceivable = trimValue(form.openingReceivable)
    const remark = trimValue(form.remark)

    if (!name) errors.name = '请输入客户名称'
    else if (name.length > fieldLimits.name) errors.name = `客户名称不能超过${fieldLimits.name}字`

    if (phone && !isValidPhone(phone)) errors.phone = '请输入11位手机号'

    if (!form.categoryId && !form.customer_category_id) errors.category = '请选择客户分类'

    if (address.length > fieldLimits.address) errors.address = `详细地址不能超过${fieldLimits.address}字`

    if (!isValidAmount(openingReceivable)) errors.openingReceivable = '期初欠款请输入非负金额，最多2位小数'

    if (remark.length > fieldLimits.remark) errors.remark = `备注不能超过${fieldLimits.remark}字`

    return errors
  },

  onImportTap() {
    wx.navigateTo({ url: '/pages/customer-import/index' })
  },

  onCancelTap() {
    if (getCurrentPages().length > 1) {
      wx.navigateBack()
      return
    }
    wx.switchTab({ url: '/pages/customers/index' })
  },

  async onSaveTap() {
    if (this.data.saving) return
    const form = this.data.form
    const formErrors = this.validateForm()
    const firstError = Object.keys(formErrors)[0]
    if (firstError) {
      this.setData({ formErrors })
      wx.showToast({
        title: formErrors[firstError],
        icon: 'none'
      })
      return
    }

    this.setData({ saving: true })
    try {
      const payload = {
        ...form,
        name: trimValue(form.name),
        phone: trimValue(form.phone),
        address: trimValue(form.address),
        openingReceivable: trimValue(form.openingReceivable),
        remark: trimValue(form.remark)
      }
      const result = await customerApi.saveCustomer(payload)
      wx.showToast({
        title: '客户已保存',
        icon: 'success'
      })
      const savedId = result && result.id || payload.id
      const pages = getCurrentPages()
      const previousPage = pages[pages.length - 2]
      if (previousPage && previousPage.route === 'pages/customer-detail/index' && previousPage.loadDetail) {
        previousPage.customerId = savedId
        setTimeout(() => {
          previousPage.loadDetail()
          wx.navigateBack()
        }, 500)
      } else {
        setTimeout(() => {
          wx.redirectTo({ url: `/pages/customer-detail/index?id=${encodeURIComponent(savedId)}` })
        }, 500)
      }
    } catch (error) {
      this.setData({ saving: false })
      wx.showToast({
        title: error.message || '客户保存失败',
        icon: 'none'
      })
    }
  }
})
