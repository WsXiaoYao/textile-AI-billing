const { getBearerToken, resolveAuthSession } = require('./auth-service')
const {
  assertPermission,
  assertWarehouseAccess,
  mergeRoleContext
} = require('./permissions')

const defaultTenantCode = 'tenant-main'
const defaultOrgCode = 'org-main'

async function ensureTenant(prisma, code = defaultTenantCode, name = '聚云掌柜租户') {
  return prisma.tenant.upsert({
    where: { code },
    update: { status: 'enabled' },
    create: { code, name, status: 'enabled' }
  })
}

async function findOrg(prisma, rawOrgId) {
  const text = String(rawOrgId || defaultOrgCode).trim() || defaultOrgCode
  return prisma.organization.findFirst({
    where: {
      OR: [
        { id: text },
        { code: text }
      ]
    }
  })
}

async function ensureFallbackOrg(prisma, rawOrgId) {
  const tenant = await ensureTenant(prisma)
  const code = String(rawOrgId || defaultOrgCode).trim() || defaultOrgCode
  return prisma.organization.upsert({
    where: { code },
    update: {
      tenantId: tenant.id
    },
    create: {
      tenantId: tenant.id,
      code,
      name: code === defaultOrgCode ? '聚云掌柜' : code
    }
  })
}

async function resolveMembership(prisma, userId, org) {
  if (!userId || !org) return null
  return prisma.employee.findFirst({
    where: {
      userId,
      orgId: org.id,
      status: 'enabled'
    },
    include: {
      organization: true,
      role: true,
      employeeRoles: {
        include: { role: true },
        orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }]
      }
    },
    orderBy: { createdAt: 'asc' }
  })
}

async function resolveOrgContext(prisma, request, options = {}) {
  const allowHeaderFallback = options.allowHeaderFallback !== false
  const token = getBearerToken(request)
  const headerOrgId = String(request.headers['x-org-id'] || '').trim()

  if (token) {
    const session = await resolveAuthSession(prisma, token)
    if (!session || !session.employee || session.employee.status !== 'enabled') {
      const error = new Error('未登录或登录已过期')
      error.statusCode = 401
      throw error
    }

    let employee = session.employee
    let organization = employee.organization
    if (headerOrgId && organization && headerOrgId !== organization.id && headerOrgId !== organization.code) {
      const targetOrg = await findOrg(prisma, headerOrgId)
      const targetEmployee = await resolveMembership(prisma, session.userId, targetOrg)
      if (!targetEmployee) {
        const error = new Error('无权访问该组织数据')
        error.statusCode = 403
        throw error
      }
      employee = targetEmployee
      organization = targetEmployee.organization
    }

    if (!organization) {
      const error = new Error('当前账号未绑定组织')
      error.statusCode = 403
      throw error
    }

    const roleContext = mergeRoleContext(
      Array.isArray(employee.employeeRoles) && employee.employeeRoles.length
        ? employee.employeeRoles.map(row => row.role).filter(Boolean)
        : [employee.role].filter(Boolean)
    )
    const tenantId = organization.tenantId || employee.tenantId || session.tenantId || null
    return {
      tenantId,
      orgId: organization.id,
      userId: session.userId,
      employeeId: employee.id,
      roleId: employee.roleId,
      roleName: roleContext.primaryRoleName,
      roleNames: roleContext.roleNames,
      role: employee.role || null,
      permissions: roleContext.permissions,
      dataScope: roleContext.dataScope,
      dataScopes: roleContext.dataScopes,
      warehouseIds: employee.warehouseIds || [],
      organization,
      employee,
      user: session.user
    }
  }

  if (!allowHeaderFallback) {
    const error = new Error('未登录或登录已过期')
    error.statusCode = 401
    throw error
  }

  const organization = await findOrg(prisma, headerOrgId || defaultOrgCode) || await ensureFallbackOrg(prisma, headerOrgId || defaultOrgCode)
  return {
    tenantId: organization.tenantId || null,
    orgId: organization.id,
    userId: '',
    employeeId: '',
    roleId: '',
    roleName: '',
    roleNames: [],
    role: null,
    permissions: [],
    dataScope: 'fallback',
    dataScopes: [],
    warehouseIds: [],
    organization,
    employee: null,
    user: null
  }
}

async function resolveOrgId(prisma, request, options = {}) {
  const context = await resolveOrgContext(prisma, request, options)
  return context.orgId
}

async function requirePermission(prisma, request, required, options = {}) {
  const context = await resolveOrgContext(prisma, request, {
    allowHeaderFallback: false,
    ...options
  })
  assertPermission(context, required)
  return context
}

function requireWarehouseAccess(context, warehouseId) {
  assertWarehouseAccess(context, warehouseId)
  return true
}

module.exports = {
  defaultOrgCode,
  defaultTenantCode,
  ensureTenant,
  requirePermission,
  requireWarehouseAccess,
  resolveOrgContext,
  resolveOrgId
}
