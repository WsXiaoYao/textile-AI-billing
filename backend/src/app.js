const fastify = require('fastify')
const cors = require('@fastify/cors')
const { env } = require('./env')
const { prisma } = require('./prisma')
const { canAccessWarehouse, hasPermission, isWarehouseScoped } = require('./permissions')
const { resolveOrgContext } = require('./request-context')
const { fail } = require('./response')
const { accountRoutes } = require('./routes/accounts')
const { aiRoutes } = require('./routes/ai')
const { authRoutes } = require('./routes/auth')
const { customerCategoryRoutes } = require('./routes/customer-categories')
const { customerRoutes } = require('./routes/customers')
const { employeeRoutes } = require('./routes/employees')
const { healthRoutes } = require('./routes/health')
const { inventoryRoutes } = require('./routes/inventory')
const { messageRoutes } = require('./routes/messages')
const { organizationRoutes } = require('./routes/organizations')
const { purchaseRoutes, suppliersRoutes } = require('./routes/purchases')
const { returnRoutes } = require('./routes/returns')
const { salesOrderRoutes } = require('./routes/sales-orders')
const { systemRoutes } = require('./routes/system')

const publicPrefixes = [
  '/health',
  '/api/v1/auth',
  '/api/v1/uploads/receipt-codes'
]

function pickRequiredPermission(method, rawUrl) {
  const pathname = String(rawUrl || '').split('?')[0]
  if (publicPrefixes.some(prefix => pathname === prefix || pathname.startsWith(`${prefix}/`))) return ''
  if (!pathname.startsWith('/api/v1/')) return ''

  const write = !['GET', 'HEAD', 'OPTIONS'].includes(String(method || '').toUpperCase())

  if (pathname.startsWith('/api/v1/customers') || pathname.startsWith('/api/v1/customer-categories')) {
    if (pathname.includes('/receipts')) return write ? 'receipts:write' : 'receipts:read'
    if (pathname.includes('/fund-records')) return 'receipts:read'
    return write ? 'customers:write' : 'customers:read'
  }
  if (pathname.startsWith('/api/v1/fund-records')) return 'receipts:read'
  if (pathname.startsWith('/api/v1/sales-orders')) {
    if (pathname.includes('/receipts')) return write ? 'receipts:write' : 'receipts:read'
    if (pathname.includes('/receipt-context')) return 'receipts:read'
    if (pathname.includes('/print')) return 'print:write'
    return write ? 'sales:write' : 'sales:read'
  }
  if (pathname.startsWith('/api/v1/ai')) return 'sales:write'
  if (pathname.startsWith('/api/v1/return-options') || pathname.startsWith('/api/v1/return-orders')) {
    return write ? 'returns:write' : 'returns:read'
  }
  if (pathname.startsWith('/api/v1/suppliers')) return write ? 'suppliers:write' : 'suppliers:read'
  if (pathname.startsWith('/api/v1/purchase-options') || pathname.startsWith('/api/v1/purchase-orders')) {
    return write ? 'purchase:write' : 'purchase:read'
  }
  if (pathname.startsWith('/api/v1/inventory-options') || pathname.startsWith('/api/v1/inventory')) {
    return write ? 'inventory:write' : 'inventory:read'
  }
  if (pathname.startsWith('/api/v1/warehouses')) return write ? 'warehouses:write' : 'warehouses:read'
  if (pathname.startsWith('/api/v1/accounts')) return write ? 'accounts:write' : 'accounts:read'
  if (pathname.startsWith('/api/v1/messages')) return 'messages:read'
  if (pathname.startsWith('/api/v1/profile')) return 'auth:required'
  if (pathname.startsWith('/api/v1/audit-logs')) return 'settings:read'
  if (pathname.startsWith('/api/v1/import-export')) return write ? 'settings:write' : 'settings:read'
  if (pathname.startsWith('/api/v1/employees')) return write ? 'settings:write' : 'settings:read'
  if (pathname.startsWith('/api/v1/organizations')) return write ? 'settings:write' : 'settings:read'
  if (pathname.startsWith('/api/v1/products') || pathname.startsWith('/api/v1/product-categories')) {
    return write ? 'products:write' : 'products:read'
  }
  return 'settings:read'
}

function pickWarehouseArea(rawUrl) {
  const pathname = String(rawUrl || '').split('?')[0]
  if (pathname.startsWith('/api/v1/purchase-options') || pathname.startsWith('/api/v1/purchase-orders') || pathname.startsWith('/api/v1/suppliers')) return 'purchase'
  if (pathname.startsWith('/api/v1/inventory-options') || pathname.startsWith('/api/v1/inventory')) return 'inventory'
  if (pathname.startsWith('/api/v1/warehouses')) return 'warehouses'
  if (pathname.startsWith('/api/v1/return-options') || pathname.startsWith('/api/v1/return-orders')) return 'returns'
  if (pathname.startsWith('/api/v1/sales-orders')) return 'sales'
  return 'default'
}

function buildApp(options = {}) {
  const app = fastify({
    logger: options.logger === false ? false : {
      level: env.LOG_LEVEL
    },
    requestIdHeader: 'x-request-id'
  })

  app.decorate('prisma', prisma)

  app.register(cors, {
    origin: true,
    credentials: true
  })

  app.addHook('preHandler', async (request, reply) => {
    const required = pickRequiredPermission(request.method, request.url)
    if (!required) return
    try {
      const context = await resolveOrgContext(app.prisma, request, { allowHeaderFallback: false })
      request.orgContext = context
      if (required === 'auth:required') return
      if (!hasPermission(context, required)) {
        reply.code(403)
        return reply.send(fail('当前账号没有该操作权限', {
          code: 403,
          traceId: request.id,
          data: { required }
        }))
      }
      const queryWarehouseId = request.query && request.query.warehouseId
      const bodyWarehouseId = request.body && request.body.warehouseId
      const warehouseId = bodyWarehouseId || queryWarehouseId
      const warehouseArea = pickWarehouseArea(request.url)
      if (warehouseId && isWarehouseScoped(context, warehouseArea) && !canAccessWarehouse(context, warehouseId)) {
        reply.code(403)
        return reply.send(fail('当前账号没有该仓库数据权限', {
          code: 403,
          traceId: request.id
        }))
      }
    } catch (error) {
      const statusCode = error.statusCode || 500
      reply.code(statusCode)
      return reply.send(fail(error.message || '权限校验失败', {
        code: statusCode,
        traceId: request.id
      }))
    }
  })

  app.register(healthRoutes)
  app.register(aiRoutes, { prefix: '/api/v1' })
  app.register(authRoutes, { prefix: '/api/v1' })
  app.register(accountRoutes, { prefix: '/api/v1' })
  app.register(customerCategoryRoutes, { prefix: '/api/v1' })
  app.register(customerRoutes, { prefix: '/api/v1' })
  app.register(employeeRoutes, { prefix: '/api/v1' })
  app.register(inventoryRoutes, { prefix: '/api/v1' })
  app.register(messageRoutes, { prefix: '/api/v1' })
  app.register(organizationRoutes, { prefix: '/api/v1' })
  app.register(suppliersRoutes, { prefix: '/api/v1' })
  app.register(purchaseRoutes, { prefix: '/api/v1' })
  app.register(returnRoutes, { prefix: '/api/v1' })
  app.register(salesOrderRoutes, { prefix: '/api/v1' })
  app.register(systemRoutes, { prefix: '/api/v1' })

  app.addHook('onClose', async instance => {
    await instance.prisma.$disconnect()
  })

  return app
}

module.exports = {
  buildApp
}
