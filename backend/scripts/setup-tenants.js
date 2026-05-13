const { prisma } = require('../src/prisma')
const { ensureDefaultEmployee, findOrCreateUser } = require('../src/auth-service')

const tenantSeeds = [
  { code: 'tenant-juyun-main', name: '聚云掌柜主租户', orgCode: 'org-main', orgName: '聚云掌柜', phone: '1358270496' },
  { code: 'tenant-sales-demo', name: '销售演示租户', orgCode: 'org-sales-demo', orgName: '销售演示组织', phone: '13800000001' },
  { code: 'tenant-warehouse-demo', name: '仓库演示租户', orgCode: 'org-warehouse-demo', orgName: '仓库演示组织', phone: '13800000002' },
  { code: 'tenant-finance-demo', name: '财务演示租户', orgCode: 'org-finance-demo', orgName: '财务演示组织', phone: '13800000003' }
]

const tenantTriggerTables = [
  ['"AuthSession"', 'orgId'],
  ['"Role"', 'orgId'],
  ['"Employee"', 'orgId'],
  ['"Warehouse"', 'orgId'],
  ['"UserOrgRel"', 'orgId'],
  ['"EmployeeWarehouse"', 'orgId'],
  ['customers', 'org_id'],
  ['customer_categories', 'org_id'],
  ['accounts', 'org_id'],
  ['"ProductCategory"', 'orgId'],
  ['products', 'org_id'],
  ['product_sku', 'org_id'],
  ['"InventoryBalance"', 'orgId'],
  ['"InventoryLedger"', 'orgId'],
  ['sales_orders', 'org_id'],
  ['sales_order_items', 'org_id'],
  ['"FundRecord"', 'orgId'],
  ['receipt_orders', 'org_id'],
  ['receipt_order_items', 'org_id'],
  ['"Supplier"', 'orgId'],
  ['"PurchaseOrder"', 'orgId'],
  ['"PurchaseOrderItem"', 'org_id'],
  ['"ReturnOrder"', 'orgId'],
  ['"ReturnOrderItem"', 'org_id'],
  ['"Message"', 'orgId'],
  ['"ImportExportTask"', 'orgId'],
  ['"AuditLog"', 'orgId']
]

function triggerName(tableName) {
  return `trg_fill_tenant_${tableName.replace(/[^a-zA-Z0-9]/g, '_')}`
}

