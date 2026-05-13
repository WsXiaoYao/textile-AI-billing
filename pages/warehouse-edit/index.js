const warehouseApi = require('../../api/warehouse-api')
const validator = require('../../utils/form-validation')

const defaultOptions = ['否', '是']
const statusOptions = ['启用', '停用']
const emptyForm = {
  mode: 'create',
  id: '',
  name: '',
  keeper: '',
  address: '',
  isDefault: false,
  statusKey: 'enabled'
}

Page({
  data: {
    form: emptyForm,
    defaultOptions,
    defaultIndex: 0,
    statusOptions,
    statusIndex: 0,
    toggleText: '停用仓库',
    showStatusToggle: false,
    modeTitle: '编辑仓库'
  },

  onLoad(options = {}) {
    const id = decodeURIComponent(options.id || '')
    this.loadForm(id)
  },

  async loadForm(id) {
    try {
      const form = id ? await warehouseApi.getWarehouseForm(id) : emptyForm
      this.setData({
        form,
        modeTitle: form.mode === 'edit' ? '编辑仓库' : '新建仓库',
        defaultIndex: form.isDefault ? 1 : 0,
        statusIndex: form.statusKey === 'disabled' ? 1 : 0,
        toggleText: form.statusKey === 'enabled' ? '停用仓库' : '启用仓库',
        showStatusToggle: form.mode === 'edit'
      })
    } catch (error) {
      wx.showToast({ title: error.message || '仓库加载失败', icon: 'none' })
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
    this.updateField('name', event.detail.value.slice(0, 50))
  },

  onKeeperInput(event) {
    this.updateField('keeper', event.detail.value.slice(0, 30))
  },

  onAddressInput(event) {
    this.updateField('address', event.detail.value.slice(0, 120))
  },

  onDefaultChange(event) {
    const defaultIndex = Number(event.detail.value)
    const isDefault = defaultIndex === 1
    this.setData({
      defaultIndex,
      statusIndex: isDefault ? 0 : this.data.statusIndex,
      form: {
        ...this.data.form,
        isDefault,
        statusKey: isDefault ? 'enabled' : this.data.form.statusKey
      }
    })
  },

  onStatusChange(event) {
    const statusIndex = Number(event.detail.value)
    if (this.data.form.isDefault && statusIndex === 1) {
      wx.showToast({ title: '默认仓不可停用', icon: 'none' })
      return
    }

    const statusKey = statusIndex === 1 ? 'disabled' : 'enabled'
    this.setData({
      statusIndex,
      toggleText: statusKey === 'enabled' ? '停用仓库' : '启用仓库',
      form: {
        ...this.data.form,
        statusKey
      }
    })
  },

  async onToggleStatusTap() {
    if (this.data.form.mode !== 'edit') {
      const nextStatus = this.data.form.statusKey === 'enabled' ? 'disabled' : 'enabled'
      if (this.data.form.isDefault && nextStatus === 'disabled') {
        wx.showToast({ title: '默认仓不可停用', icon: 'none' })
        return
      }
      this.setData({
        statusIndex: nextStatus === 'disabled' ? 1 : 0,
        toggleText: nextStatus === 'enabled' ? '停用仓库' : '启用仓库',
        form: {
          ...this.data.form,
          statusKey: nextStatus
        }
      })
      return
    }

    try {
      const warehouse = await warehouseApi.toggleWarehouseStatus(this.data.form.id)
      this.loadForm(this.data.form.id)
      wx.showToast({ title: warehouse.statusText, icon: 'success' })
    } catch (error) {
      wx.showToast({ title: error.message || '操作失败', icon: 'none' })
    }
  },

  async onSaveTap() {
    const form = {
      ...this.data.form,
      name: validator.trimText(this.data.form.name),
      keeper: validator.trimText(this.data.form.keeper),
      address: validator.trimText(this.data.form.address)
    }
    const errors = []
    validator.requireText(errors, '仓库名称', form.name)
    validator.maxLength(errors, '仓库名称', form.name, 50)
    validator.maxLength(errors, '仓管', form.keeper, 30)
    validator.maxLength(errors, '仓库地址', form.address, 120)
    if (form.isDefault && form.statusKey === 'disabled') errors.push('默认仓不可停用')
    if (validator.showFirstError(errors)) {
      this.setData({ form })
      return
    }

    try {
      await warehouseApi.saveWarehouse(form)
      wx.showToast({ title: '仓库已保存', icon: 'success' })
    } catch (error) {
      wx.showToast({ title: error.message || '保存失败', icon: 'none' })
      return
    }

    setTimeout(() => {
      if (getCurrentPages().length > 1) {
        wx.navigateBack()
        return
      }
      wx.navigateTo({ url: '/pages/warehouses/index' })
    }, 500)
  }
})
