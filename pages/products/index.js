const productStore = require('../../services/product-store')

const sortOptions = [
  { label: '产品编号 从小到大', value: 'noAsc' },
  { label: '产品名称 A-Z', value: 'nameAsc' },
  { label: '售价 从高到低', value: 'priceDesc' },
  { label: '库存预警优先', value: 'warningFirst' }
]

const statusTabs = [
  { label: '全部', value: 'all' },
  { label: '有价格', value: 'priced' },
  { label: '未定价', value: 'missingPrice' },
  { label: '预警', value: 'warning' }
]

const emptyFilters = {
  warehouse: '',
  unit: '',
  priceState: '',
  stockState: ''
}

const productInitialLimit = 24
const productPageSize = 20
const filterDrawerAnimationMs = 240

function getParentCategoryKey(key) {
  if (!key || key === '全部') return ''
  const parts = key.split('/')
  parts.pop()
  return parts.join('/')
}

function cloneFilters(filters) {
  return {
    warehouse: filters.warehouse || '',
    unit: filters.unit || '',
    priceState: filters.priceState || '',
    stockState: filters.stockState || ''
  }
}

function getCategoryLabel(key, nodeMap) {
  if (!key || key === '全部') return '全部'
  return nodeMap[key] ? nodeMap[key].label : key.split('/').pop()
}

function buildCategoryBreadcrumbs(key, nodeMap) {
  const breadcrumbs = [{ key: '全部', label: '全部', active: key === '全部' }]
  if (!key || key === '全部') return breadcrumbs

  const parts = key.split('/')
  parts.forEach((_, index) => {
    const currentKey = parts.slice(0, index + 1).join('/')
    breadcrumbs.push({
      key: currentKey,
      label: getCategoryLabel(currentKey, nodeMap),
      active: currentKey === key
    })
  })
  return breadcrumbs
}

function getCategoryFocusKey(key, nodeMap) {
  if (!key || key === '全部') return ''
  const node = nodeMap[key]
  if (node && node.hasChildren) return key
  return getParentCategoryKey(key)
}

function buildVisibleCategories(nodes, focusKey, selectedKey) {
  const parentKey = focusKey || ''
  return nodes
    .filter(node => node.key !== '全部' && node.parentKey === parentKey)
    .map(node => ({
      ...node,
      active: node.key === selectedKey
    }))
}

function buildFilterSections(filters, products) {
  const warehouses = productStore.getWarehouses().slice(0, 12)
  const units = Array.from(new Set(products.map(product => product.unit).filter(Boolean))).slice(0, 12)
  const sections = [
    {
      key: 'warehouse',
      title: '仓库',
      options: warehouses.map(value => ({ label: value, value }))
    },
    {
      key: 'unit',
      title: '单位',
      options: units.map(value => ({ label: value, value }))
    },
    {
      key: 'priceState',
      title: '价格状态',
      options: [
        { label: '有价格', value: 'priced' },
        { label: '未定价', value: 'missingPrice' },
        { label: '多价格', value: 'multiPrice' }
      ]
    },
    {
      key: 'stockState',
      title: '库存状态',
      options: [
        { label: '有库存', value: 'stocked' },
        { label: '无库存', value: 'empty' },
        { label: '库存预警', value: 'warning' }
      ]
    }
  ]

  return sections.map(section => ({
    ...section,
    options: section.options.map(option => ({
      ...option,
      active: filters[section.key] === option.value
    }))
  }))
}