async function installTenantTriggers() {
  await prisma.$executeRawUnsafe(`
    CREATE OR REPLACE FUNCTION fill_tenant_id_from_org()
    RETURNS trigger AS $$
    DECLARE
      org_value text;
      tenant_value text;
    BEGIN
      EXECUTE format('SELECT ($1).%I::text', TG_ARGV[0]) USING NEW INTO org_value;
      IF NEW.tenant_id IS NULL AND org_value IS NOT NULL AND org_value <> '' THEN
        SELECT tenant_id INTO tenant_value FROM "Organization" WHERE id = org_value;
        NEW.tenant_id = tenant_value;
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `)

  for (const [tableName, orgColumn] of tenantTriggerTables) {
    const name = triggerName(tableName)
    await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS ${name} ON ${tableName};`)
    await prisma.$executeRawUnsafe(`
      CREATE TRIGGER ${name}
      BEFORE INSERT OR UPDATE ON ${tableName}
      FOR EACH ROW
      EXECUTE FUNCTION fill_tenant_id_from_org('${orgColumn}');
    `)
  }
}

async function ensureTenantOrg(seed) {
  const tenant = await prisma.tenant.upsert({
    where: { code: seed.code },
    update: {
      name: seed.name,
      status: 'enabled'
    },
    create: {
      code: seed.code,
      name: seed.name,
      status: 'enabled'
    }
  })

  const org = await prisma.organization.upsert({
    where: { code: seed.orgCode },
    update: {
      tenantId: tenant.id,
      name: seed.orgName
    },
    create: {
      tenantId: tenant.id,
      code: seed.orgCode,
      name: seed.orgName
    }
  })

  return { tenant, org }
}

async function updateByOrg(model, orgField, tenantId, orgId) {
  if (!prisma[model]) return
  await prisma[model].updateMany({
    where: { [orgField]: orgId },
    data: { tenantId }
  })
}

async function backfillOrgScopedData(tenantId, orgId) {
  await updateByOrg('role', 'orgId', tenantId, orgId)
  await updateByOrg('employee', 'orgId', tenantId, orgId)
  await updateByOrg('authSession', 'orgId', tenantId, orgId)
  await updateByOrg('warehouse', 'orgId', tenantId, orgId)
  await updateByOrg('customer', 'org_id', tenantId, orgId)
  await updateByOrg('customerCategory', 'org_id', tenantId, orgId)
  await updateByOrg('account', 'orgId', tenantId, orgId)
  await updateByOrg('productCategory', 'orgId', tenantId, orgId)
  await updateByOrg('inventoryBalance', 'orgId', tenantId, orgId)
  await updateByOrg('inventoryLedger', 'orgId', tenantId, orgId)
  await updateByOrg('salesOrder', 'orgId', tenantId, orgId)
  await updateByOrg('salesOrderItem', 'orgId', tenantId, orgId)
  await updateByOrg('fundRecord', 'orgId', tenantId, orgId)
  await updateByOrg('receiptOrder', 'orgId', tenantId, orgId)
  await updateByOrg('receiptOrderItem', 'orgId', tenantId, orgId)
  await updateByOrg('supplier', 'orgId', tenantId, orgId)
  await updateByOrg('purchaseOrder', 'orgId', tenantId, orgId)
  await updateByOrg('purchaseOrderItem', 'orgId', tenantId, orgId)
  await updateByOrg('returnOrder', 'orgId', tenantId, orgId)
  await updateByOrg('returnOrderItem', 'orgId', tenantId, orgId)
  await updateByOrg('message', 'orgId', tenantId, orgId)
  await updateByOrg('importExportTask', 'orgId', tenantId, orgId)
  await updateByOrg('auditLog', 'orgId', tenantId, orgId)
}

async function backfillMemberships(tenantId, orgId) {
  const employees = await prisma.employee.findMany({
    where: { orgId },
    include: {
      user: true
    }
  })
  const warehouses = await prisma.warehouse.findMany({
    where: { orgId, status: 'enabled' },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }]
  })
  const warehouseIds = warehouses.map(warehouse => warehouse.id)

  for (const employee of employees) {
    await prisma.employee.update({
      where: { id: employee.id },
      data: {
        tenantId,
        warehouseIds
      }
    })
    if (employee.userId) {
      await prisma.user.update({
        where: { id: employee.userId },
        data: {
          tenantId: employee.user && employee.user.tenantId ? employee.user.tenantId : tenantId
        }
      })
      await prisma.userOrgRel.upsert({
        where: {
          userId_orgId: {
            userId: employee.userId,
            orgId
          }
        },
        update: {
          tenantId,
          employeeId: employee.id
        },
        create: {
          tenantId,
          userId: employee.userId,
          orgId,
          employeeId: employee.id,
          isDefault: true
        }
      })
    }

    for (const [index, warehouse] of warehouses.entries()) {
      await prisma.employeeWarehouse.upsert({
        where: {
          employeeId_warehouseId: {
            employeeId: employee.id,
            warehouseId: warehouse.id
          }
        },
        update: {
          tenantId,
          orgId,
          isDefault: index === 0
        },
        create: {
          tenantId,
          orgId,
          employeeId: employee.id,
          warehouseId: warehouse.id,
          isDefault: index === 0
        }
      })
    }
  }
}

async function createMockLoginData() {
  for (const seed of tenantSeeds) {
    const user = await findOrCreateUser(
      prisma,
      { purePhoneNumber: seed.phone, phoneNumber: seed.phone, countryCode: '86' },
      { openid: `mock_seed_${seed.phone}`, unionid: null }
    )
    await ensureDefaultEmployee(prisma, user)
  }
}

async function main() {
  await installTenantTriggers()

  const orgs = []
  for (const seed of tenantSeeds) {
    orgs.push(await ensureTenantOrg(seed))
  }

  await createMockLoginData()

  const allOrgs = await prisma.organization.findMany()
  const defaultTenant = await prisma.tenant.findUnique({ where: { code: 'tenant-juyun-main' } })
  for (const org of allOrgs) {
    const seedPair = orgs.find(pair => pair.org.id === org.id)
    const tenantId = (seedPair && seedPair.tenant.id) || org.tenantId || defaultTenant.id
    if (!org.tenantId) {
      await prisma.organization.update({
        where: { id: org.id },
        data: { tenantId }
      })
    }
    await backfillOrgScopedData(tenantId, org.id)
    await backfillMemberships(tenantId, org.id)
  }

  const summary = await Promise.all(tenantSeeds.map(async seed => {
    const tenant = await prisma.tenant.findUnique({ where: { code: seed.code } })
    const org = await prisma.organization.findUnique({ where: { code: seed.orgCode } })
    const [users, customers, orders, inventory] = await Promise.all([
      prisma.userOrgRel.count({ where: { tenantId: tenant.id } }),
      prisma.customer.count({ where: { tenantId: tenant.id } }),
      prisma.salesOrder.count({ where: { tenantId: tenant.id } }),
      prisma.inventoryBalance.count({ where: { tenantId: tenant.id } })
    ])
    return { tenant: tenant.code, org: org.code, users, customers, orders, inventory }
  }))

  console.log('[setup-tenants] ok', JSON.stringify(summary))
}

main()
  .catch(error => {
    console.error('[setup-tenants] failed')
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
