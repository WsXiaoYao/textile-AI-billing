const fs = require('fs')
const path = require('path')
const { fail, ok } = require('../response')
const { resolveOrgContext } = require('../request-context')
const { buildAuthContext, getBearerToken, hashToken, resolveAuthSession } = require('../auth-service')
const { mergeRoleContext } = require('../permissions')
const { writeAudit } = require('../audit-log')

const uploadRoot = path.join(__dirname, '..', '..', 'uploads', 'receipt-codes')

function normalizeText(value) {
  return String(value || '').trim()
}

function toDto(context, setting) {
  return {
    org: {
      id: context.organization.id,
      name: context.organization.name,
      code: context.organization.code || '',
      tenantId: context.tenantId || ''
    },
    imagePath: setting && setting.paymentQrcodeUrl ? setting.paymentQrcodeUrl : '',
    paymentQrcodeUrl: setting && setting.paymentQrcodeUrl ? setting.paymentQrcodeUrl : '',
    note: setting && setting.qrcodeRemark ? setting.qrcodeRemark : '门店统一收款码，打印模板与分享票据优先使用。',
    qrcodeRemark: setting && setting.qrcodeRemark ? setting.qrcodeRemark : ''
  }
}

function roleText(employee) {
  const roleContext = mergeRoleContext(
    employee && Array.isArray(employee.employeeRoles) && employee.employeeRoles.length
      ? employee.employeeRoles.map(row => row.role).filter(Boolean)
      : employee && employee.role
        ? [employee.role]
        : []
  )
  return {
    role: roleContext.roleNames.length ? roleContext.roleNames.join('、') : '未分配',
    roleNames: roleContext.roleNames,
    permissions: roleContext.permissions,
    dataScope: roleContext.dataScope,
    dataScopes: roleContext.dataScopes
  }
}

function warehouseText(employee) {
  const count = Array.isArray(employee && employee.warehouseIds) ? employee.warehouseIds.length : 0
  return count > 0 ? `${count} 个仓库` : '全部仓库'
}

function canUse(context, permissions = []) {
  if (!permissions.length) return true
  const owned = Array.isArray(context.permissions) ? context.permissions : []
  return permissions.some(permission => owned.includes(permission))
}

function buildProfileHome(context, unreadCount = 0) {
  const employee = context.employee || {}
  const user = context.user || {}
  const org = context.organization || {}
  const name = employee.name || user.name || '未登录用户'
  const phone = employee.phone || user.phone || ''
  const role = Array.isArray(context.roleNames) && context.roleNames.length
    ? context.roleNames.join('、')
    : context.roleName || '未分配'
  const settings = [
    { key: 'receipt-code', title: '收款码设置', icon: '/assets/icons/lucide/ui/qr-code-blue.svg', tone: 'primary', permissions: ['settings:read', 'settings:write'] },
    { key: 'staff-permission', title: '员工权限', icon: '/assets/icons/lucide/ui/users-green.svg', tone: 'success', permissions: ['settings:read', 'settings:write'] },
    { key: 'print-settings', title: '打印设置', icon: '/assets/icons/lucide/ui/printer-orange.svg', tone: 'warning', permissions: ['print:write'] },
    { key: 'message-center', title: '消息中心', icon: '/assets/icons/lucide/ui/bell-dark.svg', tone: 'primary', badge: unreadCount, permissions: ['messages:read'] }
  ].filter(item => canUse(context, item.permissions))

  return {
    user: {
      id: user.id || '',
      name,
      phone,
      role,
      avatarText: String(name || '用').slice(0, 1)
    },
    org: {
      id: org.id || '',
      name: org.name || '',
      code: org.code || '',
      role,
      permissionText: warehouseText(employee)
    },
    settings,
    helps: [
      { key: 'manual', title: '操作手册', icon: '/assets/icons/lucide/ui/file-text-purple.svg', tone: 'purple' },
      { key: 'support', title: '套餐购买', icon: '/assets/icons/lucide/ui/shield-check-green.svg', tone: 'success' }
    ]
  }
}

async function getUnreadCount(prisma, orgId) {
  return prisma.message.count({
    where: {
      orgId,
      status: 'unread'
    }
  }).catch(() => 0)
}

async function findEmployeeForUser(prisma, userId, orgId) {
  return prisma.employee.findFirst({
    where: {
      userId,
      orgId,
      status: 'enabled'
    },
    include: {
      organization: true,
      role: true,
      employeeRoles: {
        include: { role: true },
        orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }]
      }
    }
  })
}

