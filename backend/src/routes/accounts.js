const { ok, fail } = require('../response')
const { resolveOrgId: resolveRequestOrgId } = require('../request-context')

const defaultOrgCode = 'org-main'

async function resolveOrgId(prisma, request) {
  return resolveRequestOrgId(prisma, request)
}

function normalizeText(value) {
  return String(value || '').trim()
}

function normalizeAmount(value, fallback = 0) {
  if (value === undefined || value === null || value === '') return fallback
  const amount = Number(value)
  return Number.isFinite(amount) ? amount : fallback
}

function toDto(account) {
  const initBalance = Number(account.initBalance || 0)
  const currentBalance = Number(account.currentBalance || 0)
  return {
    id: account.id,
    accountName: account.accountName,
    account_name: account.accountName,
    initBalance,
    init_balance: initBalance,
    currentBalance,
    current_balance: currentBalance,
    remark: account.remark || '',
    status: account.status,
    isActive: account.status === 'enabled',
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
    created_at: account.createdAt,
    updated_at: account.updatedAt
  }
}

async function accountRoutes(app) {
  app.get('/accounts', async request => {
    const orgId = await resolveOrgId(app.prisma, request)
    const query = request.query || {}
    const includeDisabled = query.includeDisabled === 'true' || query.includeDisabled === true
    const keyword = normalizeText(query.keyword)
    const where = {
      orgId,
      ...(includeDisabled ? {} : { status: 'enabled' })
    }
    if (keyword) {
      where.accountName = { contains: keyword, mode: 'insensitive' }
    }

    const accounts = await app.prisma.account.findMany({
      where,
      orderBy: [{ status: 'asc' }, { createdAt: 'asc' }]
    })

    return ok({
      summary: {
        accountCount: accounts.length,
        activeCount: accounts.filter(account => account.status === 'enabled').length,
        currentBalance: accounts.reduce((sum, account) => sum + Number(account.currentBalance || 0), 0)
      },
      list: accounts.map(toDto)
    }, request.id)
  })

  app.post('/accounts', async (request, reply) => {
    const orgId = await resolveOrgId(app.prisma, request)
    const payload = request.body || {}
    const accountName = normalizeText(payload.accountName || payload.account_name)
    if (!accountName) {
      reply.code(400)
      return fail('请输入账户名称', { code: 400, traceId: request.id })
    }
    if (accountName.length > 50) {
      reply.code(400)
      return fail('账户名称不能超过50字', { code: 400, traceId: request.id })
    }
    const remark = normalizeText(payload.remark)
    if (remark.length > 120) {
      reply.code(400)
      return fail('备注不能超过120字', { code: 400, traceId: request.id })
    }

    const initBalance = normalizeAmount(payload.initBalance !== undefined ? payload.initBalance : payload.init_balance)
    try {
      const account = await app.prisma.account.create({
        data: {
          orgId,
          accountName,
          initBalance: initBalance.toFixed(2),
          currentBalance: initBalance.toFixed(2),
          remark,
          status: payload.status === 'disabled' ? 'disabled' : 'enabled'
        }
      })
      return ok(toDto(account), request.id)
    } catch (error) {
      if (error.code === 'P2002') {
        reply.code(409)
        return fail('账户名称已存在', { code: 409, traceId: request.id })
      }
      throw error
    }
  })

  app.put('/accounts/:id', async (request, reply) => {
    const orgId = await resolveOrgId(app.prisma, request)
    const existing = await app.prisma.account.findFirst({
      where: {
        id: request.params.id,
        orgId
      }
    })
    if (!existing) {
      reply.code(404)
      return fail('账户不存在', { code: 404, traceId: request.id })
    }

    const payload = request.body || {}
    const accountName = normalizeText(payload.accountName || payload.account_name || existing.accountName)
    if (!accountName) {
      reply.code(400)
      return fail('请输入账户名称', { code: 400, traceId: request.id })
    }
    if (accountName.length > 50) {
      reply.code(400)
      return fail('账户名称不能超过50字', { code: 400, traceId: request.id })
    }
    const remark = payload.remark === undefined ? existing.remark : normalizeText(payload.remark)
    if (normalizeText(remark).length > 120) {
      reply.code(400)
      return fail('备注不能超过120字', { code: 400, traceId: request.id })
    }

    const status = payload.status || (payload.isActive === false || payload.is_active === false ? 'disabled' : existing.status)
    try {
      const account = await app.prisma.account.update({
        where: { id: existing.id },
        data: {
          accountName,
          remark,
          status: status === 'disabled' ? 'disabled' : 'enabled'
        }
      })
      return ok(toDto(account), request.id)
    } catch (error) {
      if (error.code === 'P2002') {
        reply.code(409)
        return fail('账户名称已存在', { code: 409, traceId: request.id })
      }
      throw error
    }
  })
}

module.exports = {
  accountRoutes
}
