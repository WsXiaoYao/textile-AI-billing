const ROLE_ALIASES = {
  '管理员': '老板',
  '销售': '业务员',
  '采购员': '采购'
}

const PERMISSION_LABELS = {
  'customers:read': '查看客户',
  'customers:write': '新增和编辑客户',
  'sales:read': '查看销售单',
  'sales:write': '新增和编辑销售单',
  'receipts:read': '查看收款和资金往来',
  'receipts:write': '新增收款',
  'returns:read': '查看退货单',
  'returns:write': '新增和编辑退货单',
  'suppliers:read': '查看供应商',
  'suppliers:write': '新增和编辑供应商',
  'purchase:read': '查看采购单',
  'purchase:write': '新增和编辑采购单',
  'products:read': '查看产品',
  'products:write': '新增和编辑产品',
  'inventory:read': '查看库存',
  'inventory:write': '库存调整',
  'warehouses:read': '查看仓库',
  'warehouses:write': '维护仓库',
  'accounts:read': '查看收款账户',
  'accounts:write': '维护收款账户',
  'settings:read': '查看组织设置',
  'settings:write': '维护员工和组织设置',
  'messages:read': '查看消息中心',
  'print:write': '打印和分享单据',
  'reports:read': '查看统计报表'
}

const ROLE_DEFS = [
  {
    name: '老板',
    description: '全模块 · 全组织数据 · 可管理员工权限',
    dataScope: 'all',
    permissions: Object.keys(PERMISSION_LABELS)
  },
  {
    name: '业务员',
    description: '客户/销售/收款/退货 · 自己创建或授权数据',
    dataScope: 'own_or_authorized',
    permissions: [
      'customers:read',
      'customers:write',
      'sales:read',
      'sales:write',
      'receipts:read',
      'receipts:write',
      'returns:read',
      'returns:write',
      'products:read',
      'inventory:read',
      'warehouses:read',
      'print:write'
    ]
  },
  {
    name: '采购',
    description: '供应商/采购/库存补货 · 采购和库存相关数据',
    dataScope: 'purchase_inventory',
    permissions: [
      'suppliers:read',
      'suppliers:write',
      'purchase:read',
      'purchase:write',
      'products:read',
      'inventory:read',
      'warehouses:read'
    ]
  },
  {
    name: '财务',
    description: '客户往来/收款/销售查询 · 收款及往来数据',
    dataScope: 'finance',
    permissions: [
      'customers:read',
      'sales:read',
      'receipts:read',
      'receipts:write',
      'returns:read',
      'accounts:read',
      'reports:read'
    ]
  },
  {
    name: '仓管',
    description: '库存/仓库/预警/打印 · 仓库与库存数据',
    dataScope: 'warehouse',
    permissions: [
      'products:read',
      'inventory:read',
      'inventory:write',
      'warehouses:read',
      'warehouses:write',
      'purchase:read',
      'returns:read',
      'messages:read',
      'print:write'
    ]
  }
]

function normalizeRoleName(value) {
  const name = String(value || '').trim()
  return ROLE_ALIASES[name] || name
}

function getRoleDefinition(roleName) {
  const normalized = normalizeRoleName(roleName)
  return ROLE_DEFS.find(role => role.name === normalized) || null
}

function uniquePermissions(values) {
  return Array.from(new Set((values || []).filter(Boolean)))
}

function getPermissionsForRole(roleName, storedPermissions) {
  const def = getRoleDefinition(roleName)
  const stored = Array.isArray(storedPermissions) ? storedPermissions : []
  const permissions = stored.length ? stored : (def ? def.permissions : [])
  return uniquePermissions(permissions)
}

function getDataScopeForRole(roleName) {
  const def = getRoleDefinition(roleName)
  return def ? def.dataScope : 'none'
}

function mergeRoleContext(roles = []) {
  const normalizedRoles = roles
    .map(role => ({
      ...role,
      name: normalizeRoleName(role && role.name)
    }))
    .filter(role => role.name)
  const roleNames = Array.from(new Set(normalizedRoles.map(role => role.name)))
  const permissions = uniquePermissions(normalizedRoles.flatMap(role => getPermissionsForRole(role.name, role.permissions)))
  const dataScopes = Array.from(new Set(roleNames.map(getDataScopeForRole).filter(scope => scope && scope !== 'none')))
  return {
    primaryRoleName: roleNames[0] || '',
    roleNames,
    permissions,
    dataScopes,
    dataScope: dataScopes.includes('all') ? 'all' : (dataScopes[0] || 'none')
  }
}

function hasPermission(context, required) {
  if (!required) return true
  const permissions = Array.isArray(context && context.permissions) ? context.permissions : []
  return permissions.includes(required)
}

function isWarehouseScoped(context, area = 'default') {
  const scopes = Array.isArray(context && context.dataScopes)
    ? context.dataScopes
    : [context && context.dataScope].filter(Boolean)
  if (!scopes.length || scopes.includes('all')) return false
  if (['sales', 'receipts', 'customers'].includes(area) && (scopes.includes('finance') || scopes.includes('own_or_authorized'))) return false
  if (area === 'returns' && (scopes.includes('finance') || scopes.includes('own_or_authorized'))) return false
  if (['purchase', 'inventory', 'warehouses'].includes(area)) return scopes.some(scope => ['purchase_inventory', 'warehouse'].includes(scope))
  return scopes.some(scope => ['purchase_inventory', 'warehouse'].includes(scope))
}

function assertPermission(context, required) {
  if (hasPermission(context, required)) return
  const error = new Error('当前账号没有该操作权限')
  error.statusCode = 403
  throw error
}

function canAccessWarehouse(context, warehouseId) {
  if (!warehouseId) return true
  if (!context || context.dataScope === 'all') return true
  if (!isWarehouseScoped(context)) return true
  const ids = Array.isArray(context.warehouseIds) ? context.warehouseIds : []
  return ids.length === 0 || ids.includes(String(warehouseId))
}

function assertWarehouseAccess(context, warehouseId) {
  if (canAccessWarehouse(context, warehouseId)) return
  const error = new Error('当前账号没有该仓库数据权限')
  error.statusCode = 403
  throw error
}

module.exports = {
  PERMISSION_LABELS,
  ROLE_DEFS,
  assertPermission,
  assertWarehouseAccess,
  canAccessWarehouse,
  getDataScopeForRole,
  getPermissionsForRole,
  getRoleDefinition,
  hasPermission,
  isWarehouseScoped,
  mergeRoleContext,
  normalizeRoleName
}
