const supplierStore = require('../../services/supplier-store')

const commonOptions = ['否', '是']

Page({
  data: {
    form: supplierStore.getSupplierForm(),
    modeTitle: '新增供应商',
    commonOptions,
    commonIndex: 0,
    statusText: '启用',
    showStatusAction: false
  },

  onLoad(options = {}) {
    const id = decodeURIComponent(options.id || '')
    this.loadForm(id)
  },

  loadForm(id) {
    const form = supplierStore.getSupplierForm(id)
    this.setData({
      form,
      modeTitle: form.mode === 'edit' ? '编辑供应商' : '新增供应商',
      commonIndex: form.isCommon ? 1 : 0,
      statusText: form.statusKey === 'disabled' ? '停用' : '启用',
      showStatusAction: form.mode === 'edit'
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

  onRemarkInput(event) {
    this.updateField('remark', event.detail.value)
  },

  onCommonChange(event) {
    const commonIndex = Number(event.detail.value)
    this.setData({
      commonIndex,
      form: {
        ...this.data.form,
        isCommon: commonIndex === 1
      }
    })
  },

  onToggleStatusTap() {
    if (this.data.form.mode !== 'edit') return
    const result = supplierStore.toggleSupplierStatus(this.data.form.id)
    if (!result.ok) {
      wx.showToast({ title: result.message, icon: 'none' })
      return
    }
    this.loadForm(this.data.form.id)
    wx.showToast({ title: result.supplier.statusText, icon: 'success' })
  },

  onCancelTap() {
    if (getCurrentPages().length > 1) {
      wx.navigateBack()
      return
    }
    wx.navigateTo({ url: '/pages/suppliers/index' })
  },

  onSaveTap() {
    const result = supplierStore.saveSupplierForm(this.data.form)
    if (!result.ok) {
      wx.showToast({ title: result.message, icon: 'none' })
      return
    }

    wx.showToast({ title: '供应商已保存', icon: 'success' })
    setTimeout(() => {
      const pages = getCurrentPages()
      const previousPage = pages[pages.length - 2]
      if (previousPage && previousPage.route === 'pages/supplier-detail/index' && previousPage.loadDetail) {
        previousPage.supplierId = result.supplier.id
        previousPage.loadDetail()
        wx.navigateBack()
        return
      }
      if (previousPage && previousPage.route === 'pages/suppliers/index' && previousPage.loadSuppliers) {
        previousPage.loadSuppliers()
        wx.navigateBack()
        return
      }
      wx.navigateTo({ url: '/pages/suppliers/index' })
    }, 500)
  }
})
