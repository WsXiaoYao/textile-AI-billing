const { fail, ok } = require('../response')
const { resolveOrgContext } = require('../request-context')
const {
  PERMISSION_LABELS,
  ROLE_DEFS,
  getPermissionsForRole,
  normalizeRoleName
} = require('../permissions')

function normalizeText(value) {
  return String(value || '').trim()
}

function normalizePhone(value) {
  return String(value || '').replace(/\D/g, '').slice(0, 11)
}

function getStatusMeta(status) {
  return status === 'disabled'
    ? { key: 'disabled', text: '禁用', tone: 'warning' }
    : { key: 'enabled', text: '启用', tone: 'success' }
}

function permissionText(role, status) {
  if (status === 'disabled') return '禁用后不可登录'
  const name = role && role.name ? normalizeRoleName(role.name) : '未分配'
  if (name === '老板') return '可管理组织员工与全部业务数据'
  if (name === '业务员') return '可处理客户、销售单、收款与退货'
  if (name === '采购') return '可处理供应商、采购与库存查询'
  if (name === '仓管') return '可处理仓库、库存与调整'
  if (name === '财务') return '可处理客户往来与资金流水'
  return '按角色权限查看业务数据'
}

function getEmployeeRoles(employee) {
  const rows = Array.isArray(employee.employeeRoles) ? employee.employeeRoles : []
  const roles = rows.map(row => row.role).filter(Boolean)
  if (roles.length) return roles
  return employee.role ? [employee.role] : []
}

function toRoleDto(role, selectedRoleIds = []) {
  const roleName = normalizeRoleName(role.name)
  const permissionCodes = getPermissionsForRole(roleName, role.permissions)
  return {
    id: role.id,
    name: roleName,
    desc: role.description || '',
    scopeText: role.description || '',
    permissions: permissionCodes.map(code => PERMISSION_LABELS[code] || code),
    permissionCodes,
    selected: selectedRoleIds.includes(role.id)
  }
}

function toWarehouseDto(warehouse) {
  return {
    id: warehouse.id,
    name: warehouse.name,
    label: warehouse.name,
    value: warehouse.id,
    isDefault: Boolean(warehouse.isDefault),
    status: warehouse.status
  }
}

function getEmployeeWarehouses(employee) {
  const rows = Array.isArray(employee.employeeWarehouses) ? employee.employeeWarehouses : []
  return rows
    .filter(row => row.warehouse)
    .map(row => toWarehouseDto(row.warehouse))
}

function toEmployeeDto(employee) {
  const roles = getEmployeeRoles(employee)
  const role = roles[0] || employee.role || null
  const status = getStatusMeta(employee.status)
  const warehouses = getEmployeeWarehouses(employee)
  const warehouseIds = warehouses.map(warehouse => warehouse.id)
  const warehouseText = warehouses.length ? warehouses.map(warehouse => warehouse.name).join('、') : '未绑定仓库'
  const phone = employee.phone || (employee.user && employee.user.phone) || ''
  const roleIds = roles.map(item => item.id).filter(Boolean)
  const roleNames = roles.map(item => normalizeRoleName(item.name)).filter(Boolean)
  const roleName = roleNames.length ? roleNames.join('、') : '未分配'

  return {
    id: employee.id,
    userId: employee.userId || '',
    name: employee.name,
    phone,
    roleId: employee.roleId || '',
    roleIds,
    roleNames,
    roleName,
    status: employee.status,
    statusKey: status.key,
    statusText: status.text,
    statusTone: status.tone,
    warehouses,
    warehouseIds,
    warehouseText,
    warehouseCount: warehouseIds.length,
    remark: employee.remark || '',
    desc: `${roleName} · ${phone || '未填写手机号'} · 绑定仓库 ${warehouseIds.length}`,
    permissionText: roleNames.length > 1 ? `组合角色：${roleNames.join('、')}` : permissionText(role, employee.status),
    searchText: [employee.name, phone, roleName, warehouseText].join(' ').toLowerCase(),
    createdAt: employee.createdAt,
    updatedAt: employee.updatedAt
  }
}

async function ensureRoles(prisma, orgId, tenantId) {
  const roles = []
  for (const role of ROLE_DEFS) {
    roles.push(await prisma.role.upsert({
      where: {
        orgId_name: {
          orgId,
          name: role.name
        }
      },
      update: {
        tenantId,
        description: role.description,
        permissions: role.permissions
      },
      create: {
        tenantId,
        orgId,
        name: role.name,
        description: role.description,
        permissions: role.permissions
      }
    }))
  }
  return roles
}

