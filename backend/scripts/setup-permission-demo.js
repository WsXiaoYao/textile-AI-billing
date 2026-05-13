const { prisma } = require('../src/prisma')
const { ROLE_DEFS, getPermissionsForRole, normalizeRoleName } = require('../src/permissions')

const tenantCode = 'tenant-juyun-main'
const orgCode = 'org-main'

const demoAccounts = [
  { name: '老板账号', phone: '1358270496', role: '老板', remark: '老板，可看全组织数据。' },
  { name: '业务员小张', phone: '13333333331', role: '业务员', remark: '业务员，客户、销售、收款、退货测试。' },
  { name: '采购小李', phone: '13333333332', role: '采购', remark: '采购，供应商、采购、库存补货测试。' },
  { name: '财务小陈', phone: '13333333333', role: '财务', remark: '财务，收款、资金往来、销售查询测试。' },
  { name: '仓管小赵', phone: '13333333334', role: '仓管', remark: '仓管，仓库、库存、预警、打印测试。' },
  { name: '采购仓管组合', phone: '13333333335', roles: ['采购', '仓管'], remark: '组合角色，采购与仓管权限并集测试。' }
]

async function ensureTenantAndOrg() {
  const tenant = await prisma.tenant.upsert({
    where: { code: tenantCode },
    update: { name: '聚云掌柜主租户', status: 'enabled' },
    create: { code: tenantCode, name: '聚云掌柜主租户', status: 'enabled' }
  })

  const org = await prisma.organization.upsert({
    where: { code: orgCode },
    update: { tenantId: tenant.id, name: '聚云掌柜' },
    create: { tenantId: tenant.id, code: orgCode, name: '聚云掌柜' }
  })

  return { tenant, org }
}

async function ensureRoles(tenant, org) {
  const roles = {}
  for (const role of ROLE_DEFS) {
    roles[role.name] = await prisma.role.upsert({
      where: {
        orgId_name: {
          orgId: org.id,
          name: role.name
        }
      },
      update: {
        tenantId: tenant.id,
        description: role.description,
        permissions: getPermissionsForRole(role.name)
      },
      create: {
        tenantId: tenant.id,
        orgId: org.id,
        name: role.name,
        description: role.description,
        permissions: getPermissionsForRole(role.name)
      }
    })
  }

  for (const oldName of ['销售', '采购员']) {
    const targetName = normalizeRoleName(oldName)
    const oldRole = await prisma.role.findFirst({ where: { orgId: org.id, name: oldName } })
    const targetRole = roles[targetName]
    if (oldRole && targetRole) {
      await prisma.employee.updateMany({
        where: { orgId: org.id, roleId: oldRole.id },
        data: { roleId: targetRole.id }
      })
      await prisma.role.deleteMany({
        where: {
          id: oldRole.id,
          employees: { none: {} }
        }
      })
    }
  }

  return roles
}

async function ensureWarehouses(tenant, org) {
  let warehouses = await prisma.warehouse.findMany({
    where: { orgId: org.id, status: 'enabled' },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }]
  })

  if (!warehouses.length) {
    await prisma.warehouse.create({
      data: {
        tenantId: tenant.id,
        orgId: org.id,
        name: '默认仓',
        manager: '',
        address: '',
        isDefault: true,
        status: 'enabled'
      }
    })
    warehouses = await prisma.warehouse.findMany({
      where: { orgId: org.id, status: 'enabled' },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }]
    })
  }

  return warehouses
}

async function bindWarehouses(tenant, org, employee, warehouses) {
  const ids = warehouses.map(warehouse => warehouse.id)
  await prisma.employee.update({
    where: { id: employee.id },
    data: { warehouseIds: ids }
  })
  await prisma.employeeWarehouse.deleteMany({
    where: {
      employeeId: employee.id,
      warehouseId: { notIn: ids }
    }
  })
  for (const [index, warehouse] of warehouses.entries()) {
    await prisma.employeeWarehouse.upsert({
      where: {
        employeeId_warehouseId: {
          employeeId: employee.id,
          warehouseId: warehouse.id
        }
      },
      update: {
        tenantId: tenant.id,
        orgId: org.id,
        isDefault: index === 0
      },
      create: {
        tenantId: tenant.id,
        orgId: org.id,
        employeeId: employee.id,
        warehouseId: warehouse.id,
        isDefault: index === 0
      }
    })
  }
}

async function ensureEmployee(tenant, org, roles, account, warehouses) {
  const roleNames = Array.isArray(account.roles) && account.roles.length ? account.roles : [account.role]
  const roleList = roleNames.map(name => roles[name]).filter(Boolean)
  const role = roleList[0]
  const user = await prisma.user.upsert({
    where: { phone: account.phone },
    update: {
      tenantId: tenant.id,
      name: account.name,
      phoneVerifiedAt: new Date()
    },
    create: {
      tenantId: tenant.id,
      name: account.name,
      phone: account.phone,
      phoneCountryCode: '86',
      phoneVerifiedAt: new Date()
    }
  })

  let employee = await prisma.employee.findFirst({
    where: { orgId: org.id, phone: account.phone }
  })

  if (employee) {
    employee = await prisma.employee.update({
      where: { id: employee.id },
      data: {
        tenantId: tenant.id,
        userId: user.id,
        roleId: role.id,
        name: account.name,
        status: 'enabled',
        remark: account.remark
      }
    })
  } else {
    employee = await prisma.employee.create({
      data: {
        tenantId: tenant.id,
        orgId: org.id,
        userId: user.id,
        roleId: role.id,
        name: account.name,
        phone: account.phone,
        status: 'enabled',
        remark: account.remark
      }
    })
  }

  await prisma.userOrgRel.upsert({
    where: {
      userId_orgId: {
        userId: user.id,
        orgId: org.id
      }
    },
    update: {
      tenantId: tenant.id,
      employeeId: employee.id,
      isDefault: account.role === '老板'
    },
    create: {
      tenantId: tenant.id,
      userId: user.id,
      orgId: org.id,
      employeeId: employee.id,
      isDefault: account.role === '老板'
    }
  })

  await prisma.employeeRole.deleteMany({
    where: {
      employeeId: employee.id,
      roleId: {
        notIn: roleList.map(item => item.id)
      }
    }
  })
  for (const [index, item] of roleList.entries()) {
    await prisma.employeeRole.upsert({
      where: {
        employeeId_roleId: {
          employeeId: employee.id,
          roleId: item.id
        }
      },
      update: {
        tenantId: tenant.id,
        orgId: org.id,
        isPrimary: index === 0
      },
      create: {
        tenantId: tenant.id,
        orgId: org.id,
        employeeId: employee.id,
        roleId: item.id,
        isPrimary: index === 0
      }
    })
  }
  await bindWarehouses(tenant, org, employee, warehouses)
  return employee
}

async function main() {
  const { tenant, org } = await ensureTenantAndOrg()
  const roles = await ensureRoles(tenant, org)
  const warehouses = await ensureWarehouses(tenant, org)

  const employees = []
  for (const account of demoAccounts) {
    employees.push(await ensureEmployee(tenant, org, roles, account, warehouses))
  }

  console.log('[setup-permission-demo] ok')
  console.table(employees.map((employee, index) => ({
    name: demoAccounts[index].name,
    phone: demoAccounts[index].phone,
    role: demoAccounts[index].role || demoAccounts[index].roles.join('、'),
    employeeId: employee.id
  })))
}

main()
  .catch(error => {
    console.error('[setup-permission-demo] failed')
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