async function getSetting(prisma, context) {
  return prisma.orgSetting.upsert({
    where: { orgId: context.orgId },
    update: {
      tenantId: context.tenantId
    },
    create: {
      tenantId: context.tenantId,
      orgId: context.orgId,
      paymentQrcodeUrl: '',
      qrcodeRemark: ''
    }
  })
}

function getPublicBaseUrl(request) {
  const host = request.headers['x-forwarded-host'] || request.headers.host || ''
  const protocol = request.headers['x-forwarded-proto'] || 'http'
  return `${protocol}://${host}`
}

function parseImagePayload(payload) {
  const raw = normalizeText(payload.imageBase64 || payload.base64)
  if (!raw) return null
  const matched = raw.match(/^data:image\/(png|jpe?g|webp);base64,(.+)$/i)
  const ext = normalizeText(payload.ext || payload.fileExt || (matched && matched[1]) || 'png')
    .replace(/^jpeg$/i, 'jpg')
    .toLowerCase()
  const safeExt = ['png', 'jpg', 'webp'].includes(ext) ? ext : 'png'
  return {
    ext: safeExt,
    base64: matched ? matched[2] : raw
  }
}

async function organizationRoutes(app) {
  app.get('/organizations/current', async request => {
    const context = await resolveOrgContext(app.prisma, request)
    return ok({
      id: context.organization.id,
      name: context.organization.name,
      code: context.organization.code || '',
      tenantId: context.tenantId || '',
      role: Array.isArray(context.roleNames) ? context.roleNames.join('、') : context.roleName || '',
      permissionText: warehouseText(context.employee)
    }, request.id)
  })

  app.get('/organizations', async request => {
    const context = await resolveOrgContext(app.prisma, request)
    const keyword = normalizeText(request.query && request.query.keyword).toLowerCase()
    const rels = await app.prisma.userOrgRel.findMany({
      where: { userId: context.userId },
      include: {
        organization: true,
        employee: {
          include: {
            role: true,
            employeeRoles: {
              include: { role: true },
              orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }]
            }
          }
        }
      },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }]
    })
    const list = rels
      .filter(rel => rel.organization && (!rel.employee || rel.employee.status === 'enabled'))
      .map(rel => {
        const employee = rel.employee || {}
        const role = roleText(employee)
        const org = rel.organization
        return {
          id: org.id,
          name: org.name,
          code: org.code || '',
          desc: `${org.name} · ${role.role}`,
          role: role.role,
          roleNames: role.roleNames,
          warehouseCount: Array.isArray(employee.warehouseIds) ? employee.warehouseIds.length : 0,
          permissionText: warehouseText(employee),
          active: org.id === context.orgId,
          actionText: org.id === context.orgId ? '当前' : '可切换',
          actionTone: org.id === context.orgId ? 'success' : 'primary'
        }
      })
      .filter(org => !keyword || [org.name, org.code, org.desc, org.role].join(' ').toLowerCase().includes(keyword))

    return ok({ list, total: list.length }, request.id)
  })

  app.post('/organizations/switch', async (request, reply) => {
    const token = getBearerToken(request)
    const session = await resolveAuthSession(app.prisma, token)
    if (!session) {
      reply.code(401)
      return fail('未登录或登录已过期', { code: 401, traceId: request.id })
    }

    const orgId = normalizeText(request.body && request.body.orgId)
    const target = await app.prisma.organization.findFirst({
      where: {
        OR: [
          { id: orgId },
          { code: orgId }
        ]
      }
    })
    if (!target) {
      reply.code(403)
      return fail('无权切换到该组织', { code: 403, traceId: request.id })
    }
    const employee = await findEmployeeForUser(app.prisma, session.userId, target.id)
    if (!employee) {
      reply.code(403)
      return fail('无权切换到该组织', { code: 403, traceId: request.id })
    }

    await app.prisma.authSession.update({
      where: { tokenHash: hashToken(token) },
      data: {
        tenantId: target.tenantId || employee.tenantId || session.tenantId,
        orgId: target.id,
        employeeId: employee.id
      }
    })
    await app.prisma.userOrgRel.updateMany({
      where: { userId: session.userId },
      data: { isDefault: false }
    })
    await app.prisma.userOrgRel.updateMany({
      where: { userId: session.userId, orgId: target.id },
      data: { isDefault: true, employeeId: employee.id }
    })
    await app.prisma.message.create({
      data: {
        tenantId: target.tenantId || employee.tenantId || session.tenantId,
        orgId: target.id,
        type: 'organization_notice',
        status: 'unread',
        title: '组织切换提醒',
        content: `已切换到${target.name}，客户、单据、库存和收款码将按当前组织重新加载。`,
        refType: 'organization',
        refId: target.id
      }
    })
    await writeAudit(app.prisma, {
      tenantId: target.tenantId || employee.tenantId || session.tenantId,
      orgId: target.id,
      employeeId: employee.id,
      userId: session.userId
    }, {
      action: 'switch',
      entity: 'organization',
      entityId: target.id,
      before: { orgId: session.orgId },
      after: { orgId: target.id }
    })

    return ok({
      ...buildAuthContext(session.user, employee),
      token,
      switched: true
    }, request.id)
  })

  app.get('/profile/home', async request => {
    const context = await resolveOrgContext(app.prisma, request)
    const unreadCount = await getUnreadCount(app.prisma, context.orgId)
    return ok(buildProfileHome(context, unreadCount), request.id)
  })

  app.get('/organizations/receipt-settings', async request => {
    const context = await resolveOrgContext(app.prisma, request)
    const setting = await getSetting(app.prisma, context)
    return ok(toDto(context, setting), request.id)
  })

  app.put('/organizations/receipt-settings', async (request, reply) => {
    const context = await resolveOrgContext(app.prisma, request)
    const payload = request.body || {}
    const note = normalizeText(payload.note || payload.qrcodeRemark)
    const imagePath = normalizeText(payload.imagePath || payload.paymentQrcodeUrl)

    if (note.length > 500) {
      reply.code(400)
      return fail('收款码备注不能超过500字', { code: 400, traceId: request.id })
    }
    if (imagePath.length > 500) {
      reply.code(400)
      return fail('收款码图片地址不能超过500字', { code: 400, traceId: request.id })
    }

    const setting = await app.prisma.orgSetting.upsert({
      where: { orgId: context.orgId },
      update: {
        tenantId: context.tenantId,
        paymentQrcodeUrl: imagePath,
        qrcodeRemark: note
      },
      create: {
        tenantId: context.tenantId,
        orgId: context.orgId,
        paymentQrcodeUrl: imagePath,
        qrcodeRemark: note
      }
    })

    return ok(toDto(context, setting), request.id)
  })

  app.post('/organizations/receipt-code-image', { bodyLimit: 16 * 1024 * 1024 }, async (request, reply) => {
    const context = await resolveOrgContext(app.prisma, request)
    const image = parseImagePayload(request.body || {})
    if (!image) {
      reply.code(400)
      return fail('请上传收款码图片', { code: 400, traceId: request.id })
    }

    let buffer
    try {
      buffer = Buffer.from(image.base64, 'base64')
    } catch (error) {
      reply.code(400)
      return fail('收款码图片格式不正确', { code: 400, traceId: request.id })
    }

    if (!buffer.length || buffer.length > 5 * 1024 * 1024) {
      reply.code(400)
      return fail('收款码图片大小不能超过5MB', { code: 400, traceId: request.id })
    }

    await fs.promises.mkdir(uploadRoot, { recursive: true })
    const filename = `${context.orgId}-${Date.now()}.${image.ext}`
    const filepath = path.join(uploadRoot, filename)
    await fs.promises.writeFile(filepath, buffer)

    const imageUrl = `${getPublicBaseUrl(request)}/api/v1/uploads/receipt-codes/${filename}`
    const setting = await app.prisma.orgSetting.upsert({
      where: { orgId: context.orgId },
      update: {
        tenantId: context.tenantId,
        paymentQrcodeUrl: imageUrl
      },
      create: {
        tenantId: context.tenantId,
        orgId: context.orgId,
        paymentQrcodeUrl: imageUrl,
        qrcodeRemark: ''
      }
    })

    return ok({
      ...toDto(context, setting),
      imageUrl
    }, request.id)
  })

  app.get('/uploads/receipt-codes/:filename', async (request, reply) => {
    const filename = path.basename(String(request.params.filename || ''))
    const filepath = path.join(uploadRoot, filename)
    if (!filename || !fs.existsSync(filepath)) {
      reply.code(404)
      return fail('图片不存在', { code: 404, traceId: request.id })
    }

    const ext = path.extname(filename).toLowerCase()
    const contentType = ext === '.jpg' || ext === '.jpeg'
      ? 'image/jpeg'
      : ext === '.webp'
        ? 'image/webp'
        : 'image/png'
    reply.type(contentType)
    return fs.createReadStream(filepath)
  })
}

module.exports = {
  organizationRoutes
}