async function ensureDefaultWarehouse(prisma, orgId, tenantId) {
  const existing = await prisma.warehouse.findFirst({
    where: {
      orgId,
      status: 'enabled'
    },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }]
  })
  if (existing) return existing
  return prisma.warehouse.create({
    data: {
      tenantId,
      orgId,
      name: '默认仓',
      manager: '',
      address: '',
      isDefault: true,
      status: 'enabled'
    }
  })
}

async function getWarehouseIds(prisma, orgId, tenantId, rawWarehouseIds) {
  await ensureDefaultWarehouse(prisma, orgId, tenantId)
  const warehouses = await prisma.warehouse.findMany({
    where: {
      orgId,
      status: 'enabled'
    },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }]
  })
  const allIds = warehouses.map(warehouse => warehouse.id)
  if (!Array.isArray(rawWarehouseIds) || !rawWarehouseIds.length) return allIds.slice(0, 1)
  if (rawWarehouseIds.includes('__all__')) return allIds
  const selected = rawWarehouseIds.map(String).filter(id => allIds.includes(id))
  return selected.length ? selected : allIds.slice(0, 1)
}

async function syncEmployeeWarehouses(prisma, employee, tenantId, warehouseIds) {
  await prisma.employeeWarehouse.deleteMany({
    where: {
      employeeId: employee.id,
      warehouseId: {
        notIn: warehouseIds
      }
    }
  })

  for (const [index, warehouseId] of warehouseIds.entries()) {
    await prisma.employeeWarehouse.upsert({
      where: {
        employeeId_warehouseId: {
          employeeId: employee.id,
          warehouseId
        }
      },
      update: {
        tenantId,
        orgId: employee.orgId,
        isDefault: index === 0
      },
      create: {
        tenantId,
        orgId: employee.orgId,
        employeeId: employee.id,
        warehouseId,
        isDefault: index === 0
      }
    })
  }

  await prisma.employee.update({
    where: { id: employee.id },
    data: { warehouseIds }
  })
}

async function syncEmployeeRoles(prisma, employee, tenantId, roleIds) {
  const ids = Array.from(new Set((roleIds || []).map(normalizeText).filter(Boolean)))
  await prisma.employeeRole.deleteMany({
    where: {
      employeeId: employee.id,
      roleId: {
        notIn: ids
      }
    }
  })
  for (const [index, roleId] of ids.entries()) {
    await prisma.employeeRole.upsert({
      where: {
        employeeId_roleId: {
          employeeId: employee.id,
          roleId
        }
      },
      update: {
        tenantId,
        orgId: employee.orgId,
        isPrimary: index === 0
      },
      create: {
        tenantId,
        orgId: employee.orgId,
        employeeId: employee.id,
        roleId,
        isPrimary: index === 0
      }
    })
  }
}

function validateEmployeePayload(payload) {
  const name = normalizeText(payload.name)
  const phone = normalizePhone(payload.phone)
  const remark = normalizeText(payload.remark)
  const roleIds = Array.isArray(payload.roleIds)
    ? payload.roleIds.map(normalizeText).filter(Boolean)
    : [normalizeText(payload.roleId)].filter(Boolean)
  const roleId = roleIds[0] || ''
  const status = payload.statusKey === 'disabled' || payload.status === 'disabled' ? 'disabled' : 'enabled'

  if (!name) return { error: '请输入员工姓名' }
  if (name.length > 30) return { error: '员工姓名不能超过30字' }
  if (!phone) return { error: '请输入手机号' }
  if (!/^1\d{10}$/.test(phone)) return { error: '请输入11位手机号' }
  if (!roleIds.length) return { error: '请选择员工角色' }
  if (remark.length > 120) return { error: '备注不能超过120字' }

  return {
    data: {
      name,
      phone,
      remark,
      roleId,
      roleIds: Array.from(new Set(roleIds)),
      status
    }
  }
}

async function findEmployee(prisma, orgId, id) {
  return prisma.employee.findFirst({
    where: { id, orgId },
    include: {
      role: true,
      employeeRoles: {
        include: { role: true },
        orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }]
      },
      user: true,
      employeeWarehouses: {
        include: { warehouse: true },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }]
      }
    }
  })
}

