const { dataRequest } = require('./request')

module.exports = {
  addImportTask(payload) {
    return dataRequest({ method: 'POST', url: '/products/tasks', data: payload })
  },
  exportProducts() {
    return dataRequest({ method: 'GET', url: '/products/export' })
  },
  getCategoryForm(key) {
    return dataRequest({ method: 'GET', url: `/product-categories/${encodeURIComponent(key)}/form` })
  },
  getCategoryTemplate() {
    return dataRequest({ method: 'GET', url: '/product-categories/import-template' })
  },
  getCategoryTree() {
    return dataRequest({ method: 'GET', url: '/product-categories/tree' })
  },
  getColorOptions() {
    return dataRequest({ method: 'GET', url: '/product-options/colors' })
  },
  getImportExportCenter() {
    return dataRequest({ method: 'GET', url: '/products/import-export' })
  },
  getImportTask(id) {
    return dataRequest({ method: 'GET', url: `/products/tasks/${encodeURIComponent(id)}` })
  },
  getProduct(id) {
    return dataRequest({ method: 'GET', url: `/products/${encodeURIComponent(id)}` })
  },
  getProductForm(id) {
    return dataRequest({ method: 'GET', url: `/products/${encodeURIComponent(id)}/form` })
  },
  getProductSummary() {
    return dataRequest({ method: 'GET', url: '/products/summary' })
  },
  getProductTemplate() {
    return dataRequest({ method: 'GET', url: '/products/import-template' })
  },
  getWarehouses() {
    return dataRequest({ method: 'GET', url: '/product-options/warehouses' })
  },
  listCategories() {
    return dataRequest({ method: 'GET', url: '/product-categories' })
  },
  listProducts(params) {
    return dataRequest({ method: 'GET', url: '/products', data: params })
  },
  saveCategory(payload) {
    const method = payload && payload.key ? 'PUT' : 'POST'
    const url = payload && payload.key ? `/product-categories/${encodeURIComponent(payload.key)}` : '/product-categories'
    return dataRequest({ method, url, data: payload })
  },
  saveProduct(payload) {
    const method = payload && payload.id ? 'PUT' : 'POST'
    const url = payload && payload.id ? `/products/${encodeURIComponent(payload.id)}` : '/products'
    return dataRequest({ method, url, data: payload })
  },
  searchProducts(params) {
    return dataRequest({ method: 'GET', url: '/products/search', data: params })
  },
  updateVariantStock(productId, variantId, stockQty) {
    return dataRequest({
      method: 'POST',
      url: `/products/${encodeURIComponent(productId)}/variants/${encodeURIComponent(variantId)}/stock`,
      data: { stockQty }
    })
  }
}
