function safeJson(value) {
  if (value === undefined) return null
  return value
}

async function writeAudit(prisma, context, payload = {}) {
  if (!prisma || !context || !context.orgId || !payload.action || !payload.entity) return null
  return prisma.auditLog.create({
    data: {
      tenantId: context.tenantId || null,
      orgId: context.orgId,
      actorId: context.employeeId || context.userId || null,
      action: payload.action,
      entity: payload.entity,
      entityId: payload.entityId ? String(payload.entityId) : null,
      before: safeJson(payload.before),
      after: safeJson(payload.after)
    }
  }).catch(() => null)
}

module.exports = {
  writeAudit
}