async function employeeRoutes(app) {
  app.get('/employees/roles', async request => {
    const context = await resolveOrgContext(app.prisma, request)
    const roles = await ensureRoles(app.prisma, context.orgId, context.tenantId)
    const selectedRoleIds = Array.isArray((request.query || {}).selectedRoleIds)
      ? (request.query || {}).selectedRoleIds.map(normalizeText).filter(Boolean)
      : normalizeText((request.query || {}).selectedRoleIds || (request.query || {}).selectedRoleId || (request.query || {}).roleId).split(',').map(normalizeText).filter(Boolean)
    return ok(roles.map(role => toRoleDto(role, selectedRoleIds)), request.id)
  })

  app.get('/employees/warehouse-options', async request => {
    const context = await resolveOrgContext(app.prisma, request)
    await ensureDefaultWarehouse(app.prisma, context.orgId, context.tenantId)
    const warehouses = await app.prisma.warehouse.findMany({
      where: {
        orgId: context.orgId,
        status: 'enabled'
      },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }]
    })
    return ok(warehouses.map(toWarehouseDto), request.id)
  })

  app.get('/employees', async request => {
    const context = await resolveOrgContext(app.prisma, request)
    await ensureRoles(app.prisma, context.orgId, context.tenantId)
    const query = request.query || {}
    const keyword = normalizeText(query.keyword).toLowerCase()
    const status = query.statusKey || query.status
    const roleId = normalizeText(query.roleId)
    const where = {
      orgId: context.orgId,
      ...(status === 'enabled' || status === 'disabled' ? { status } : {}),
      ...(roleId ? {
        OR: [
          { roleId },
          { employeeRoles: { some: { roleId } } }
        ]
      } : {})
    }

    const employees = await app.prisma.employee.findMany({
      where,
      include: {
        role: true,
        employeeRoles: {
          include: { role: true },
          orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }]
        },
        user: true,
        employeeWarehouses: {
          include: { warehouse: true },
          orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }]
        }
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'asc' }]
    })

    const list = employees.map(toEmployeeDto).filter(employee => {
      return !keyword || employee.searchText.includes(keyword)
    })

    return ok({
      summary: {
        total: list.length,
        enabled: list.filter(employee => employee.statusKey === 'enabled').length,
        disabled: list.filter(employee => employee.statusKey === 'disabled').length
      },
      list
    }, request.id)
  })

  app.get('/employees/:id', async (request, reply) => {
    const context = await resolveOrgContext(app.prisma, request)
    const employee = await findEmployee(app.prisma, context.orgId, request.params.id)
    if (!employee) {
      reply.code(404)
      return fail('员工不存在', { code: 404, traceId: request.id })
    }
    return ok(toEmployeeDto(employee), request.id)
  })

  app.get('/employees/:id/form', async (request, reply) => {
    const context = await resolveOrgContext(app.prisma, request)
    const employee = await findEmployee(app.prisma, context.orgId, request.params.id)
    if (!employee) {
      reply.code(404)
      return fail('员工不存在', { code: 404, traceId: request.id })
    }
    return ok(toEmployeeDto(employee), request.id)
  })

  app.post('/employees', async (request, reply) => {
    const context = await resolveOrgContext(app.prisma, request)
    const parsed = validateEmployeePayload(request.body || {})
    if (parsed.error) {
      reply.code(400)
      return fail(parsed.error, { code: 400, traceId: request.id })
    }

    const roles = await app.prisma.role.findMany({
      where: {
        id: { in: parsed.data.roleIds },
        orgId: context.orgId
      }
    })
    if (roles.length !== parsed.data.roleIds.length) {
      reply.code(400)
      return fail('请选择有效员工角色', { code: 400, traceId: request.id })
    }

    const exists = await app.prisma.employee.findFirst({
      where: {
        orgId: context.orgId,
        phone: parsed.data.phone
      }
    })
    if (exists) {
      reply.code(409)
      return fail('该手机号已是当前组织员工', { code: 409, traceId: request.id })
    }

    const warehouseIds = await getWarehouseIds(app.prisma, context.orgId, context.tenantId, (request.body || {}).warehouseIds || (request.body || {}).warehouses)
    const employee = await app.prisma.$transaction(async tx => {
      const user = await tx.user.upsert({
        where: { phone: parsed.data.phone },
        update: {
          tenantId: context.tenantId,
          name: parsed.data.name,
          phoneVerifiedAt: new Date()
        },
        create: {
          tenantId: context.tenantId,
          name: parsed.data.name,
          phone: parsed.data.phone,
          phoneCountryCode: '86',
          phoneVerifiedAt: new Date()
        }
      })

      const created = await tx.employee.create({
        data: {
          tenantId: context.tenantId,
          orgId: context.orgId,
          userId: user.id,
          roleId: parsed.data.roleId,
          name: parsed.data.name,
          phone: parsed.data.phone,
          status: parsed.data.status,
          warehouseIds,
          remark: parsed.data.remark
        }
      })

      await tx.userOrgRel.upsert({
        where: {
          userId_orgId: {
            userId: user.id,
            orgId: context.orgId
          }
        },
        update: {
          tenantId: context.tenantId,
          employeeId: created.id
        },
        create: {
          tenantId: context.tenantId,
          userId: user.id,
          orgId: context.orgId,
          employeeId: created.id,
          isDefault: false
        }
      })

      await syncEmployeeWarehouses(tx, created, context.tenantId, warehouseIds)
      await syncEmployeeRoles(tx, created, context.tenantId, parsed.data.roleIds)
      return findEmployee(tx, context.orgId, created.id)
    })

    return ok(toEmployeeDto(employee), request.id)
  })

  app.put('/employees/:id', async (request, reply) => {
    const context = await resolveOrgContext(app.prisma, request)
    const existing = await app.prisma.employee.findFirst({
      where: {
        id: request.params.id,
        orgId: context.orgId
      }
    })
    if (!existing) {
      reply.code(404)
      return fail('员工不存在', { code: 404, traceId: request.id })
    }

    const parsed = validateEmployeePayload(request.body || {})
    if (parsed.error) {
      reply.code(400)
      return fail(parsed.error, { code: 400, traceId: request.id })
    }

    const duplicate = await app.prisma.employee.findFirst({
      where: {
        orgId: context.orgId,
        phone: parsed.data.phone,
        id: { not: existing.id }
      }
    })
    if (duplicate) {
      reply.code(409)
      return fail('该手机号已是当前组织员工', { code: 409, traceId: request.id })
    }

    const roles = await app.prisma.role.findMany({
      where: {
        id: { in: parsed.data.roleIds },
        orgId: context.orgId
      }
    })
    if (roles.length !== parsed.data.roleIds.length) {
      reply.code(400)
      return fail('请选择有效员工角色', { code: 400, traceId: request.id })
    }

    const warehouseIds = await getWarehouseIds(app.prisma, context.orgId, context.tenantId, (request.body || {}).warehouseIds || (request.body || {}).warehouses)
    const employee = await app.prisma.$transaction(async tx => {
      const user = await tx.user.upsert({
        where: { phone: parsed.data.phone },
        update: {
          tenantId: context.tenantId,
          name: parsed.data.name,
          phoneVerifiedAt: new Date()
        },
        create: {
          tenantId: context.tenantId,
          name: parsed.data.name,
          phone: parsed.data.phone,
          phoneCountryCode: '86',
          phoneVerifiedAt: new Date()
        }
      })

      const updated = await tx.employee.update({
        where: { id: existing.id },
        data: {
          tenantId: context.tenantId,
          userId: user.id,
          roleId: parsed.data.roleId,
          name: parsed.data.name,
          phone: parsed.data.phone,
          status: parsed.data.status,
          warehouseIds,
          remark: parsed.data.remark
        }
      })

      await tx.userOrgRel.upsert({
        where: {
          userId_orgId: {
            userId: user.id,
            orgId: context.orgId
          }
        },
        update: {
          tenantId: context.tenantId,
          employeeId: updated.id
        },
        create: {
          tenantId: context.tenantId,
          userId: user.id,
          orgId: context.orgId,
          employeeId: updated.id,
          isDefault: false
        }
      })

      await syncEmployeeWarehouses(tx, updated, context.tenantId, warehouseIds)
      await syncEmployeeRoles(tx, updated, context.tenantId, parsed.data.roleIds)
      return findEmployee(tx, context.orgId, updated.id)
    })

    return ok(toEmployeeDto(employee), request.id)
  })

  app.post('/employees/:id/status', async (request, reply) => {
    const context = await resolveOrgContext(app.prisma, request)
    const status = (request.body || {}).statusKey === 'disabled' || (request.body || {}).status === 'disabled' ? 'disabled' : 'enabled'
    if (request.params.id === context.employeeId && status === 'disabled') {
      reply.code(400)
      return fail('不能禁用当前登录员工', { code: 400, traceId: request.id })
    }

    const existing = await app.prisma.employee.findFirst({
      where: {
        id: request.params.id,
        orgId: context.orgId
      }
    })
    if (!existing) {
      reply.code(404)
      return fail('员工不存在', { code: 404, traceId: request.id })
    }

    const updated = await app.prisma.employee.update({
      where: { id: existing.id },
      data: { status }
    })
    const employee = await findEmployee(app.prisma, context.orgId, updated.id)
    return ok(toEmployeeDto(employee), request.id)
  })
}

module.exports = {
  employeeRoutes
}
