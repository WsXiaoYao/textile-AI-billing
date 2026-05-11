const crypto = require('crypto')
const { env } = require('./env')

let accessTokenCache = null

const DEFAULT_PERMISSIONS = [
  'sales:read',
  'sales:write',
  'customers:read',
  'customers:write',
  'products:read',
  'products:write',
  'inventory:read',
  'inventory:write',
  'purchase:read',
  'purchase:write',
  'settings:read',
  'settings:write'
]

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

function createToken() {
  return `juyun_${crypto.randomBytes(32).toString('base64url')}`
}

function getBearerToken(request) {
  const authorization = request.headers.authorization || request.headers.Authorization || ''
  const match = String(authorization).match(/^Bearer\s+(.+)$/i)
  return match ? match[1].trim() : ''
}

function normalizePhone(phone) {
  return String(phone || '').replace(/[^\d]/g, '')
}

function assertWechatConfigured() {
  if (!env.WECHAT_APP_ID || !env.WECHAT_APP_SECRET) {
    throw new Error('微信登录未配置 WECHAT_APP_ID 或 WECHAT_APP_SECRET')
  }
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options)
  const body = await response.json()
  if (!response.ok) {
    throw new Error(body.errmsg || body.message || `微信接口请求失败：HTTP ${response.status}`)
  }
  return body
}

async function getWechatAccessToken() {
  assertWechatConfigured()
  const now = Date.now()
  if (accessTokenCache && accessTokenCache.expiresAt > now + 60000) {
    return accessTokenCache.token
  }

  const url = new URL('https://api.weixin.qq.com/cgi-bin/token')
  url.searchParams.set('grant_type', 'client_credential')
  url.searchParams.set('appid', env.WECHAT_APP_ID)
  url.searchParams.set('secret', env.WECHAT_APP_SECRET)

  const body = await fetchJson(url.toString())
  if (body.errcode) {
    throw new Error(body.errmsg || `获取微信 access_token 失败：${body.errcode}`)
  }

  accessTokenCache = {
    token: body.access_token,
    expiresAt: now + Number(body.expires_in || 7200) * 1000
  }

  return accessTokenCache.token
}

async function getWechatPhoneInfo(payload) {
  if (env.WECHAT_MOCK_LOGIN) {
    const mockPhone = normalizePhone(payload.mockPhone || payload.phone || payload.phoneCode)
    return {
      phoneNumber: mockPhone.length >= 7 ? mockPhone : '1358270496',
      purePhoneNumber: mockPhone.length >= 7 ? mockPhone : '1358270496',
      countryCode: '86'
    }
  }

  const accessToken = await getWechatAccessToken()
  const url = `https://api.weixin.qq.com/wxa/business/getuserphonenumber?access_token=${encodeURIComponent(accessToken)}`
  const body = await fetchJson(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code: payload.phoneCode })
  })

  if (body.errcode) {
    throw new Error(body.errmsg || `获取微信手机号失败：${body.errcode}`)
  }

  return body.phone_info || {}
}

async function getWechatOpenid(loginCode) {
  if (!loginCode) return null

  if (env.WECHAT_MOCK_LOGIN) {
    return { openid: `mock_${loginCode}`, unionid: null }
  }

  assertWechatConfigured()
  const url = new URL('https://api.weixin.qq.com/sns/jscode2session')
  url.searchParams.set('appid', env.WECHAT_APP_ID)
  url.searchParams.set('secret', env.WECHAT_APP_SECRET)
  url.searchParams.set('js_code', loginCode)
  url.searchParams.set('grant_type', 'authorization_code')

  const body = await fetchJson(url.toString())
  if (body.errcode) {
    throw new Error(body.errmsg || `微信登录凭证校验失败：${body.errcode}`)
  }

  return {
    openid: body.openid,
    unionid: body.unionid || null
  }
}

