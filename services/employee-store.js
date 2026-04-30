const warehouseStore = require('./warehouse-store')

const employeeStorageKey = 'textile_employees_v1'

let cachedEmployees

const roles = [
  {
    id: 'owner',
    name: '老板',
    desc: '全模块 · 全组织数据 · 可切换全部组织',
    scopeText: '可查看全部组织数据',
    permissions: ['菜单 客户/销售/采购/库存/系统', '数据 全部组织与仓库数据']
  },
  {
    id: 'sales',
    name: '业务员',
    desc: '客户/销售/收款/退货',
    scopeText: '仅可见客户与销售数据',
    permissions: ['菜单 客户、销售单、收款、退货', '数据 自己创建或授权数据']
  },
  {
    id: 'buyer',
    name: '采购',
    desc: '供应商/采购/库存',
    scopeText: '仅可见采购与库存数据',
    permissions: ['菜单 供应商、采购单、库存', '数据 采购与库存相关数据']
  },
  {
    id: 'finance',
    name: '财务',
    desc: '客户往来/收款/销售查询',
    scopeText: '仅可见收款及往来数据',
    permissions: ['菜单 收款、资金流水、销售查询', '数据 收款及往来数据']
  },
  {
    id: 'warehouse',
    name: '仓管',
    desc: '库存/仓库/预警/打印',
    scopeText: '仅可见仓库与库存数据',
    permissions: ['菜单 库存、仓库、预警、打印', '数据 仓库与库存数据']
  }
]

const seedEmployees = [
  {
    id: 'emp-owner',
    name: '王姐',
    phone: '1358270496',
    roleId: 'owner',
    statusKey: 'enabled',
    warehouses: ['默认仓', '投色仓', '辅料仓'],
    remark: '可查看全部组织数据。'
  },
  {
    id: 'emp-tao',
    name: '涛',
    phone: '15685216085',
    roleId: 'buyer',
    statusKey: 'enabled',
    warehouses: ['默认仓', '投色仓'],
    remark: '仅可见采购与库存数据。'
  },
  {
    id: 'emp-wang',
    name: '旺',
    phone: '18600001122',
    roleId: 'warehouse',
    statusKey: 'disabled',
    warehouses: ['辅料仓'],
    remark: '禁用后不可登录。'
  }
]

function canUseStorage() {
  return typeof wx !== 'undefined' && wx.getStorageSync && wx.setStorageSync
}

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function getRole(roleId) {
  return roles.find(role => role.id === roleId) || roles[0]
}

function getStatusMeta(statusKey) {
  if (statusKey === 'disabled') {
    return { text: '禁用', tone: 'warning' }
  }
  return { text: '启用', tone: 'success' }
}

function normalizeEmployee(employee) {
  const role = getRole(employee.roleId)
  const status = getStatusMeta(employee.statusKey)
  const warehouses = Array.isArray(employee.warehouses) && employee.warehouses.length
    ? employee.warehouses
    : ['默认仓']

  return {
    ...employee,
    id: employee.id || `emp-${Date.now()}`,
    name: String(employee.name || '').trim(),
    phone: String(employee.phone || '').trim(),
    roleId: role.id,
    roleName: role.name,
    statusKey: employee.statusKey === 'disabled' ? 'disabled' : 'enabled',
    statusText: status.text,
    statusTone: status.tone,
    warehouses,
    warehouseText: warehouses.join('、'),
    warehouseCount: warehouses.length,
    remark: String(employee.remark || '').trim(),
    desc: `${role.name} · ${employee.phone || '未填写手机号'} · 绑定仓库 ${warehouses.length}`,
    permissionText: employee.statusKey === 'disabled' ? '禁用后不可登录' : role.scopeText,
    searchText: [
      employee.name,
      employee.phone,
      role.name,
      warehouses.join(' ')
    ].join(' ').toLowerCase()
  }
}

function saveEmployees() {
  if (!canUseStorage()) return
  wx.setStorageSync(employeeStorageKey, cachedEmployees)
}

function loadEmployees() {
  if (cachedEmployees) return cachedEmployees

  if (canUseStorage()) {
    const stored = wx.getStorageSync(employeeStorageKey)
    if (Array.isArray(stored) && stored.length) {
      cachedEmployees = stored.map(normalizeEmployee)
      return cachedEmployees
    }
  }

  cachedEmployees = seedEmployees.map(normalizeEmployee)
  saveEmployees()
  return cachedEmployees
}

function getRoleList(selectedRoleId = '') {
  return roles.map(role => ({
    ...role,
    selected: role.id === selectedRoleId
  }))
}

function getEmployeeList() {
  return loadEmployees().map(normalizeEmployee)
}

function getEmployee(id) {
  const decodedId = decodeURIComponent(id || '')
  return getEmployeeList().find(employee => employee.id === decodedId) || getEmployeeList()[0]
}

function getWarehouseOptions() {
  const names = warehouseStore.getWarehouseNames()
  return names.length ? names : ['默认仓', '投色仓', '辅料仓']
}

function getEmployeeForm(id) {
  const employee = id ? getEmployee(id) : null
  if (!employee) {
    return normalizeEmployee({
      id: '',
      mode: 'create',
      name: '',
      phone: '',
      roleId: 'sales',
      statusKey: 'enabled',
      warehouses: ['默认仓'],
      remark: ''
    })
  }

  return normalizeEmployee({
    ...clone(employee),
    mode: 'edit'
  })
}

function saveEmployeeForm(form) {
  const name = String(form.name || '').trim()
  const phone = String(form.phone || '').trim()
  if (!name) return { ok: false, message: '请输入员工姓名' }
  if (!phone) return { ok: false, message: '请输入手机号' }

  const oldId = decodeURIComponent(form.id || '')
  const employees = loadEmployees()
  const next = normalizeEmployee({
    ...form,
    id: oldId || `emp-${Date.now()}`
  })

  cachedEmployees = employees
    .filter(employee => employee.id !== oldId && employee.id !== next.id)
    .concat(next)
    .map(normalizeEmployee)
  saveEmployees()
  return { ok: true, employee: next }
}

function updateEmployeeStatus(id, statusKey) {
  const decodedId = decodeURIComponent(id || '')
  const employees = loadEmployees()
  cachedEmployees = employees.map(employee => employee.id === decodedId
    ? normalizeEmployee({ ...employee, statusKey })
    : normalizeEmployee(employee))
  saveEmployees()
  return getEmployee(decodedId)
}

module.exports = {
  getEmployee,
  getEmployeeForm,
  getEmployeeList,
  getRoleList,
  getWarehouseOptions,
  saveEmployeeForm,
  updateEmployeeStatus
}
