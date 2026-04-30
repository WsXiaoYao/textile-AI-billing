const productStore = require('../../services/product-store')

function getUserFilePath(fileName) {
  const safeName = fileName.replace(/[\\/:*?"<>|]/g, '-')
  return `${wx.env.USER_DATA_PATH}/${safeName}`
}

function writeTextFile(fileName, content) {
  return new Promise((resolve, reject) => {
    if (!wx.getFileSystemManager || !wx.env || !wx.env.USER_DATA_PATH) {
      reject(new Error('当前环境不支持本地文件写入'))
      return
    }

    const filePath = getUserFilePath(fileName)
    wx.getFileSystemManager().writeFile({
      filePath,
      data: content,
      encoding: 'utf8',
      success: () => resolve(filePath),
      fail: reject
    })
  })
}

function chooseCategoryFile() {
  return new Promise((resolve, reject) => {
    if (!wx.chooseMessageFile) {
      reject(new Error('当前基础库不支持选择文件'))
      return
    }

    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['csv', 'xlsx', 'xls'],
      success: res => resolve(res.tempFiles && res.tempFiles[0]),
      fail: reject
    })
  })
}

function getExtension(fileName) {
  const match = String(fileName || '').toLowerCase().match(/\.([a-z0-9]+)$/)
  return match ? match[1] : ''
}

function formatFileSize(size) {
  const kb = Math.max(1, Math.ceil(Number(size || 0) / 1024))
  if (kb < 1024) return `${kb}KB`
  return `${(kb / 1024).toFixed(1)}MB`
}

function getParentOptions(categories, currentKey) {
  const blockedPrefix = currentKey ? `${currentKey}/` : ''
  return [{ key: '', label: '顶级分类', labelText: '顶级分类' }]
    .concat(categories
      .filter(category => category.level < 3 && category.key !== currentKey && (!blockedPrefix || !category.key.startsWith(blockedPrefix)))
      .map(category => ({
        key: category.key,
        label: category.label,
        labelText: `${'  '.repeat(Math.max(0, category.level - 1))}${category.label}`
      })))
}

Page({
  data: {
    keyword: '',
    summary: productStore.getProductSummary(),
    categories: [],
    displayedCategories: [],
    categoryEditorVisible: false,
    categoryEditorTitle: '新增分类',
    categoryForm: productStore.getCategoryForm(),
    parentOptions: [],
    parentIndex: 0,
    selectedParentLabel: '顶级分类'
  },

  onLoad() {
    this.loadCategories()
  },

  onShow() {
    this.loadCategories()
  },

  noop() {},

  loadCategories() {
    const categories = productStore.getCategoryTree().filter(category => category.key !== '全部')
    const productSummary = productStore.getProductSummary()
    this.categories = categories
    this.setData({
      categories,
      summary: {
        ...productSummary,
        categoryCount: categories.length
      }
    }, () => {
      this.applyFilters()
    })
  },

  onKeywordInput(event) {
    this.setData({ keyword: event.detail.value }, () => {
      this.applyFilters()
    })
  },

  onOpenCategory(event) {
    wx.navigateTo({
      url: `/pages/products/index?category=${encodeURIComponent(event.currentTarget.dataset.key)}`
    })
  },

  onBackTap() {
    if (getCurrentPages().length > 1) {
      wx.navigateBack()
      return
    }
    wx.switchTab({ url: '/pages/more/index' })
  },

  onAddCategoryTap() {
    this.openCategoryEditor(productStore.getCategoryForm())
  },

  onEditCategoryTap(event) {
    this.openCategoryEditor(productStore.getCategoryForm(event.currentTarget.dataset.key))
  },

  openCategoryEditor(form) {
    const parentOptions = getParentOptions(this.categories || [], form.key)
    const parentIndex = Math.max(0, parentOptions.findIndex(option => option.key === form.parentKey))
    this.setData({
      categoryEditorVisible: true,
      categoryEditorTitle: form.mode === 'edit' ? '编辑分类' : '新增分类',
      categoryForm: form,
      parentOptions,
      parentIndex,
      selectedParentLabel: parentOptions[parentIndex] ? parentOptions[parentIndex].labelText : '顶级分类'
    })
  },

  onCloseCategoryEditor() {
    this.setData({ categoryEditorVisible: false })
  },

  onCategoryLabelInput(event) {
    this.setData({
      categoryForm: {
        ...this.data.categoryForm,
        label: event.detail.value
      }
    })
  },

  onParentChange(event) {
    const parentIndex = Number(event.detail.value)
    const parent = this.data.parentOptions[parentIndex] || this.data.parentOptions[0]
    this.setData({
      parentIndex,
      selectedParentLabel: parent ? parent.labelText : '顶级分类',
      categoryForm: {
        ...this.data.categoryForm,
        parentKey: parent ? parent.key : ''
      }
    })
  },

  onSaveCategoryTap() {
    const result = productStore.saveCategoryForm(this.data.categoryForm)
    if (!result.ok) {
      wx.showToast({ title: result.message, icon: 'none' })
      return
    }

    wx.showToast({ title: '分类已保存', icon: 'success' })
    this.setData({ categoryEditorVisible: false })
    this.loadCategories()
  },

  onImportTap() {
    wx.showActionSheet({
      itemList: ['下载分类模板', '上传分类文件'],
      success: res => {
        if (res.tapIndex === 0) this.onDownloadTemplateTap()
        if (res.tapIndex === 1) this.onUploadCategoryTap()
      }
    })
  },

  onDownloadTemplateTap() {
    writeTextFile('产品分类导入模板.csv', productStore.getCategoryTemplateCsv())
      .then(filePath => {
        productStore.addProductTask({
          title: '产品分类导入模板.csv',
          desc: '模板文件已生成，可用 Excel 打开后按一级、二级、三级分类填写。',
          statusText: '可打开',
          statusTone: 'success',
          filePath,
          actionType: 'category-template'
        })
        wx.showToast({ title: '模板已生成', icon: 'success' })
      })
      .catch(() => {
        wx.showToast({ title: '模板生成失败', icon: 'none' })
      })
  },

  onUploadCategoryTap() {
    chooseCategoryFile()
      .then(file => {
        if (!file) return
        const extension = getExtension(file.name)
        if (!['csv', 'xlsx', 'xls'].includes(extension)) {
          wx.showToast({ title: '请选择 Excel 或 CSV', icon: 'none' })
          return
        }

        productStore.addProductTask({
          title: `分类导入：${file.name}`,
          desc: `已选择 ${extension.toUpperCase()} 文件，大小 ${formatFileSize(file.size)}。待接入后端后由接口解析分类层级并回写分类树。`,
          statusText: '待上传',
          statusTone: 'warning',
          filePath: file.path || '',
          fileName: file.name || '',
          fileSize: file.size || 0,
          fileType: extension,
          actionType: 'category-import'
        })
        wx.showToast({ title: '已创建导入任务', icon: 'none' })
      })
      .catch(error => {
        if (error && /cancel/i.test(error.errMsg || '')) return
        wx.showToast({ title: '没有选择文件', icon: 'none' })
      })
  },

  applyFilters() {
    const keyword = this.data.keyword.trim().toLowerCase()
    const displayedCategories = (this.categories || []).filter(category => {
      const text = [category.label, category.key, category.count].join(' ').toLowerCase()
      return !keyword || text.includes(keyword)
    })
    this.setData({ displayedCategories })
  }
})
