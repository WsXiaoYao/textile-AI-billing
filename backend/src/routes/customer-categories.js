const { ok, fail } = require('../response')
const { resolveOrgId: resolveRequestOrgId } = require('../request-context')

const defaultOrgCode = 'org-main'

async function resolveOrgId(prisma, request) {
  return resolveRequestOrgId(prisma, request)
}

function normalizeName(value) {
  return String(value || '').trim()
}

function normalizeSort(value) {
  const number = Number(value || 0)
  if (!Number.isFinite(number)) return 0
  return Math.min(Math.max(Math.floor(number), 0), 9999)
}

function toDto(category, countMap = {}) {
  const customerCount = Number(countMap[category.id] || 0)
  return {
    id: category.id,
    key: category.id,
    name: category.name,
    label: category.name,
    sortOrder: category.sort_order,
    sort_order: category.sort_order,
    isActive: category.is_active,
    is_active: category.is_active,
    isDefault: category.is_default,
    is_default: category.is_default,
    customerCount,
    count: customerCount,
    created_at: category.created_at,
    updated_at: category.updated_at
  }
}

async function getCustomerCountMap(prisma, orgId) {
  const rows = await prisma.customer.groupBy({
    by: ['customer_category_id'],
    where: {
      org_id: orgId,
      is_active: true,
      customer_category_id: { not: null }
    },
    _count: { _all: true }
  })
  return rows.reduce((map, row) => {
    if (row.customer_category_id) map[row.customer_category_id] = row._count._all
    return map
  }, {})
}

async function customerCategoryRoutes(app) {
  app.get('/customer-categories', async request => {
    const orgId = await resolveOrgId(app.prisma, request)
    const query = request.query || {}
    const includeInactive = query.includeInactive === 'true' || query.includeInactive === true
    const where = {
      org_id: orgId,
      ...(includeInactive ? {} : { is_active: true })
    }
    const keyword = normalizeName(query.keyword)
    if (keyword) {
      where.name = { contains: keyword, mode: 'insensitive' }
    }

    const [categories, countMap, totalCustomers] = await Promise.all([
      app.prisma.customerCategory.findMany({
        where,
        orderBy: [{ sort_order: 'asc' }, { created_at: 'asc' }]
      }),
      getCustomerCountMap(app.prisma, orgId),
      app.prisma.customer.count({
        where: {
          org_id: orgId,
          is_active: true
        }
      })
    ])
    const list = categories.map(category => toDto(category, countMap))

    return ok({
      summary: {
        categoryCount: list.length,
        activeCount: list.filter(item => item.isActive).length,
        customerCount: totalCustomers
      },
      list
    }, request.id)
  })

  app.post('/customer-categories', async (request, reply) => {
    const orgId = await resolveOrgId(app.prisma, request)
    const payload = request.body || {}
    const name = normalizeName(payload.name || payload.label)
    if (!name) {
      reply.code(400)
      return fail('请输入分类名称', { code: 400, traceId: request.id })
    }
    if (name.length > 50) {
      reply.code(400)
      return fail('分类名称不能超过50字', { code: 400, traceId: request.id })
    }

    try {
      const category = await app.prisma.customerCategory.create({
        data: {
          org_id: orgId,
          name,
          sort_order: normalizeSort(payload.sort_order || payload.sortOrder),
          is_active: payload.is_active === undefined ? true : Boolean(payload.is_active),
          is_default: Boolean(payload.is_default || payload.isDefault)
        }
      })
      return ok(toDto(category), request.id)
    } catch (error) {
      if (error.code === 'P2002') {
        reply.code(409)
        return fail('分类名称已存在', { code: 409, traceId: request.id })
      }
      throw error
    }
  })

  app.put('/customer-categories/:id', async (request, reply) => {
    const orgId = await resolveOrgId(app.prisma, request)
    const existing = await app.prisma.customerCategory.findFirst({
      where: {
        id: request.params.id,
        org_id: orgId
      }
    })
    if (!existing) {
      reply.code(404)
      return fail('客户分类不存在', { code: 404, traceId: request.id })
    }

    const payload = request.body || {}
    const name = normalizeName(payload.name || payload.label || existing.name)
    if (!name) {
      reply.code(400)
      return fail('请输入分类名称', { code: 400, traceId: request.id })
    }
    if (name.length > 50) {
      reply.code(400)
      return fail('分类名称不能超过50字', { code: 400, traceId: request.id })
    }

    try {
      const [category] = await app.prisma.$transaction([
        app.prisma.customerCategory.update({
          where: { id: existing.id },
          data: {
            name,
            sort_order: normalizeSort(payload.sort_order !== undefined ? payload.sort_order : payload.sortOrder !== undefined ? payload.sortOrder : existing.sort_order),
            is_active: payload.is_active === undefined && payload.isActive === undefined ? existing.is_active : Boolean(payload.is_active !== undefined ? payload.is_active : payload.isActive),
            is_default: payload.is_default === undefined && payload.isDefault === undefined ? existing.is_default : Boolean(payload.is_default !== undefined ? payload.is_default : payload.isDefault)
          }
        }),
        app.prisma.customer.updateMany({
          where: {
            org_id: orgId,
            customer_category_id: existing.id
          },
          data: {
            customer_category: name
          }
        })
      ])
      return ok(toDto(category, await getCustomerCountMap(app.prisma, orgId)), request.id)
    } catch (error) {
      if (error.code === 'P2002') {
        reply.code(409)
        return fail('分类名称已存在', { code: 409, traceId: request.id })
      }
      throw error
    }
  })
}

module.exports = {
  customerCategoryRoutes
}
