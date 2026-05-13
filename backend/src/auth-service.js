const crypto = require('crypto')
const { env } = require('./env')
const {
  getPermissionsForRole,
  mergeRoleContext,
  normalizeRoleName
} = require('./permissions')

let accessTokenCache = null

const DEFAULT_PERMISSIONS = getPermissionsForRole('老板')

const MOCK_ACCOUNTS = [
  {
    phone: '1358270496',
    name: '老板账号',
    role: '老板',
    tenantCode: 'tenant-juyun-main',
    tenantName: '聚云掌柜主租户',
    orgCode: 'org-main',
    orgName: '聚云掌柜',
    remark: '主组织，保留当前完整数据。'
  },
  {
    phone: '13800000001',
    name: '销售小王',
    role: '业务员',
    tenantCode: 'tenant-sales-demo',
    tenantName: '销售演示租户',
    orgCode: 'org-sales-demo',
    orgName: '销售演示组织',
    remark: '偏客户和销售单数据。'
  },
  {
    phone: '13800000002',
    name: '仓管小李',
    role: '仓管',
    tenantCode: 'tenant-warehouse-demo',
    tenantName: '仓库演示租户',
    orgCode: 'org-warehouse-demo',
    orgName: '仓库演示组织',
    remark: '偏库存和采购数据。'
  },
  {
    phone: '13800000003',
    name: '财务小陈',
    role: '财务',
    tenantCode: 'tenant-finance-demo',
    tenantName: '财务演示租户',
    orgCode: 'org-finance-demo',
    orgName: '财务演示组织',
    remark: '偏收款和欠款数据。'
  }
]

const MOCK_ORG_DATA = {
  'org-sales-demo': {
    categories: ['批发客户', '零剪客户'],
    customers: [
      { name: '贵阳云朵布艺', phone: '15100000001', category: '批发客户', address: '贵阳市观山湖区西南商贸城', contract: '2860.00', paid: '1200.00' },
      { name: '遵义红棉窗帘', phone: '15100000002', category: '零剪客户', address: '遵义市汇川区广州路', contract: '680.00', paid: '680.00' },
      { name: '安顺织梦软装', phone: '15100000003', category: '批发客户', address: '安顺市西秀区家居市场', contract: '1430.00', paid: '0.00' }
    ],
    stockBase: 36,
    orders: [
      { no: 'XSDEMO-S001', customer: '贵阳云朵布艺', status: 'partial', amount: '2860.00', received: '1200.00', qty: '12' },
      { no: 'XSDEMO-S002', customer: '遵义红棉窗帘', status: 'paid', amount: '680.00', received: '680.00', qty: '4' }
    ]
  },
  'org-warehouse-demo': {
    categories: ['工程客户', '门店客户'],
    customers: [
      { name: '仓库调拨客户', phone: '15200000001', category: '工程客户', address: '贵阳市白云区物流园', contract: '320.00', paid: '0.00' },
      { name: '花溪门店样布', phone: '15200000002', category: '门店客户', address: '贵阳市花溪区清溪路', contract: '0.00', paid: '0.00' }
    ],
    stockBase: 8,
    orders: [
      { no: 'XSDEMO-W001', customer: '仓库调拨客户', status: 'unpaid', amount: '320.00', received: '0.00', qty: '2' }
    ],
    supplier: { name: '织里快供面料', phone: '15300000001', amount: 168800 }
  },
  'org-finance-demo': {
    categories: ['重点欠款', '预收客户'],
    customers: [
      { name: '毕节晨光布行', phone: '15300000002', category: '重点欠款', address: '毕节市七星关区招商花园', contract: '5160.00', paid: '1600.00' },
      { name: '凯里蓝调软装', phone: '15300000003', category: '预收客户', address: '黔东南州凯里市迎宾大道', contract: '980.00', paid: '1400.00' },
      { name: '铜仁山水家纺', phone: '15300000004', category: '重点欠款', address: '铜仁市碧江区灯塔街道', contract: '2320.00', paid: '0.00' }
    ],
    stockBase: 18,
    orders: [
      { no: 'XSDEMO-F001', customer: '毕节晨光布行', status: 'partial', amount: '5160.00', received: '1600.00', qty: '18' },
      { no: 'XSDEMO-F002', customer: '凯里蓝调软装', status: 'overpaid', amount: '980.00', received: '1400.00', qty: '5' }
    ]
  }
}

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

