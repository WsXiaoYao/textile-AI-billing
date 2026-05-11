const categoryApi = require('../../api/customer-category-api')

function emptyForm() {
  return {
    id: '',
    name: '',
    sortOrder: 0,
    isActive: true,
    isDefault: false
  }
}

Page({
  data: {
    keyword: '',
    summary: {
      categoryCount: 0,
      activeCount: 0,
      customerCount: 0
    },
    categories: [],
    displayedCategories: [],
    editorVisible: false,
    editorTitle: '新增分类',
    form: emptyForm()
  },

  onLoad() {
    this.loadCategories()
  },

  onShow() {
    this.loadCategories()
  },

  noop() {},

  async loadCategories() {
    try {
      const result = await categoryApi.listCategories({ includeInactive: true })
      const categories = result.list || []
      this.categories = categories
      this.setData({
        categories,
        summary: result.summary || this.data.summary
      }, () => {
        this.applyFilters()
      })
    } catch (error) {
      wx.showToast({
        title: error.message || '分类加载失败',
        icon: 'none'
      })
    }
  },

  onKeywordInput(event) {
    this.setData({ keyword: event.detail.value }, () => {
      this.applyFilters()
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
    this.openEditor(emptyForm())
  },

  onEditCategoryTap(event) {
    const id = event.currentTarget.dataset.id
    const category = (this.categories || []).find(item => item.id === id)
    if (!category) return
    this.openEditor({
      id: category.id,
      name: category.name,
      sortOrder: category.sortOrder || 0,
      isActive: category.isActive,
      isDefault: category.isDefault
    })
  },

  openEditor(form) {
    this.setData({
      editorVisible: true,
      editorTitle: form.id ? '编辑客户分类' : '新增客户分类',
      form
    })
  },

  onCloseEditor() {
    this.setData({ editorVisible: false })
  },

  onNameInput(event) {
    this.setData({
      form: {
        ...this.data.form,
        name: event.detail.value
      }
    })
  },

  onSortInput(event) {
    this.setData({
      form: {
        ...this.data.form,
        sortOrder: Number(event.detail.value || 0)
      }
    })
  },

  onActiveChange(event) {
    this.setData({
      form: {
        ...this.data.form,
        isActive: event.detail.value
      }
    })
  },

  async onSaveCategoryTap() {
    const form = this.data.form
    if (!String(form.name || '').trim()) {
      wx.showToast({ title: '请输入分类名称', icon: 'none' })
      return
    }

    try {
      await categoryApi.saveCategory({
        id: form.id,
        name: form.name,
        sortOrder: form.sortOrder,
        isActive: form.isActive,
        isDefault: form.isDefault
      })
      wx.showToast({ title: '分类已保存', icon: 'success' })
      this.setData({ editorVisible: false })
      this.loadCategories()
    } catch (error) {
      wx.showToast({
        title: error.message || '分类保存失败',
        icon: 'none'
      })
    }
  },

  applyFilters() {
    const keyword = this.data.keyword.trim().toLowerCase()
    const displayedCategories = (this.categories || []).filter(category => {
      const text = [category.name, category.customerCount, category.isActive ? '启用' : '停用'].join(' ').toLowerCase()
      return !keyword || text.includes(keyword)
    })
    this.setData({ displayedCategories })
  }
})