Page({
  data: {
    keyword: '',
    products: [],
    displayedProducts: [],
    filteredTotal: 0,
    productRenderCount: 0,
    productHasMore: false,
    productLoadingMore: false,
    summary: productStore.getProductSummary(),
    categories: [],
    categoryBreadcrumbs: [{ key: '全部', label: '全部', active: true }],
    categoryFocusKey: '',
    selectedCategory: '全部',
    selectedCategoryLabel: '全部',
    statusTabs,
    activeStatus: 'all',
    sortOptions,
    sortValue: 'noAsc',
    sortIndex: 0,
    filterCount: 0,
    filters: cloneFilters(emptyFilters),
    filterDraft: cloneFilters(emptyFilters),
    filterViewSections: [],
    filterDraftCount: 0,
    filterDrawerVisible: false,
    filterDrawerActive: false
  },

  onLoad(options = {}) {
    const selectedCategory = decodeURIComponent(options.category || '')
    if (selectedCategory) {
      this.setData({
        selectedCategory,
        selectedCategoryLabel: selectedCategory.split('/').pop()
      })
    }
    this.loadProducts()
  },

  onShow() {
    this.loadProducts()
  },

  onPullDownRefresh() {
    this.loadProducts(() => {
      wx.stopPullDownRefresh()
    })
  },

  onReachBottom() {
    this.loadMoreProducts()
  },

  onUnload() {
    this.clearFilterDrawerTimer()
  },

  loadProducts(callback) {
    this.allProducts = productStore.getProductList()
    this.categoryNodes = productStore.getCategoryTree()
    this.categoryNodeMap = this.categoryNodes.reduce((map, node) => {
      map[node.key] = node
      return map
    }, {})

    const selectedCategory = this.categoryNodeMap[this.data.selectedCategory]
      ? this.data.selectedCategory
      : '全部'
    const categoryFocusKey = getCategoryFocusKey(selectedCategory, this.categoryNodeMap)

    this.setData({
      summary: productStore.getProductSummary(),
      selectedCategory,
      categoryFocusKey,
      selectedCategoryLabel: getCategoryLabel(selectedCategory, this.categoryNodeMap),
      categoryBreadcrumbs: buildCategoryBreadcrumbs(selectedCategory, this.categoryNodeMap),
      categories: buildVisibleCategories(this.categoryNodes, categoryFocusKey, selectedCategory),
      filterViewSections: buildFilterSections(this.data.filters, this.allProducts)
    }, () => {
      this.applyFilters(callback)
    })
  },

  onKeywordInput(event) {
    this.setData({ keyword: event.detail.value }, () => {
      this.applyFilters()
    })
  },

  onKeywordConfirm() {
    this.applyFilters()
  },

  onCategoryTap(event) {
    const key = event.currentTarget.dataset.key || '全部'
    this.selectCategory(key)
  },

  onCategoryCrumbTap(event) {
    this.selectCategory(event.currentTarget.dataset.key || '全部')
  },

  selectCategory(key) {
    const nodeMap = this.categoryNodeMap || {}
    const nodes = this.categoryNodes || []
    const selectedCategory = nodeMap[key] ? key : '全部'
    const categoryFocusKey = getCategoryFocusKey(selectedCategory, nodeMap)

    this.setData({
      selectedCategory,
      categoryFocusKey,
      selectedCategoryLabel: getCategoryLabel(selectedCategory, nodeMap),
      categoryBreadcrumbs: buildCategoryBreadcrumbs(selectedCategory, nodeMap),
      categories: buildVisibleCategories(nodes, categoryFocusKey, selectedCategory)
    }, () => {
      this.applyFilters()
    })
  },

  onStatusTap(event) {
    this.setData({
      activeStatus: event.currentTarget.dataset.value || 'all'
    }, () => {
      this.applyFilters()
    })
  },

  onSortChange(event) {
    const sortIndex = Number(event.detail.value)
    const selected = sortOptions[sortIndex]
    if (!selected) return
    this.setData({
      sortIndex,
      sortValue: selected.value
    }, () => {
      this.applyFilters()
    })
  },

  onFilterTap() {
    this.clearFilterDrawerTimer()
    const filterDraft = cloneFilters(this.data.filters)
    this.setData({
      filterDraft,
      filterViewSections: buildFilterSections(filterDraft, this.allProducts || []),
      filterDraftCount: this.countFilters(filterDraft),
      filterDrawerVisible: true,
      filterDrawerActive: false
    }, () => {
      wx.nextTick(() => {
        if (this.data.filterDrawerVisible) {
          this.setData({ filterDrawerActive: true })
        }
      })
    })
  },

  onFilterOptionTap(event) {
    const { key, value } = event.currentTarget.dataset
    const filterDraft = cloneFilters(this.data.filterDraft)
    filterDraft[key] = filterDraft[key] === value ? '' : value
    this.setData({
      filterDraft,
      filterViewSections: buildFilterSections(filterDraft, this.allProducts || []),
      filterDraftCount: this.countFilters(filterDraft)
    })
  },

  onResetFilters() {
    const filterDraft = cloneFilters(emptyFilters)
    this.setData({
      filterDraft,
      filterViewSections: buildFilterSections(filterDraft, this.allProducts || []),
      filterDraftCount: 0
    })
  },

  onApplyFilters() {
    const filters = cloneFilters(this.data.filterDraft)
    this.setData({
      filters,
      filterCount: this.countFilters(filters)
    }, () => {
      this.applyFilters()
      this.closeFilterDrawer()
    })
  },

  onCancelFilter() {
    this.closeFilterDrawer()
  },

  onImportTap() {
    wx.navigateTo({ url: '/pages/product-import/index' })
  },

  onAddMenuTap() {
    wx.showActionSheet({
      itemList: ['新增产品', '批量导入'],
      success: res => {
        if (res.tapIndex === 1) {
          this.onImportTap()
          return
        }
        wx.navigateTo({ url: '/pages/product-edit/index' })
      }
    })
  },

  onOpenProduct(event) {
    wx.navigateTo({
      url: `/pages/product-detail/index?id=${encodeURIComponent(event.currentTarget.dataset.id)}`
    })
  },

  onScrollToLower() {
    this.loadMoreProducts()
  },

  noop() {},

  applyFilters(callback) {
    const keyword = this.data.keyword.trim().toLowerCase()
    const categoryKey = this.data.selectedCategory
    const activeStatus = this.data.activeStatus
    const filters = this.data.filters
    const products = this.allProducts || []
    const filteredProducts = this.sortProducts(products.filter(product => {
      return (!keyword || product.searchText.includes(keyword)) &&
        this.isCategoryMatched(product, categoryKey) &&
        this.isStatusMatched(product, activeStatus) &&
        this.isFilterMatched(product, filters)
    }))

    this.filteredProducts = filteredProducts
    this.resetProductWindow(callback)
  },

  resetProductWindow(callback) {
    const filteredProducts = this.filteredProducts || []
    const nextCount = Math.min(productInitialLimit, filteredProducts.length)
    this.setData({
      displayedProducts: filteredProducts.slice(0, nextCount),
      filteredTotal: filteredProducts.length,
      productRenderCount: nextCount,
      productHasMore: nextCount < filteredProducts.length,
      productLoadingMore: false
    }, callback)
  },

  loadMoreProducts() {
    if (this.data.productLoadingMore || !this.data.productHasMore) return

    const filteredProducts = this.filteredProducts || []
    const currentCount = this.data.productRenderCount
    const nextCount = Math.min(currentCount + productPageSize, filteredProducts.length)
    const nextItems = filteredProducts.slice(currentCount, nextCount)

    this.setData({ productLoadingMore: true }, () => {
      this.setData({
        displayedProducts: this.data.displayedProducts.concat(nextItems),
        productRenderCount: nextCount,
        productHasMore: nextCount < filteredProducts.length,
        productLoadingMore: false
      })
    })
  },

  sortProducts(list) {
    const sorted = list.slice()
    const sortValue = this.data.sortValue
    sorted.sort((a, b) => {
      if (sortValue === 'nameAsc') return a.name.localeCompare(b.name, 'zh-Hans-CN')
      if (sortValue === 'priceDesc') return b.maxPriceCents - a.maxPriceCents
      if (sortValue === 'warningFirst') return b.warningCount - a.warningCount
      return String(a.no).localeCompare(String(b.no), 'zh-Hans-CN', { numeric: true })
    })
    return sorted
  },

  isStatusMatched(product, status) {
    if (status === 'priced') return product.minPriceCents > 0
    if (status === 'missingPrice') return product.variants.some(variant => !variant.priceCents)
    if (status === 'warning') return product.warningCount > 0
    return true
  },

  isCategoryMatched(product, categoryKey) {
    if (!categoryKey || categoryKey === '全部') return true
    if (product.category === categoryKey) return true
    return (product.categoryPathKeys || []).includes(categoryKey)
  },

  isFilterMatched(product, filters) {
    if (filters.warehouse && product.warehouse !== filters.warehouse) return false
    if (filters.unit && product.unit !== filters.unit) return false
    if (filters.priceState === 'priced' && !product.minPriceCents) return false
    if (filters.priceState === 'missingPrice' && !product.variants.some(variant => !variant.priceCents)) return false
    if (filters.priceState === 'multiPrice' && product.minPriceCents === product.maxPriceCents) return false
    if (filters.stockState === 'stocked' && product.totalStock <= 0) return false
    if (filters.stockState === 'empty' && product.totalStock > 0) return false
    if (filters.stockState === 'warning' && product.warningCount <= 0) return false
    return true
  },

  countFilters(filters) {
    return Object.keys(filters).filter(key => Boolean(filters[key])).length
  },

  closeFilterDrawer() {
    if (!this.data.filterDrawerVisible) return
    this.clearFilterDrawerTimer()
    this.setData({ filterDrawerActive: false })
    this.filterDrawerTimer = setTimeout(() => {
      this.setData({ filterDrawerVisible: false })
      this.filterDrawerTimer = null
    }, filterDrawerAnimationMs)
  },

  clearFilterDrawerTimer() {
    if (!this.filterDrawerTimer) return
    clearTimeout(this.filterDrawerTimer)
    this.filterDrawerTimer = null
  }
})