function getMockAccountByPhone(phone) {
  const normalized = normalizePhone(phone)
  return MOCK_ACCOUNTS.find(account => account.phone === normalized) || null
}

function appendMockAccount(tenantMap, account) {
  const tenantCode = account.tenantCode || 'tenant-juyun-main'
  if (!tenantMap.has(tenantCode)) {
    tenantMap.set(tenantCode, {
      code: tenantCode,
      name: account.tenantName || '聚云掌柜主租户',
      orgCode: account.orgCode || 'org-main',
      orgName: account.orgName || '聚云掌柜',
      accounts: []
    })
  }

  const tenant = tenantMap.get(tenantCode)
  if (tenant.accounts.some(item => item.phone === account.phone)) return
  tenant.accounts.push({
    label: account.name,
    phone: account.phone,
    role: normalizeRoleName(account.role),
    org: account.orgName,
    orgCode: account.orgCode,
    tenantCode,
    tenantName: account.tenantName,
    desc: account.remark || ''
  })
}

async function getMockLoginOptions(prisma) {
  const tenantMap = new Map()
  let hasDatabaseAccounts = false

  if (prisma) {
    const employees = await prisma.employee.findMany({
      where: {
        status: 'enabled',
        phone: {
          not: null
        }
      },
      include: {
        role: true,
        employeeRoles: {
          include: { role: true },
          orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }]
        },
        organization: {
          include: {
            tenant: true
          }
        },
        employeeWarehouses: {
          include: {
            warehouse: true
          }
        }
      },
      orderBy: [{ orgId: 'asc' }, { createdAt: 'asc' }]
    })

    employees.forEach(employee => {
      if (!employee.organization) return
      hasDatabaseAccounts = true
      const tenant = employee.organization.tenant
      const tenantCode = tenant ? tenant.code : (employee.organization.code || employee.organization.id)
      appendMockAccount(tenantMap, {
        phone: normalizePhone(employee.phone),
        name: employee.name,
        role: buildEmployeeRoleContext(employee).roleText || '未分配',
        tenantCode,
        tenantName: tenant ? tenant.name : `${employee.organization.name}租户`,
        orgCode: employee.organization.code || employee.organization.id,
        orgName: employee.organization.name,
        remark: `绑定仓库 ${Array.isArray(employee.warehouseIds) ? employee.warehouseIds.length : 0}`
      })
    })
  }

  if (!hasDatabaseAccounts) {
    MOCK_ACCOUNTS.forEach(account => {
      appendMockAccount(tenantMap, account)
    })
  }

  return Array.from(tenantMap.values())
}

function amountToCents(value) {
  return Math.round(Number(value || 0) * 100)
}

function centsToAmount(cents) {
  return (Number(cents || 0) / 100).toFixed(2)
}

