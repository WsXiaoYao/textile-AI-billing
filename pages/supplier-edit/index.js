const supplierApi = require('../../api/supplier-api')

const commonOptions = ['否', '是']

function normalizeText(value) {
  return String(value || '').trim()
}

function emptyForm() {
  return {
    mode: 'create',
    id: '',
    name: '',
    phone: '',
    address: '',
    remark: '',
    statusKey: 'enabled',
    isCommon: false
  }
}

function validateSupplierForm(form) {
  const normalized = {
    ...form,
    name: normalizeText(form.name),
    phone: String(form.phone || '').replace(/\D/g, ''),
    address: normalizeText(form.address),
    remark: normalizeText(form.remark)
  }
  const errors = []
  if (!normalized.name) errors.push('请输入供应商名称')
  if (normalized.name.length > 80) errors.push('供应商名称不能超过80字')
  if (normalized.phone && !/^1\d{10}$/.test(normalized.phone)) errors.push('请输入11位手机号')
  if (normalized.address.length > 120) errors.push('地址不能超过120字')
  if (normalized.remark.length > 120) errors.push('备注不能超过120字')
  return { errors, normalized }
}

Page({
  data: {
    form: emptyForm(),
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

  async loadForm(id) {
    try {
      const form = id ? await supplierApi.getSupplierForm(id) : emptyForm()
      this.setData({
        form,
        modeTitle: form.mode === 'edit' ? '编辑供应商' : '新增供应商',
        commonIndex: form.isCommon ? 1 : 0,
        statusText: form.statusKey === 'disabled' ? '停用' : '启用',
        showStatusAction: form.mode === 'edit'
      })
    } catch (error) {
      wx.showToast({ title: error.message || '供应商表单加载失败', icon: 'none' })
    }
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
    this.updateField('phone', String(event.detail.value || '').replace(/\D/g, '').slice(0, 11))
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

  async onToggleStatusTap() {
    if (this.data.form.mode !== 'edit') return
    try {
      const supplier = await supplierApi.toggleSupplierStatus(this.data.form.id)
      await this.loadForm(this.data.form.id)
      wx.showToast({ title: supplier.statusText, icon: 'success' })
    } catch (error) {
      wx.showToast({ title: error.message || '状态更新失败', icon: 'none' })
    }
  },

  onCancelTap() {
    if (getCurrentPages().length > 1) {
      wx.navigateBack()
      return
    }
    wx.navigateTo({ url: '/pages/suppliers/index' })
  },

  async onSaveTap() {
    const { errors, normalized } = validateSupplierForm(this.data.form)
    if (errors.length) {
      wx.showToast({ title: errors[0], icon: 'none' })
      this.setData({ form: normalized })
      return
    }

    try {
      const supplier = await supplierApi.saveSupplier(normalized)
      wx.showToast({ title: '供应商已保存', icon: 'success' })
      setTimeout(() => {
        const pages = getCurrentPages()
        const previousPage = pages[pages.length - 2]
        if (previousPage && previousPage.route === 'pages/supplier-detail/index' && previousPage.loadDetail) {
          previousPage.supplierId = supplier.id
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
    } catch (error) {
      wx.showToast({ title: error.message || '供应商保存失败', icon: 'none' })
    }
  }
})