async function findOrCreateUser(prisma, phoneInfo, wechatIdentity) {
  const phone = normalizePhone(phoneInfo.purePhoneNumber || phoneInfo.phoneNumber)
  if (!phone) {
    throw new Error('没有获取到有效手机号')
  }

  const name = `用户${phone.slice(-4)}`
  const countryCode = phoneInfo.countryCode || '86'
  let user = await prisma.user.findUnique({ where: { phone } })

  if (!user && wechatIdentity && wechatIdentity.openid) {
    user = await prisma.user.findUnique({ where: { openid: wechatIdentity.openid } })
  }

  if (user) {
    const boundPhoneUser = await prisma.user.findUnique({ where: { phone } })
    if (boundPhoneUser && boundPhoneUser.id !== user.id) {
      throw new Error('该手机号已绑定其他微信账号')
    }

    if (wechatIdentity && wechatIdentity.openid) {
      const boundUser = await prisma.user.findUnique({ where: { openid: wechatIdentity.openid } })
      if (boundUser && boundUser.id !== user.id) {
        throw new Error('该微信账号已绑定其他手机号')
      }
    }

    return prisma.user.update({
      where: { id: user.id },
      data: {
        phone,
        phoneCountryCode: countryCode,
        phoneVerifiedAt: new Date(),
        openid: user.openid || (wechatIdentity && wechatIdentity.openid) || undefined,
        unionid: user.unionid || (wechatIdentity && wechatIdentity.unionid) || undefined
      }
    })
  }

  return prisma.user.create({
    data: {
      name,
      phone,
      phoneCountryCode: countryCode,
      phoneVerifiedAt: new Date(),
      openid: wechatIdentity && wechatIdentity.openid,
      unionid: wechatIdentity && wechatIdentity.unionid
    }
  })
}

async function ensureDefaultEmployee(prisma, user) {
  await prisma.employee.updateMany({
    where: {
      phone: user.phone,
      userId: null
    },
    data: {
      userId: user.id
    }
  })

  let employee = await prisma.employee.findFirst({
    where: { userId: user.id },
    include: {
      organization: true,
      role: true
    },
    orderBy: { createdAt: 'asc' }
  })

  if (employee || !env.AUTH_AUTO_PROVISION) return employee

  const organization = await prisma.organization.upsert({
    where: { code: 'org-main' },
    update: {},
    create: {
      code: 'org-main',
      name: '聚云纺织'
    }
  })

  const role = await prisma.role.upsert({
    where: {
      orgId_name: {
        orgId: organization.id,
        name: '老板'
      }
    },
    update: {},
    create: {
      orgId: organization.id,
      name: '老板',
      description: '默认拥有全部业务权限',
      permissions: DEFAULT_PERMISSIONS
    }
  })

  employee = await prisma.employee.create({
    data: {
      orgId: organization.id,
      userId: user.id,
      roleId: role.id,
      name: user.name || `用户${String(user.phone || '').slice(-4)}`,
      phone: user.phone,
      status: 'enabled',
      warehouseIds: []
    },
    include: {
      organization: true,
      role: true
    }
  })

  return employee
}

function buildAuthContext(user, employee) {
  const permissions = Array.isArray(employee && employee.role && employee.role.permissions)
    ? employee.role.permissions
    : DEFAULT_PERMISSIONS

  return {
    user: {
      id: user.id,
      name: user.name,
      phone: user.phone,
      phoneCountryCode: user.phoneCountryCode,
      phoneVerifiedAt: user.phoneVerifiedAt,
      openidBound: Boolean(user.openid)
    },
    currentOrg: employee && employee.organization ? {
      id: employee.organization.id,
      name: employee.organization.name,
      code: employee.organization.code
    } : null,
    employee: employee ? {
      id: employee.id,
      name: employee.name,
      phone: employee.phone,
      status: employee.status,
      roleId: employee.roleId,
      role: employee.role ? employee.role.name : '',
      warehouseIds: employee.warehouseIds || []
    } : null,
    permissions
  }
}

async function createAuthSession(prisma, user, employee) {
  const token = createToken()
  const expiresAt = new Date(Date.now() + env.AUTH_SESSION_DAYS * 24 * 60 * 60 * 1000)

  await prisma.authSession.create({
    data: {
      userId: user.id,
      orgId: employee && employee.orgId,
      employeeId: employee && employee.id,
      tokenHash: hashToken(token),
      expiresAt
    }
  })

  return {
    token,
    expiresAt
  }
}

async function resolveAuthSession(prisma, token) {
  if (!token) return null

  const session = await prisma.authSession.findUnique({
    where: { tokenHash: hashToken(token) },
    include: {
      user: true,
      employee: {
        include: {
          organization: true,
          role: true
        }
      }
    }
  })

  if (!session || session.expiresAt <= new Date()) return null
  return session
}

module.exports = {
  buildAuthContext,
  createAuthSession,
  findOrCreateUser,
  getBearerToken,
  getWechatOpenid,
  getWechatPhoneInfo,
  hashToken,
  resolveAuthSession,
  ensureDefaultEmployee
}
