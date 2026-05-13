const { fail, ok } = require('../response')
const { resolveOrgContext } = require('../request-context')
const { writeAudit } = require('../audit-log')

const taskTypes = new Set([
  'customer_import',
  'customer_export',
  'product_import',
  'product_export',
  'category_import'
])

function normalizeText(value) {
  return String(value || '').trim()
}

function toTaskDto(task) {
  return {
    id: task.id,
    type: task.type,
    status: task.status,
    fileName: task.fileName || '',
    fileUrl: task.fileUrl || '',
    totalRows: task.totalRows,
    successRows: task.successRows,
    failedRows: task.failedRows,
    errorText: task.errorText || '',
    createdAt: task.createdAt,
    updatedAt: task.updatedAt
  }
}

function toAuditDto(record) {
  return {
    id: record.id,
    actorId: record.actorId || '',
    action: record.action,
    entity: record.entity,
    entityId: record.entityId || '',
    before: record.before || null,
    after: record.after || null,
    createdAt: record.createdAt
  }
}

async function systemRoutes(app) {
  app.get('/audit-logs', async request => {
    const context = await resolveOrgContext(app.prisma, request)
    const entity = normalizeText(request.query && request.query.entity)
    const where = { orgId: context.orgId }
    if (entity) where.entity = entity
    const list = await app.prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(Number(request.query && request.query.limit) || 100, 200)
    })
    return ok({ list: list.map(toAuditDto), total: list.length }, request.id)
  })

  app.get('/import-export/tasks', async request => {
    const context = await resolveOrgContext(app.prisma, request)
    const type = normalizeText(request.query && request.query.type)
    const where = { orgId: context.orgId }
    if (type && taskTypes.has(type)) where.type = type
    const list = await app.prisma.importExportTask.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(Number(request.query && request.query.limit) || 50, 100)
    })
    return ok({ list: list.map(toTaskDto), total: list.length }, request.id)
  })

  app.post('/import-export/tasks', async (request, reply) => {
    const context = await resolveOrgContext(app.prisma, request)
    const payload = request.body || {}
    const type = normalizeText(payload.type)
    if (!taskTypes.has(type)) {
      reply.code(400)
      return fail('导入导出任务类型不正确', { code: 400, traceId: request.id })
    }
    const fileName = normalizeText(payload.fileName)
    if (fileName.length > 120) {
      reply.code(400)
      return fail('文件名不能超过120字', { code: 400, traceId: request.id })
    }
    const task = await app.prisma.importExportTask.create({
      data: {
        tenantId: context.tenantId,
        orgId: context.orgId,
        type,
        status: type.endsWith('_export') ? 'success' : 'pending',
        fileName,
        fileUrl: type.endsWith('_export') ? `/api/v1/import-export/tasks/download/${Date.now()}.csv` : '',
        totalRows: Number(payload.totalRows || 0),
        successRows: 0,
        failedRows: 0,
        errorText: ''
      }
    })
    await writeAudit(app.prisma, context, {
      action: 'create',
      entity: 'import_export_task',
      entityId: task.id,
      after: { type: task.type, status: task.status, fileName: task.fileName }
    })
    return ok(toTaskDto(task), request.id)
  })

  app.get('/import-export/templates/:type', async (request, reply) => {
    const type = normalizeText(request.params.type)
    const templates = {
      customers: ['客户名称', '联系电话', '客户分类', '详细地址', '期初欠款', '备注'],
      products: ['产品名称', '产品编号', '产品分类', '仓库', '颜色', '单位', '售价', '进价', '期初库存', '库存下限'],
      categories: ['分类名称', '父级分类', '排序']
    }
    const headers = templates[type]
    if (!headers) {
      reply.code(404)
      return fail('模板不存在', { code: 404, traceId: request.id })
    }
    return ok({
      fileName: `${type}-template.csv`,
      headers,
      csv: `${headers.join(',')}\n`
    }, request.id)
  })
}

module.exports = {
  systemRoutes
}
