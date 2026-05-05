const env = require('../../config/env')
const orderStore = require('../../services/order-store')
const productStore = require('../../services/product-store')
const inventoryStore = require('../../services/inventory-store')
const warehouseStore = require('../../services/warehouse-store')
const supplierStore = require('../../services/supplier-store')
const purchaseStore = require('../../services/purchase-store')
const returnStore = require('../../services/return-store')
const profileStore = require('../../services/profile-store')
const employeeStore = require('../../services/employee-store')
const messageStore = require('../../services/message-store')
const { delay, filterByKeyword, normalizePath, notFound, ok, pageResult } = require('../utils')

function route(method, pattern, handler) {
  return { method, pattern, handler }
}

function getPayload(options) {
  return options.data || {}
}

function listResponse(list, payload) {
  return pageResult(list, payload)
}

function findCustomerName(id) {
  const detail = orderStore.getCustomerDetail(id)
  return detail && detail.name ? detail.name : id
}

const routes = [
  route('GET', /^\/sales-orders\/summary$/, ({ payload }) => orderStore.getOrderSummary(payload)),
  route('GET', /^\/sales-orders$/, ({ payload }) => {
    const list = filterByKeyword(orderStore.getOrderList(), payload.keyword, ['id', 'no', 'customerName', 'goodsSummary', 'creator'])
    return listResponse(list, payload)
  }),
  route('POST', /^\/sales-orders$/, ({ payload }) => orderStore.createOrderFromCheckout(payload)),
  route('GET', /^\/sales-orders\/([^/]+)$/, ({ match }) => orderStore.getOrderDetail(decodeURIComponent(match[1]))),
  route('GET', /^\/sales-orders\/([^/]+)\/receipt-context$/, ({ match }) => orderStore.getReceiptOrder(decodeURIComponent(match[1]))),
  route('POST', /^\/sales-orders\/([^/]+)\/receipts$/, ({ match, payload }) => orderStore.recordReceipt(decodeURIComponent(match[1]), payload)),
  route('POST', /^\/sales-orders\/([^/]+)\/print$/, ({ match }) => orderStore.markPrinted(decodeURIComponent(match[1]))),

  route('GET', /^\/customers\/summary$/, ({ payload }) => orderStore.getCustomerSummary(payload)),
  route('GET', /^\/customers\/import-export$/, () => orderStore.getCustomerImportExport()),
  route('GET', /^\/customers\/import-template$/, () => ({ fileName: 'customer-template.csv', content: orderStore.getCustomerTemplateCsv() })),
  route('GET', /^\/customers\/export$/, ({ payload }) => ({ fileName: 'customers.csv', content: orderStore.getCustomerExportCsv(payload.type) })),
  route('GET', /^\/customers\/import-tasks\/([^/]+)$/, ({ match }) => orderStore.getCustomerImportTask(decodeURIComponent(match[1]))),
  route('POST', /^\/customers\/import-tasks$/, ({ payload }) => orderStore.addCustomerImportTask(payload)),
  route('PUT', /^\/customers\/import-tasks\/([^/]+)$/, ({ match, payload }) => orderStore.updateCustomerImportTask(decodeURIComponent(match[1]), payload)),
  route('GET', /^\/customers$/, ({ payload }) => {
    const list = filterByKeyword(orderStore.getCustomerList(), payload.keyword, ['id', 'name', 'phone', 'address', 'category'])
    return listResponse(list, payload)
  }),
  route('POST', /^\/customers$/, ({ payload }) => orderStore.saveCustomerProfile(payload)),
  route('GET', /^\/customers\/([^/]+)$/, ({ match }) => orderStore.getCustomerDetail(decodeURIComponent(match[1]))),
  route('PUT', /^\/customers\/([^/]+)$/, ({ match, payload }) => orderStore.saveCustomerProfile({ ...payload, id: decodeURIComponent(match[1]) })),
  route('GET', /^\/customers\/([^/]+)\/receipt-context$/, ({ match, payload }) => {
    return orderStore.getCustomerReceipt(decodeURIComponent(match[1]), payload.amountCents, payload)
  }),
  route('POST', /^\/customers\/([^/]+)\/receipts$/, ({ match, payload }) => {
    const id = decodeURIComponent(match[1])
    if (payload && payload.prepayMode) return orderStore.recordCustomerPrepayment(id, payload)
    return orderStore.recordCustomerReceipt(id, payload)
  }),
  route('GET', /^\/customers\/([^/]+)\/sales-orders$/, ({ match, payload }) => {
    const detail = orderStore.getCustomerDetail(decodeURIComponent(match[1]))
    return listResponse(detail.salesRecords || [], payload)
  }),
  route('GET', /^\/customers\/([^/]+)\/fund-records$/, ({ match, payload }) => {
    const detail = orderStore.getCustomerDetail(decodeURIComponent(match[1]))
    return listResponse(detail.fundRecords || [], payload)
  }),
  route('GET', /^\/fund-records\/([^/]+)$/, ({ match }) => orderStore.getFundDetail(decodeURIComponent(match[1]))),

  route('GET', /^\/products\/summary$/, () => productStore.getProductSummary()),
  route('GET', /^\/products\/import-export$/, () => productStore.getProductImportExport()),
  route('GET', /^\/products\/import-template$/, () => ({ fileName: 'product-template.csv', content: productStore.getProductTemplateCsv() })),
  route('GET', /^\/products\/export$/, () => ({ fileName: 'products.csv', content: productStore.getProductExportCsv() })),
  route('GET', /^\/products\/tasks\/([^/]+)$/, ({ match }) => productStore.getProductTask(decodeURIComponent(match[1]))),
  route('POST', /^\/products\/tasks$/, ({ payload }) => productStore.addProductTask(payload)),
  route('GET', /^\/products\/search$/, ({ payload }) => {
    const list = filterByKeyword(productStore.getProductList(), payload.keyword, ['id', 'no', 'name', 'categoryText', 'warehouseName'])
    return listResponse(list, payload)
  }),
  route('GET', /^\/products$/, ({ payload }) => {
    const list = filterByKeyword(productStore.getProductList(), payload.keyword, ['id', 'no', 'name', 'categoryText', 'warehouseName'])
    return listResponse(list, payload)
  }),
  route('POST', /^\/products$/, ({ payload }) => productStore.saveProductForm(payload)),
  route('GET', /^\/products\/([^/]+)$/, ({ match }) => productStore.getProduct(decodeURIComponent(match[1]))),
  route('GET', /^\/products\/([^/]+)\/form$/, ({ match }) => productStore.getProductForm(decodeURIComponent(match[1]))),
  route('PUT', /^\/products\/([^/]+)$/, ({ match, payload }) => productStore.saveProductForm({ ...payload, id: decodeURIComponent(match[1]) })),
  route('POST', /^\/products\/([^/]+)\/variants\/([^/]+)\/stock$/, ({ match, payload }) => {
    return productStore.updateVariantStock(decodeURIComponent(match[1]), decodeURIComponent(match[2]), payload.stockQty)
  }),
  route('GET', /^\/product-categories\/tree$/, () => productStore.getCategoryTree()),
  route('GET', /^\/product-categories$/, () => productStore.getCategories()),
  route('GET', /^\/product-categories\/import-template$/, () => ({ fileName: 'product-category-template.csv', content: productStore.getCategoryTemplateCsv() })),
  route('GET', /^\/product-categories\/([^/]+)\/form$/, ({ match }) => productStore.getCategoryForm(decodeURIComponent(match[1]))),
  route('POST', /^\/product-categories$/, ({ payload }) => productStore.saveCategoryForm(payload)),
  route('PUT', /^\/product-categories\/([^/]+)$/, ({ match, payload }) => productStore.saveCategoryForm({ ...payload, key: decodeURIComponent(match[1]) })),
  route('GET', /^\/product-options\/warehouses$/, () => productStore.getWarehouses()),
  route('GET', /^\/product-options\/colors$/, () => productStore.getColorOptions()),

  route('GET', /^\/inventory\/summary$/, ({ payload }) => inventoryStore.getInventorySummary(payload)),
  route('GET', /^\/inventory$/, ({ payload }) => listResponse(inventoryStore.queryInventory(payload), payload)),
  route('GET', /^\/inventory\/([^/]+)$/, ({ match }) => inventoryStore.getInventoryItem(decodeURIComponent(match[1]))),
  route('GET', /^\/inventory\/([^/]+)\/adjust-context$/, ({ match }) => ({
    item: inventoryStore.getInventoryItem(decodeURIComponent(match[1])),
    recentAdjustments: inventoryStore.getRecentAdjustments(decodeURIComponent(match[1]))
  })),
  route('POST', /^\/inventory\/adjustments$/, ({ payload }) => inventoryStore.saveInventoryAdjust(payload)),
  route('GET', /^\/inventory-options\/warehouses$/, () => inventoryStore.getWarehouseOptions()),

  route('GET', /^\/warehouses\/summary$/, () => warehouseStore.getWarehouseSummary()),
  route('GET', /^\/warehouses$/, ({ payload }) => {
    const list = filterByKeyword(warehouseStore.getWarehouseList(), payload.keyword, ['id', 'name', 'manager', 'address'])
    return listResponse(list, payload)
  }),
  route('POST', /^\/warehouses$/, ({ payload }) => warehouseStore.saveWarehouseForm(payload)),
  route('GET', /^\/warehouses\/names$/, () => warehouseStore.getWarehouseNames()),
  route('GET', /^\/warehouses\/([^/]+)$/, ({ match }) => warehouseStore.getWarehouse(decodeURIComponent(match[1]))),
  route('GET', /^\/warehouses\/([^/]+)\/form$/, ({ match }) => warehouseStore.getWarehouseForm(decodeURIComponent(match[1]))),
  route('PUT', /^\/warehouses\/([^/]+)$/, ({ match, payload }) => warehouseStore.saveWarehouseForm({ ...payload, id: decodeURIComponent(match[1]) })),
  route('POST', /^\/warehouses\/([^/]+)\/status$/, ({ match }) => warehouseStore.toggleWarehouseStatus(decodeURIComponent(match[1]))),

  route('GET', /^\/suppliers$/, ({ payload }) => {
    const list = filterByKeyword(supplierStore.getSupplierList(), payload.keyword, ['id', 'name', 'phone', 'address'])
    return listResponse(list, payload)
  }),
  route('POST', /^\/suppliers$/, ({ payload }) => supplierStore.saveSupplierForm(payload)),
  route('GET', /^\/suppliers\/([^/]+)$/, ({ match }) => supplierStore.getSupplier(decodeURIComponent(match[1]))),
  route('GET', /^\/suppliers\/([^/]+)\/form$/, ({ match }) => supplierStore.getSupplierForm(decodeURIComponent(match[1]))),
  route('PUT', /^\/suppliers\/([^/]+)$/, ({ match, payload }) => supplierStore.saveSupplierForm({ ...payload, id: decodeURIComponent(match[1]) })),
  route('POST', /^\/suppliers\/([^/]+)\/status$/, ({ match }) => supplierStore.toggleSupplierStatus(decodeURIComponent(match[1]))),

  route('GET', /^\/purchase-orders$/, ({ payload }) => {
    const list = filterByKeyword(purchaseStore.getPurchaseOrderList(), payload.keyword, ['id', 'no', 'supplierName', 'warehouseName', 'creator'])
    return listResponse(list, payload)
  }),
  route('POST', /^\/purchase-orders$/, ({ payload }) => purchaseStore.savePurchaseOrderForm(payload)),
  route('POST', /^\/purchase-orders\/submit$/, ({ payload }) => purchaseStore.submitPurchaseOrderForm(payload)),
  route('GET', /^\/purchase-orders\/([^/]+)$/, ({ match }) => purchaseStore.getPurchaseOrder(decodeURIComponent(match[1]))),
  route('GET', /^\/purchase-orders\/([^/]+)\/form$/, ({ match }) => purchaseStore.getPurchaseOrderForm(decodeURIComponent(match[1]))),
  route('PUT', /^\/purchase-orders\/([^/]+)$/, ({ match, payload }) => purchaseStore.savePurchaseOrderForm({ ...payload, id: decodeURIComponent(match[1]) })),
  route('GET', /^\/purchase-options\/suppliers$/, () => purchaseStore.getSupplierOptions()),
  route('GET', /^\/purchase-options\/warehouses$/, () => purchaseStore.getWarehouseOptions()),
  route('GET', /^\/purchase-options\/products$/, ({ payload }) => {
    const list = filterByKeyword(purchaseStore.getProductOptions(), payload.keyword, ['productName', 'color', 'categoryText'])
    return listResponse(list, payload)
  }),

  route('GET', /^\/return-orders\/summary$/, ({ payload }) => returnStore.getReturnSummary(returnStore.getReturnOrderList(), payload)),
  route('GET', /^\/return-orders$/, ({ payload }) => {
    const list = filterByKeyword(returnStore.getReturnOrderList(), payload.keyword, ['id', 'no', 'customerName', 'warehouseName'])
    return listResponse(list, payload)
  }),
  route('POST', /^\/return-orders$/, ({ payload }) => returnStore.saveReturnOrderForm(payload)),
  route('POST', /^\/return-orders\/submit$/, ({ payload }) => returnStore.submitReturnOrderForm(payload)),
  route('GET', /^\/return-orders\/([^/]+)$/, ({ match }) => returnStore.getReturnOrder(decodeURIComponent(match[1]))),
  route('GET', /^\/return-orders\/([^/]+)\/form$/, ({ match }) => returnStore.getReturnOrderForm(decodeURIComponent(match[1]))),
  route('PUT', /^\/return-orders\/([^/]+)$/, ({ match, payload }) => returnStore.saveReturnOrderForm({ ...payload, id: decodeURIComponent(match[1]) })),
  route('GET', /^\/return-options\/customers$/, () => returnStore.getCustomerOptions()),
  route('GET', /^\/return-options\/warehouses$/, () => returnStore.getWarehouseOptions()),
  route('GET', /^\/return-options\/products$/, ({ payload }) => {
    const list = filterByKeyword(returnStore.getProductOptions(), payload.keyword, ['productName', 'color', 'categoryText'])
    return listResponse(list, payload)
  }),

  route('GET', /^\/profile\/home$/, () => profileStore.getProfileHome()),
  route('GET', /^\/organizations\/current$/, () => profileStore.getCurrentOrg()),
  route('GET', /^\/organizations$/, ({ payload }) => listResponse(profileStore.getOrganizations(payload.keyword), payload)),
  route('POST', /^\/organizations\/switch$/, ({ payload }) => profileStore.switchOrganization(payload.orgId || payload.id)),
  route('GET', /^\/organizations\/receipt-settings$/, () => profileStore.getReceiptSettings()),
  route('PUT', /^\/organizations\/receipt-settings$/, ({ payload }) => profileStore.saveReceiptSettings(payload)),

  route('GET', /^\/employees$/, ({ payload }) => {
    const list = filterByKeyword(employeeStore.getEmployeeList(), payload.keyword, ['id', 'name', 'phone', 'roleName'])
    return listResponse(list, payload)
  }),
  route('POST', /^\/employees$/, ({ payload }) => employeeStore.saveEmployeeForm(payload)),
  route('GET', /^\/employees\/roles$/, ({ payload }) => employeeStore.getRoleList(payload.selectedRoleId)),
  route('GET', /^\/employees\/warehouse-options$/, () => employeeStore.getWarehouseOptions()),
  route('GET', /^\/employees\/([^/]+)$/, ({ match }) => employeeStore.getEmployee(decodeURIComponent(match[1]))),
  route('GET', /^\/employees\/([^/]+)\/form$/, ({ match }) => employeeStore.getEmployeeForm(decodeURIComponent(match[1]))),
  route('PUT', /^\/employees\/([^/]+)$/, ({ match, payload }) => employeeStore.saveEmployeeForm({ ...payload, id: decodeURIComponent(match[1]) })),
  route('POST', /^\/employees\/([^/]+)\/status$/, ({ match, payload }) => employeeStore.updateEmployeeStatus(decodeURIComponent(match[1]), payload.statusKey || payload.status)),

  route('GET', /^\/messages\/stats$/, () => messageStore.getMessageStats()),
  route('GET', /^\/messages$/, ({ payload }) => listResponse(messageStore.getMessages(payload.filter), payload)),
  route('GET', /^\/messages\/([^/]+)$/, ({ match }) => messageStore.getMessageDetail(decodeURIComponent(match[1]))),
  route('POST', /^\/messages\/([^/]+)\/read$/, ({ match }) => messageStore.markMessageRead(decodeURIComponent(match[1]))),
  route('POST', /^\/messages\/read-all$/, () => messageStore.markAllRead()),

  route('GET', /^\/checkout\/session$/, ({ payload }) => ({
    customer: payload.customerId ? orderStore.getCustomerDetail(payload.customerId) : orderStore.getCustomerList()[0],
    customers: orderStore.getCustomerList().slice(0, 20),
    products: productStore.getProductList().slice(0, 20)
  })),
  route('GET', /^\/checkout\/customers\/([^/]+)$/, ({ match }) => orderStore.getCustomerDetail(findCustomerName(decodeURIComponent(match[1]))))
]

async function request(options = {}) {
  await delay(env.MOCK_DELAY)

  const method = String(options.method || 'GET').toUpperCase()
  const path = normalizePath(options.url || options.path || '/')
  const payload = getPayload(options)

  for (const item of routes) {
    if (item.method !== method) continue
    const match = path.match(item.pattern)
    if (!match) continue
    return ok(item.handler({ method, path, payload, match }))
  }

  const missing = notFound(method, path)
  if (missing.code !== 0) {
    throw new Error(missing.message)
  }
  return missing
}

module.exports = {
  request
}
