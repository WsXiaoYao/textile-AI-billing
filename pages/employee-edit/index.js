const employeeStore = require('../../services/employee-store')

const statusOptions = [
  { label: '启用', value: 'enabled' },
  { label: '禁用', value: 'disabled' }
]

Page({
  data: {
    form: employeeStore.getEmployeeForm(),
    roles: [],
    roleIndex: 0,
    statusOptions,
    statusIndex: 0,
    warehouseOptions: [],
    warehouseIndex: 0,
    showDisable: false
  },

  onLoad(options = {}) {
    this.employeeId = decodeURIComponent(options.id || '')
    this.loadForm(this.employeeId)
  },

  loadForm(id) {
    const roles = employeeStore.getRoleList()
    const warehouseOptions = [
      { label: '全部仓库', value: '__all__' }
    ].concat(employeeStore.getWarehouseOptions().map(name => ({ label: name, value: name })))
    const form = employeeStore.getEmployeeForm(id)
    const roleIndex = Math.max(0, roles.findIndex(role => role.id === form.roleId))
    const statusIndex = Math.max(0, statusOptions.findIndex(option => option.value === form.statusKey))
    const warehouseIndex = Math.max(0, warehouseOptions.findIndex(option => option.label === form.warehouseText || option.value === form.warehouses[0]))

    this.setData({
      form,
      roles,
      roleIndex,
      statusIndex,
      warehouseOptions,
      warehouseIndex,
      showDisable: Boolean(id && form.statusKey === 'enabled')
    })
  },

  setForm(patch) {
    this.setData({
      form: {
        ...this.data.form,
        ...patch
      }
    })
  },

  onNameInput(event) {
    this.setForm({ name: event.detail.value })
  },

  onPhoneInput(event) {
    this.setForm({ phone: event.detail.value })
  },

  onRoleChange(event) {
    const roleIndex = Number(event.detail.value || 0)
    const role = this.data.roles[roleIndex]
    this.setData({
      roleIndex,
      form: {
        ...this.data.form,
        roleId: role.id,
        roleName: role.name
      }
    })
  },

  onStatusChange(event) {
    const statusIndex = Number(event.detail.value || 0)
    const status = this.data.statusOptions[statusIndex]
    this.setData({
      statusIndex,
      form: {
        ...this.data.form,
        statusKey: status.value,
        statusText: status.label
      },
      showDisable: Boolean(this.employeeId && status.value === 'enabled')
    })
  },

  onWarehouseChange(event) {
    const warehouseIndex = Number(event.detail.value || 0)
    const option = this.data.warehouseOptions[warehouseIndex]
    const warehouses = option.value === '__all__'
      ? this.data.warehouseOptions.filter(item => item.value !== '__all__').map(item => item.value)
      : [option.value]
    this.setData({
      warehouseIndex,
      form: {
        ...this.data.form,
        warehouses,
        warehouseText: warehouses.join('、')
      }
    })
  },

  onRemarkInput(event) {
    this.setForm({ remark: event.detail.value })
  },

  onRolePermissionTap() {
    wx.navigateTo({
      url: `/pages/employee-roles/index?roleId=${encodeURIComponent(this.data.form.roleId)}`
    })
  },

  onDisableTap() {
    this.setData({
      statusIndex: 1,
      showDisable: false,
      form: {
        ...this.data.form,
        statusKey: 'disabled',
        statusText: '禁用'
      }
    })
  },

  onCancelTap() {
    if (getCurrentPages().length > 1) {
      wx.navigateBack()
      return
    }
    wx.navigateTo({ url: '/pages/employees/index' })
  },

  onSaveTap() {
    const result = employeeStore.saveEmployeeForm(this.data.form)
    if (!result.ok) {
      wx.showToast({ title: result.message, icon: 'none' })
      return
    }

    wx.showToast({ title: '员工已保存', icon: 'success' })
    setTimeout(() => {
      this.onCancelTap()
    }, 500)
  }
})
