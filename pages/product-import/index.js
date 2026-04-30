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

function chooseProductFile() {
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

Page({
  data: {
    center: productStore.getProductImportExport()
  },

  onShow() {
    this.refreshCenter()
  },

  refreshCenter() {
    this.setData({
      center: productStore.getProductImportExport()
    })
  },

  onBackTap() {
    if (getCurrentPages().length > 1) {
      wx.navigateBack()
      return
    }
    wx.navigateTo({ url: '/pages/products/index' })
  },

  onDownloadTemplateTap() {
    writeTextFile('产品导入模板.csv', productStore.getProductTemplateCsv())
      .then(filePath => {
        productStore.addProductTask({
          title: '产品导入模板.csv',
          desc: '模板文件已生成，可用 Excel 打开后按产品和颜色行填写。',
          statusText: '可打开',
          statusTone: 'success',
          filePath,
          actionType: 'template'
        })
        this.refreshCenter()
        wx.showToast({ title: '模板已生成', icon: 'success' })
      })
      .catch(() => {
        productStore.addProductTask({
          title: '产品导入模板.csv',
          desc: '当前环境无法写入本地模板文件。',
          statusText: '生成失败',
          statusTone: 'danger',
          actionType: 'template'
        })
        this.refreshCenter()
        wx.showToast({ title: '模板生成失败', icon: 'none' })
      })
  },

  onUploadTap() {
    chooseProductFile()
      .then(file => {
        if (!file) return
        const extension = getExtension(file.name)
        if (!['csv', 'xlsx', 'xls'].includes(extension)) {
          wx.showToast({ title: '请选择 Excel 或 CSV', icon: 'none' })
          return
        }

        productStore.addProductTask({
          title: `产品导入：${file.name}`,
          desc: `已选择 ${extension.toUpperCase()} 文件，大小 ${formatFileSize(file.size)}。待接入后端上传接口后，由后端解析产品主数据和颜色价格明细。`,
          statusText: '待上传',
          statusTone: 'warning',
          filePath: file.path || '',
          fileName: file.name || '',
          fileSize: file.size || 0,
          fileType: extension,
          actionType: 'import'
        })
        this.refreshCenter()
        wx.showToast({ title: '已创建上传任务', icon: 'none' })
      })
      .catch(error => {
        if (error && /cancel/i.test(error.errMsg || '')) return
        wx.showToast({ title: '没有选择文件', icon: 'none' })
      })
  },

  onExportTap(event) {
    const type = event.currentTarget.dataset.type || 'all'
    const fileName = type === 'link' ? '产品下载文件.csv' : '产品资料导出.csv'

    writeTextFile(fileName, productStore.getProductExportCsv())
      .then(filePath => {
        productStore.addProductTask({
          title: fileName,
          desc: `已根据当前产品资料生成本地 CSV 文件，共 ${productStore.getProductList().length} 个产品。`,
          statusText: '可打开',
          statusTone: 'success',
          filePath,
          actionType: 'export'
        })
        this.refreshCenter()
        wx.showToast({ title: '导出文件已生成', icon: 'success' })
      })
      .catch(() => {
        productStore.addProductTask({
          title: fileName,
          desc: '当前环境无法写入导出文件。',
          statusText: '导出失败',
          statusTone: 'danger',
          actionType: 'export'
        })
        this.refreshCenter()
        wx.showToast({ title: '导出失败', icon: 'none' })
      })
  },

  onTaskTap(event) {
    const task = productStore.getProductTask(event.currentTarget.dataset.id)
    if (!task || !task.filePath) return

    wx.openDocument({
      filePath: task.filePath,
      showMenu: true,
      fail: () => {
        wx.setClipboardData({
          data: task.filePath,
          success: () => {
            wx.showToast({ title: '文件路径已复制', icon: 'none' })
          }
        })
      }
    })
  }
})
