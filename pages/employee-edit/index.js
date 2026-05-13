const employeeApi = require('../../api/employee-api')
const validator = require('../../utils/form-validation')

const statusOptions = [
  { label: '启用', value: 'enabled' },
  { label: '禁用', value: 'disabled' }
]

const emptyForm = {
  id: '',
  mode: 'create',
  name: '',
  phone: '',
  roleId: '',
  roleIds: [],
  roleName: '请选择员工角色',
  statusKey: 'enabled',
  statusText: '启用',
  warehouseIds: [],
  warehouses: [],
  warehouseText: '请选择绑定仓库',
  remark: ''
}

Page({
  data: {
    form: emptyForm,
    roles: [],
    statusOptions,
    statusIndex: 0,
    warehouseOptions: [],
    warehouseIndex: 0,
    showDisable: false,
    loading: false
  },

  onLoad(options = {}) {
    this.employeeId = decodeURIComponent(options.id || '')
    this.loadForm(this.employeeId)
  },

  async loadForm(id) {
    this.setData({ loading: true })
    try {
      const [rolesResult, warehousesResult, employeeResult] = await Promise.all([
        employeeApi.getRoleList(),
        employeeApi.getWarehouseOptions(),
        id ? employeeApi.getEmployeeForm(id) : Promise.resolve(null)
      ])
      const roles = Array.isArray(rolesResult) ? rolesResult : []
      const rawWarehouses = Array.isArray(warehousesResult) ? warehousesResult : []
      const warehouseOptions = [
        { label: '全部仓库', value: '__all__' }
      ].concat(rawWarehouses.map(warehouse => ({
        label: warehouse.name || warehouse.label,
        value: warehouse.id || warehouse.value
      })))
      const firstWarehouse = warehouseOptions[1]
      const firstRole = roles[0]
      const form = this.normalizeForm(employeeResult || {
        ...emptyForm,
        roleId: firstRole ? firstRole.id : '',
        roleIds: firstRole ? [firstRole.id] : [],
        roleName: firstRole ? firstRole.name : emptyForm.roleName,
        warehouseIds: firstWarehouse ? [firstWarehouse.value] : [],
        warehouseText: firstWarehouse ? firstWarehouse.label : emptyForm.warehouseText
      }, roles, warehouseOptions)
      const statusIndex = Math.max(0, statusOptions.findIndex(option => option.value === form.statusKey))
      const warehouseIndex = this.resolveWarehouseIndex(form, warehouseOptions)

      this.setData({
        form,
        roles: this.decorateRoles(roles, form.roleIds),
        statusIndex,
        warehouseOptions,
        warehouseIndex,
        showDisable: Boolean(id && form.statusKey === 'enabled')
      })
    } catch (error) {
      wx.showToast({
        title: error.message || '员工信息加载失败',
        icon: 'none'
      })
    } finally {
      this.setData({ loading: false })
    }
  },

  normalizeForm(source, roles, warehouseOptions) {
    const roleIds = Array.isArray(source.roleIds) && source.roleIds.length
      ? source.roleIds
      : [source.roleId].filter(Boolean)
    const selectedRoles = roles.filter(item => roleIds.includes(item.id))
    const role = selectedRoles[0] || roles.find(item => item.id === source.roleId)
    const warehouseIds = Array.isArray(source.warehouseIds) && source.warehouseIds.length
      ? source.warehouseIds
      : (Array.isArray(source.warehouses) ? source.warehouses.map(item => item.id || item.value || item).filter(Boolean) : [])
    const warehouseNames = warehouseIds.map(id => {
      const option = warehouseOptions.find(item => item.value === id)
      return option ? option.label : ''
    }).filter(Boolean)

    return {
      ...emptyForm,
      ...source,
      id: source.id || '',
      mode: source.id ? 'edit' : 'create',
      name: source.name || '',
      phone: source.phone || '',
      roleId: roleIds[0] || source.roleId || (role && role.id) || '',
      roleIds,
      roleName: selectedRoles.length
        ? selectedRoles.map(item => item.name).join('、')
        : (source.roleName || (role && role.name) || emptyForm.roleName),
      statusKey: source.statusKey === 'disabled' || source.status === 'disabled' ? 'disabled' : 'enabled',
      statusText: source.statusText || (source.statusKey === 'disabled' || source.status === 'disabled' ? '禁用' : '启用'),
      warehouseIds,
      warehouses: warehouseIds,
      warehouseText: source.warehouseText || (warehouseNames.length ? warehouseNames.join('、') : emptyForm.warehouseText),
      remark: source.remark || ''
    }
  },

  decorateRoles(roles, roleIds) {
    const selected = Array.isArray(roleIds) ? roleIds : []
    return (roles || []).map(role => ({
      ...role,
      selected: selected.includes(role.id)
    }))
  },

  resolveWarehouseIndex(form, warehouseOptions) {
    const ids = Array.isArray(form.warehouseIds) ? form.warehouseIds : []
    const realOptions = warehouseOptions.filter(option => option.value !== '__all__')
    if (ids.length && realOptions.length && ids.length === realOptions.length) return 0
    if (!ids.length) return 0
    return Math.max(0, warehouseOptions.findIndex(option => option.value === ids[0]))
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
    this.setForm({ name: event.detail.value.slice(0, 30) })
  },

  onPhoneInput(event) {
    this.setForm({ phone: validator.digitsOnly(event.detail.value, 11) })
  },

  onRoleToggle(event) {
    const roleId = event.currentTarget.dataset.id
    const currentIds = Array.isArray(this.data.form.roleIds) ? this.data.form.roleIds.slice() : []
    const exists = currentIds.includes(roleId)
    const nextIds = exists ? currentIds.filter(id => id !== roleId) : currentIds.concat(roleId)
    const selectedRoles = this.data.roles.filter(role => nextIds.includes(role.id))
    this.setData({
      roles: this.decorateRoles(this.data.roles, nextIds),
      form: {
        ...this.data.form,
        roleId: nextIds[0] || '',
        roleIds: nextIds,
        roleName: selectedRoles.length ? selectedRoles.map(role => role.name).join('、') : emptyForm.roleName
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
    const warehouseIds = option.value === '__all__'
      ? this.data.warehouseOptions.filter(item => item.value !== '__all__').map(item => item.value)
      : [option.value]
    const warehouseNames = warehouseIds.map(id => {
      const matched = this.data.warehouseOptions.find(item => item.value === id)
      return matched ? matched.label : ''
    }).filter(Boolean)
    this.setData({
      warehouseIndex,
      form: {
        ...this.data.form,
        warehouseIds,
        warehouses: warehouseIds,
        warehouseText: warehouseNames.join('、')
      }
    })
  },

  onRemarkInput(event) {
    this.setForm({ remark: event.detail.value.slice(0, 120) })
  },

  onRolePermissionTap() {
    wx.navigateTo({
      url: `/pages/employee-roles/index?roleIds=${encodeURIComponent((this.data.form.roleIds || []).join(','))}`
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

  async onSaveTap() {
    if (this.data.loading) return
    const form = {
      ...this.data.form,
      name: validator.trimText(this.data.form.name),
      phone: validator.digitsOnly(this.data.form.phone, 11),
      remark: validator.trimText(this.data.form.remark)
    }
    const errors = []
    validator.requireText(errors, '员工姓名', form.name)
    validator.maxLength(errors, '员工姓名', form.name, 30)
    if (form.phone && !validator.isMobilePhone(form.phone)) errors.push('请输入11位手机号')
    if (!form.roleIds || !form.roleIds.length) errors.push('请选择员工角色')
    if (!form.warehouseIds || !form.warehouseIds.length) errors.push('请选择绑定仓库')
    validator.maxLength(errors, '备注', form.remark, 120)
    if (validator.showFirstError(errors)) {
      this.setData({ form })
      return
    }

    this.setData({ loading: true })
    try {
      await employeeApi.saveEmployee({
        id: this.employeeId,
        name: form.name,
        phone: form.phone,
        roleId: form.roleId,
        roleIds: form.roleIds,
        statusKey: form.statusKey,
        warehouseIds: form.warehouseIds,
        remark: form.remark
      })
      wx.showToast({ title: '员工已保存', icon: 'success' })
      setTimeout(() => {
        this.onCancelTap()
      }, 500)
    } catch (error) {
      wx.showToast({
        title: error.message || '员工保存失败',
        icon: 'none'
      })
    } finally {
      this.setData({ loading: false })
    }
  }
})
