const {
  buildAuthContext,
  createAuthSession,
  ensureDefaultEmployee,
  findOrCreateUser,
  getBearerToken,
  hashToken,
  getWechatOpenid,
  getWechatPhoneInfo,
  resolveAuthSession
} = require('../auth-service')
const { fail, ok } = require('../response')

function buildSessionPayload(session) {
  const context = buildAuthContext(session.user, session.employee)
  return {
    ...context,
    expiresAt: session.expiresAt.toISOString()
  }
}

async function authRoutes(app) {
  app.post('/auth/wechat-phone-login', async (request, reply) => {
    const payload = request.body || {}
    if (!payload.phoneCode && !payload.mockPhone && !payload.phone) {
      reply.code(400)
      return fail('缺少微信手机号授权 code', {
        code: 400,
        traceId: request.id
      })
    }

    try {
      const [phoneInfo, wechatIdentity] = await Promise.all([
        getWechatPhoneInfo(payload),
        getWechatOpenid(payload.loginCode)
      ])
      const user = await findOrCreateUser(app.prisma, phoneInfo, wechatIdentity)
      const employee = await ensureDefaultEmployee(app.prisma, user)
      if (!employee) {
        reply.code(403)
        return fail('手机号未绑定员工，请联系管理员开通权限', {
          code: 403,
          traceId: request.id
        })
      }

      const session = await createAuthSession(app.prisma, user, employee)

      return ok({
        ...buildAuthContext(user, employee),
        token: session.token,
        expiresAt: session.expiresAt.toISOString()
      }, request.id)
    } catch (error) {
      reply.code(400)
      return fail(error.message || '微信手机号登录失败', {
        code: 400,
        traceId: request.id
      })
    }
  })

  app.get('/auth/me', async (request, reply) => {
    const token = getBearerToken(request)
    const session = await resolveAuthSession(app.prisma, token)
    if (!session) {
      reply.code(401)
      return fail('未登录或登录已过期', {
        code: 401,
        traceId: request.id
      })
    }

    return ok(buildSessionPayload(session), request.id)
  })

  app.post('/auth/logout', async request => {
    const token = getBearerToken(request)
    if (token) {
      await app.prisma.authSession.deleteMany({
        where: {
          tokenHash: hashToken(token)
        }
      })
    }

    return ok({ loggedOut: true }, request.id)
  })
}

module.exports = {
  authRoutes
}
