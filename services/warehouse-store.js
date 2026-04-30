const warehouseStorageKey = 'textile_warehouses_v1'

let cachedWarehouses

function canUseStorage() {
  return typeof wx !== 'undefined' && wx.getStorageSync && wx.setStorageSync
}

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

const warehouseSeed = [
  {
    id: 'default',
    name: '默认仓',
    keeper: '王姐',
    address: '贵阳白云区俊发回区',
    isDefault: true,
    statusKey: 'enabled'
  },
  {
    id: 'dyeing',
    name: '投色仓',
    keeper: '王姐',
    address: '贵阳白云区投色区 2 栋',
    isDefault: false,
    statusKey: 'enabled'
  },
  {
    id: 'accessory',
    name: '辅料仓',
    keeper: '群群',
    address: '辅料区 1 栋',
    isDefault: false,
    statusKey: 'enabled'
  }
]

function normalizeWarehouse(warehouse) {
  const statusKey = warehouse.statusKey === 'disabled' ? 'disabled' : 'enabled'
  return {
    ...warehouse,
    id: warehouse.id || `WH${Date.now()}`,
    name: String(warehouse.name || '未命名仓库').trim(),
    keeper: String(warehouse.keeper || '').trim(),
    address: String(warehouse.address || '').trim(),
    isDefault: Boolean(warehouse.isDefault),
    statusKey,
    statusText: statusKey === 'enabled' ? '启用' : '停用',
    statusTone: statusKey === 'enabled' ? 'success' : 'muted',
    defaultText: warehouse.isDefault ? '默认仓' : ''
  }
}

function saveWarehouses() {
  if (!canUseStorage()) return
  wx.setStorageSync(warehouseStorageKey, cachedWarehouses)
}

function ensureDefault(warehouses) {
  if (!warehouses.some(warehouse => warehouse.isDefault) && warehouses.length) {
    warehouses[0].isDefault = true
    warehouses[0].statusKey = 'enabled'
  }
  return warehouses
}

function loadWarehouses() {
  if (cachedWarehouses) return cachedWarehouses

  if (canUseStorage()) {
    const stored = wx.getStorageSync(warehouseStorageKey)
    if (Array.isArray(stored) && stored.length) {
      cachedWarehouses = ensureDefault(stored.map(normalizeWarehouse))
      return cachedWarehouses
    }
  }

  cachedWarehouses = ensureDefault(clone(warehouseSeed).map(normalizeWarehouse))
  saveWarehouses()
  return cachedWarehouses
}

function getWarehouseList() {
  return loadWarehouses()
}

function getWarehouse(id) {
  const decodedId = decodeURIComponent(id || '')
  return loadWarehouses().find(warehouse => warehouse.id === decodedId) || loadWarehouses()[0]
}

function getWarehouseNames() {
  const managedNames = loadWarehouses()
    .filter(warehouse => warehouse.statusKey === 'enabled')
    .map(warehouse => warehouse.name)
  try {
    const productStore = require('./product-store')
    return Array.from(new Set(managedNames.concat(productStore.getWarehouses())))
  } catch (error) {
    return managedNames
  }
}

function getWarehouseSummary() {
  const warehouses = loadWarehouses()
  return {
    warehouseCount: warehouses.length,
    enabledCount: warehouses.filter(warehouse => warehouse.statusKey === 'enabled').length,
    defaultName: (warehouses.find(warehouse => warehouse.isDefault) || {}).name || '未设置'
  }
}

function getWarehouseForm(id) {
  const warehouse = id ? getWarehouse(id) : null
  if (!warehouse) {
    return {
      mode: 'create',
      id: '',
      name: '',
      keeper: '',
      address: '',
      isDefault: false,
      statusKey: 'enabled'
    }
  }

  return {
    mode: 'edit',
    id: warehouse.id,
    name: warehouse.name,
    keeper: warehouse.keeper,
    address: warehouse.address,
    isDefault: warehouse.isDefault,
    statusKey: warehouse.statusKey
  }
}

function saveWarehouseForm(form) {
  const name = String(form.name || '').trim()
  if (!name) return { ok: false, message: '请输入仓库名称' }

  const oldId = decodeURIComponent(form.id || '')
  const warehouses = loadWarehouses()
  const duplicate = warehouses.find(warehouse => warehouse.name === name && warehouse.id !== oldId)
  if (duplicate) return { ok: false, message: '仓库名称已存在' }

  const next = normalizeWarehouse({
    id: oldId || `WH${Date.now()}`,
    name,
    keeper: form.keeper,
    address: form.address,
    isDefault: Boolean(form.isDefault),
    statusKey: form.isDefault ? 'enabled' : form.statusKey
  })

  cachedWarehouses = warehouses
    .filter(warehouse => warehouse.id !== oldId)
    .map(warehouse => next.isDefault ? { ...warehouse, isDefault: false } : warehouse)
    .concat(next)
    .map(normalizeWarehouse)

  cachedWarehouses = ensureDefault(cachedWarehouses)
  saveWarehouses()
  return { ok: true, warehouse: next }
}

function toggleWarehouseStatus(id) {
  const warehouse = getWarehouse(id)
  if (!warehouse) return { ok: false, message: '仓库不存在' }
  if (warehouse.isDefault && warehouse.statusKey === 'enabled') {
    return { ok: false, message: '默认仓不可停用' }
  }

  cachedWarehouses = loadWarehouses().map(item => {
    if (item.id !== warehouse.id) return item
    return normalizeWarehouse({
      ...item,
      statusKey: item.statusKey === 'enabled' ? 'disabled' : 'enabled'
    })
  })
  cachedWarehouses = ensureDefault(cachedWarehouses)
  saveWarehouses()
  return { ok: true, warehouse: getWarehouse(id) }
}

module.exports = {
  getWarehouse,
  getWarehouseForm,
  getWarehouseList,
  getWarehouseNames,
  getWarehouseSummary,
  saveWarehouseForm,
  toggleWarehouseStatus
}
