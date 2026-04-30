const warehouseStore = require('../../services/warehouse-store')

const defaultOptions = ['否', '是']
const statusOptions = ['启用', '停用']

Page({
  data: {
    form: warehouseStore.getWarehouseForm(),
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

  loadForm(id) {
    const form = warehouseStore.getWarehouseForm(id)
    this.setData({
      form,
      modeTitle: form.mode === 'edit' ? '编辑仓库' : '新建仓库',
      defaultIndex: form.isDefault ? 1 : 0,
      statusIndex: form.statusKey === 'disabled' ? 1 : 0,
      toggleText: form.statusKey === 'enabled' ? '停用仓库' : '启用仓库',
      showStatusToggle: form.mode === 'edit'
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

  onKeeperInput(event) {
    this.updateField('keeper', event.detail.value)
  },

  onAddressInput(event) {
    this.updateField('address', event.detail.value)
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

  onToggleStatusTap() {
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

    const result = warehouseStore.toggleWarehouseStatus(this.data.form.id)
    if (!result.ok) {
      wx.showToast({ title: result.message, icon: 'none' })
      return
    }
    this.loadForm(this.data.form.id)
    wx.showToast({ title: result.warehouse.statusText, icon: 'success' })
  },

  onSaveTap() {
    const result = warehouseStore.saveWarehouseForm(this.data.form)
    if (!result.ok) {
      wx.showToast({ title: result.message, icon: 'none' })
      return
    }

    wx.showToast({ title: '仓库已保存', icon: 'success' })
    setTimeout(() => {
      if (getCurrentPages().length > 1) {
        wx.navigateBack()
        return
      }
      wx.navigateTo({ url: '/pages/warehouses/index' })
    }, 500)
  }
})