async function ensureTenant(prisma, account) {
  const code = account && account.tenantCode ? account.tenantCode : 'tenant-juyun-main'
  const name = account && account.tenantName ? account.tenantName : '聚云掌柜主租户'
  return prisma.tenant.upsert({
    where: { code },
    update: {
      name,
      status: 'enabled'
    },
    create: {
      code,
      name,
      status: 'enabled'
    }
  })
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
    const mockPhone = normalizePhone(payload.mockPhone || payload.phone)
    if (!mockPhone) {
      throw new Error('当前后端为模拟登录模式，请使用 mockPhone；真实微信手机号授权需要关闭 WECHAT_MOCK_LOGIN 并配置微信密钥')
    }
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

  const mockAccount = env.WECHAT_MOCK_LOGIN ? getMockAccountByPhone(phone) : null
  const name = mockAccount ? mockAccount.name : `用户${phone.slice(-4)}`
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
        name,
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

async function ensureMockOrganizationData(prisma, account, organization) {
  const data = MOCK_ORG_DATA[account.orgCode]
  if (!data) return
  const tenantId = organization.tenantId || null

  const categories = []
  for (const [index, name] of data.categories.entries()) {
    const category = await prisma.customerCategory.upsert({
      where: {
        org_id_name: {
          org_id: organization.id,
          name
        }
      },
      update: {
        is_active: true,
        sort_order: index + 1
      },
      create: {
        tenantId,
        org_id: organization.id,
        name,
        sort_order: index + 1,
        is_active: true,
        is_default: index === 0
      }
    })
    categories.push(category)
  }

  await prisma.account.upsert({
    where: {
      orgId_accountName: {
        orgId: organization.id,
        accountName: '默认账户'
      }
    },
    update: {
      status: 'enabled'
    },
    create: {
      tenantId,
      orgId: organization.id,
      accountName: '默认账户',
      initBalance: '0.00',
      currentBalance: '0.00',
      status: 'enabled'
    }
  })

  const warehouse = await prisma.warehouse.upsert({
    where: {
      orgId_name: {
        orgId: organization.id,
        name: '默认仓'
      }
    },
    update: {
      status: 'enabled',
      isDefault: true
    },
    create: {
      tenantId,
      orgId: organization.id,
      name: '默认仓',
      manager: account.name,
      address: `${organization.name} 默认仓`,
      isDefault: true,
      status: 'enabled'
    }
  })

  const customers = []
  for (const [index, item] of data.customers.entries()) {
    const category = categories.find(entry => entry.name === item.category) || categories[0]
    const contractCents = amountToCents(item.contract)
    const paidCents = amountToCents(item.paid)
    const unpaidCents = Math.max(contractCents - paidCents, 0)
    const existing = await prisma.customer.findFirst({
      where: {
        org_id: organization.id,
        customer_name: item.name,
        source_file: 'mock-login'
      },
      select: { id: true }
    })
    const payload = {
      tenantId,
      org_id: organization.id,
      customer_category_id: category && category.id,
      customer_name: item.name,
      customer_category: item.category,
      phone: item.phone,
      address_short: item.address,
      detail_address: item.address,
      province: item.address.slice(0, 3),
      opening_debt: centsToAmount(unpaidCents),
      contract_amount: centsToAmount(contractCents),
      delivered_amount: centsToAmount(contractCents),
      prepaid_amount: paidCents > contractCents ? centsToAmount(paidCents - contractCents) : '0.00',
      unpaid_amount: centsToAmount(unpaidCents),
      paid_amount: centsToAmount(paidCents),
      is_active: true,
      source_file: 'mock-login',
      source_sheet: account.orgCode,
      source_row_no: index + 1,
      customer_name_normalized: item.name.toLowerCase(),
      customer_name_pinyin: '',
      customer_name_initials: ''
    }
    customers.push(existing
      ? await prisma.customer.update({ where: { id: existing.id }, data: payload })
      : await prisma.customer.create({ data: payload }))
  }

  const variants = await prisma.productVariant.findMany({
    take: 3,
    include: { product: true },
    orderBy: { id: 'asc' }
  })

  for (const [index, variant] of variants.entries()) {
    await prisma.inventoryBalance.upsert({
      where: {
        orgId_warehouseId_variantId: {
          orgId: organization.id,
          warehouseId: warehouse.id,
          variantId: variant.id
        }
      },
      update: {
        stockQty: String(Math.max(data.stockBase - index * 4, 0))
      },
      create: {
        tenantId,
        orgId: organization.id,
        warehouseId: warehouse.id,
        variantId: variant.id,
        stockQty: String(Math.max(data.stockBase - index * 4, 0)),
        reservedQty: '0'
      }
    })
  }

  if (variants.length) {
    for (const [index, orderSeed] of data.orders.entries()) {
      const customer = customers.find(entry => entry.customer_name === orderSeed.customer) || customers[0]
      if (!customer) continue
      const existingOrder = await prisma.salesOrder.findFirst({
        where: {
          orgId: organization.id,
          orderNo: orderSeed.no
        },
        select: { id: true }
      })
      if (existingOrder) continue

      const variant = variants[index % variants.length]
      const amountCents = amountToCents(orderSeed.amount)
      const receivedCents = amountToCents(orderSeed.received)
      const qty = Number(orderSeed.qty || 1)
      const unitPrice = qty ? centsToAmount(Math.round(amountCents / qty)) : centsToAmount(amountCents)
      await prisma.salesOrder.create({
        data: {
          orgId: organization.id,
          tenantId,
          orderNo: orderSeed.no,
          customerId: customer.id,
          warehouseId: warehouse.id,
          warehouseName: warehouse.name,
          orderDate: new Date(`2026-05-${String(8 + index).padStart(2, '0')}T00:00:00.000Z`),
          orderAmount: centsToAmount(amountCents),
          contractAmount: centsToAmount(amountCents),
          receivedAmount: centsToAmount(receivedCents),
          unreceivedAmount: centsToAmount(Math.max(amountCents - receivedCents, 0)),
          payStatus: orderSeed.status,
          shippingStatus: index % 2 ? 'partial' : 'delivered',
          printStatus: index % 2 ? 'unprinted' : 'printed',
          creatorName: account.name,
          remark: `[mock-login] ${account.name} 演示销售单`,
          items: {
            create: [{
              orgId: organization.id,
              tenantId,
              productId: variant.productId,
              variantId: variant.id,
              productName: variant.product.productName,
              colorName: variant.skuValue || '默认',
              stockQtySnapshot: String(data.stockBase),
              qty: String(qty),
              unitName: variant.unit || variant.product.defaultUnit || '米',
              unitPrice,
              amount: centsToAmount(amountCents)
            }]
          }
        }
      })
    }
  }

  if (data.supplier) {
    const supplier = await prisma.supplier.upsert({
      where: {
        orgId_name: {
          orgId: organization.id,
          name: data.supplier.name
        }
      },
      update: {
        phone: data.supplier.phone,
        totalPurchaseCents: data.supplier.amount,
        status: 'enabled',
        isFrequent: true
      },
      create: {
        tenantId,
        orgId: organization.id,
        name: data.supplier.name,
        phone: data.supplier.phone,
        address: `${organization.name} 常用供应商`,
        isFrequent: true,
        status: 'enabled',
        totalPurchaseCents: data.supplier.amount
      }
    })

    const existingPurchase = await prisma.purchaseOrder.findFirst({
      where: { orgId: organization.id, no: 'CGDEMO-W001' },
      select: { id: true }
    })
    if (!existingPurchase && variants.length) {
      const variant = variants[0]
      await prisma.purchaseOrder.create({
        data: {
          orgId: organization.id,
          tenantId,
          no: 'CGDEMO-W001',
          supplierId: supplier.id,
          warehouseId: warehouse.id,
          orderDate: new Date('2026-05-11T00:00:00.000Z'),
          orderCents: data.supplier.amount,
          contractCents: data.supplier.amount,
          state: 'submitted',
          creator: account.name,
          remark: '[mock-login] 仓库账号采购演示单',
          items: {
            create: [{
              tenantId,
              orgId: organization.id,
              productId: variant.productId,
              variantId: variant.id,
              productName: variant.product.productName,
              color: variant.skuValue || '默认',
              unit: variant.unit || variant.product.defaultUnit || '米',
              quantity: '12',
              unitCents: Math.round(data.supplier.amount / 12),
              amountCents: data.supplier.amount
            }]
          }
        }
      })
    }
  }
}

async function ensureEmployeeWarehouses(prisma, employee, tenantId) {
  if (!employee || !employee.orgId) return employee
  const warehouses = await prisma.warehouse.findMany({
    where: {
      orgId: employee.orgId,
      status: 'enabled'
    },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }]
  })
  const warehouseIds = warehouses.map(warehouse => warehouse.id)
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
        orgId: employee.orgId,
        isDefault: index === 0
      },
      create: {
        tenantId,
        orgId: employee.orgId,
        employeeId: employee.id,
        warehouseId: warehouse.id,
        isDefault: index === 0
      }
    })
  }
  return prisma.employee.update({
    where: { id: employee.id },
    data: { warehouseIds },
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

async function ensureDefaultEmployee(prisma, user) {
  const mockAccount = env.WECHAT_MOCK_LOGIN ? getMockAccountByPhone(user.phone) : null
  const tenant = await ensureTenant(prisma, mockAccount)
  user = await prisma.user.update({
    where: { id: user.id },
    data: {
      tenantId: user.tenantId || tenant.id,
      name: mockAccount ? mockAccount.name : user.name
    }
  })

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
    where: mockAccount
      ? { userId: user.id, organization: { code: mockAccount.orgCode } }
      : { userId: user.id },
    include: {
      organization: true,
      role: true,
      employeeRoles: {
        include: { role: true },
        orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }]
      }
    },
    orderBy: { createdAt: 'asc' }
  })

  if (employee) {
    if (!mockAccount) {
      const employeeTenantId = employee.tenantId || (employee.organization && employee.organization.tenantId) || tenant.id
      await prisma.user.update({
        where: { id: user.id },
        data: {
          tenantId: employeeTenantId,
          name: employee.name || user.name
        }
      })
      employee = await ensureEmployeeWarehouses(prisma, employee, employeeTenantId)
    }
    if (mockAccount && employee.organization) {
      await prisma.organization.update({
        where: { id: employee.organization.id },
        data: {
          tenantId: tenant.id,
          name: mockAccount.orgName
        }
      })
      const roleName = normalizeRoleName(mockAccount.role)
      const rolePermissions = getPermissionsForRole(roleName)
      const role = await prisma.role.upsert({
        where: {
          orgId_name: {
            orgId: employee.organization.id,
            name: roleName
          }
        },
        update: {
          tenantId: tenant.id,
          permissions: rolePermissions
        },
        create: {
          tenantId: tenant.id,
          orgId: employee.organization.id,
          name: roleName,
          description: mockAccount.remark,
          permissions: rolePermissions
        }
      })
      employee = await prisma.employee.update({
        where: { id: employee.id },
        data: {
          name: mockAccount.name,
          tenantId: tenant.id,
          roleId: role.id,
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
      await prisma.employeeRole.upsert({
        where: {
          employeeId_roleId: {
            employeeId: employee.id,
            roleId: role.id
          }
        },
        update: {
          tenantId: tenant.id,
          orgId: employee.organization.id,
          isPrimary: true
        },
        create: {
          tenantId: tenant.id,
          orgId: employee.organization.id,
          employeeId: employee.id,
          roleId: role.id,
          isPrimary: true
        }
      })
      await prisma.userOrgRel.upsert({
        where: {
          userId_orgId: {
            userId: user.id,
            orgId: employee.organization.id
          }
        },
        update: {
          tenantId: tenant.id,
          employeeId: employee.id,
          isDefault: true
        },
        create: {
          tenantId: tenant.id,
          userId: user.id,
          orgId: employee.organization.id,
          employeeId: employee.id,
          isDefault: true
        }
      })
      await ensureMockOrganizationData(prisma, mockAccount, employee.organization)
      employee = await ensureEmployeeWarehouses(prisma, employee, tenant.id)
    }
    return employee
  }
  if (!env.AUTH_AUTO_PROVISION) return employee

  const organization = await prisma.organization.upsert({
    where: { code: mockAccount ? mockAccount.orgCode : 'org-main' },
    update: {
      tenantId: tenant.id,
      name: mockAccount ? mockAccount.orgName : '聚云纺织'
    },
    create: {
      tenantId: tenant.id,
      code: mockAccount ? mockAccount.orgCode : 'org-main',
      name: mockAccount ? mockAccount.orgName : '聚云纺织'
    }
  })

  if (mockAccount) await ensureMockOrganizationData(prisma, mockAccount, organization)

  const roleName = mockAccount ? normalizeRoleName(mockAccount.role) : '老板'
  const rolePermissions = getPermissionsForRole(roleName)
  const role = await prisma.role.upsert({
    where: {
      orgId_name: {
        orgId: organization.id,
        name: roleName
      }
    },
    update: {
      tenantId: tenant.id,
      permissions: rolePermissions
    },
    create: {
      tenantId: tenant.id,
      orgId: organization.id,
      name: roleName,
      description: mockAccount ? mockAccount.remark : '默认拥有全部业务权限',
      permissions: rolePermissions
    }
  })

  employee = await prisma.employee.create({
    data: {
      orgId: organization.id,
      tenantId: tenant.id,
      userId: user.id,
      roleId: role.id,
      name: mockAccount ? mockAccount.name : (user.name || `用户${String(user.phone || '').slice(-4)}`),
      phone: user.phone,
      status: 'enabled',
      warehouseIds: []
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

  await prisma.employeeRole.upsert({
    where: {
      employeeId_roleId: {
        employeeId: employee.id,
        roleId: role.id
      }
    },
    update: {
      tenantId: tenant.id,
      orgId: organization.id,
      isPrimary: true
    },
    create: {
      tenantId: tenant.id,
      orgId: organization.id,
      employeeId: employee.id,
      roleId: role.id,
      isPrimary: true
    }
  })

  await prisma.userOrgRel.upsert({
    where: {
      userId_orgId: {
        userId: user.id,
        orgId: organization.id
      }
    },
    update: {
      tenantId: tenant.id,
      employeeId: employee.id,
      isDefault: true
    },
    create: {
      tenantId: tenant.id,
      userId: user.id,
      orgId: organization.id,
      employeeId: employee.id,
      isDefault: true
    }
  })

  if (mockAccount) await ensureMockOrganizationData(prisma, mockAccount, organization)
  employee = await ensureEmployeeWarehouses(prisma, employee, tenant.id)

  return employee
}

function buildEmployeeRoleContext(employee) {
  const roleContext = mergeRoleContext(
    employee && Array.isArray(employee.employeeRoles) && employee.employeeRoles.length
      ? employee.employeeRoles.map(row => row.role).filter(Boolean)
      : employee && employee.role ? [employee.role] : []
  )
  return {
    ...roleContext,
    roleText: roleContext.roleNames.length ? roleContext.roleNames.join('、') : ''
  }
}

function buildAuthContext(user, employee) {
  const roleContext = employee ? buildEmployeeRoleContext(employee) : mergeRoleContext([{ name: '老板', permissions: DEFAULT_PERMISSIONS }])
  const permissions = roleContext.permissions

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
      code: employee.organization.code,
      tenantId: employee.organization.tenantId || employee.tenantId || null
    } : null,
    employee: employee ? {
      id: employee.id,
      name: employee.name,
      phone: employee.phone,
      status: employee.status,
      roleId: employee.roleId,
      roleIds: Array.isArray(employee.employeeRoles) && employee.employeeRoles.length
        ? employee.employeeRoles.map(row => row.roleId).filter(Boolean)
        : [employee.roleId].filter(Boolean),
      role: roleContext.roleText,
      roleNames: roleContext.roleNames,
      warehouseIds: employee.warehouseIds || [],
      dataScope: roleContext.dataScope,
      dataScopes: roleContext.dataScopes
    } : null,
    permissions,
    dataScope: roleContext.dataScope,
    dataScopes: roleContext.dataScopes
  }
}

async function createAuthSession(prisma, user, employee) {
  const token = createToken()
  const expiresAt = new Date(Date.now() + env.AUTH_SESSION_DAYS * 24 * 60 * 60 * 1000)

  await prisma.authSession.create({
    data: {
      tenantId: employee && (employee.tenantId || (employee.organization && employee.organization.tenantId)),
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
          role: true,
          employeeRoles: {
            include: { role: true },
            orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }]
          }
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
  getMockLoginOptions,
  getWechatOpenid,
  getWechatPhoneInfo,
  hashToken,
  resolveAuthSession,
  ensureDefaultEmployee
}
