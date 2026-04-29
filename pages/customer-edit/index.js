const orderStore = require('../../services/order-store')

const categoryOptions = ['贵州客户', '外地客户', '物流客户', '批发客户', '零售客户', '普通客户']

Page({
  data: {
    form: orderStore.getCustomerForm(),
    modeTitle: '新增客户',
    categoryOptions,
    categoryIndex: -1
  },

  onLoad(options = {}) {
    const id = decodeURIComponent(options.id || '')
    const form = orderStore.getCustomerForm(id)
    this.setData({
      form,
      modeTitle: form.mode === 'edit' ? '修改客户' : '新增客户',
      categoryIndex: categoryOptions.indexOf(form.category)
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

  onPhoneInput(event) {
    this.updateField('phone', event.detail.value)
  },

  onAddressInput(event) {
    this.updateField('address', event.detail.value)
  },

  onOpeningInput(event) {
    this.updateField('openingReceivable', event.detail.value)
  },

  onRemarkInput(event) {
    this.updateField('remark', event.detail.value)
  },

  onCategoryChange(event) {
    const categoryIndex = Number(event.detail.value)
    this.setData({
      categoryIndex,
      form: {
        ...this.data.form,
        category: categoryOptions[categoryIndex] || ''
      }
    })
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

  onSaveTap() {
    const result = orderStore.saveCustomerProfile(this.data.form)
    if (!result.ok) {
      wx.showToast({
        title: result.message,
        icon: 'none'
      })
      return
    }

    wx.showToast({
      title: '客户已保存',
      icon: 'success'
    })

    setTimeout(() => {
      const pages = getCurrentPages()
      const previousPage = pages[pages.length - 2]
      if (previousPage && previousPage.route === 'pages/customer-detail/index' && previousPage.loadDetail) {
        previousPage.customerId = result.customer.id
        previousPage.loadDetail()
        wx.navigateBack()
      } else {
        wx.switchTab({ url: '/pages/customers/index' })
      }
    }, 500)
  }
})
