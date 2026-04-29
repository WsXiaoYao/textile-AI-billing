const orderStore = require('../../services/order-store')

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

function chooseCustomerFile() {
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
    center: orderStore.getCustomerImportExport()
  },

  onShow() {
    this.refreshCenter()
  },

  refreshCenter() {
    this.setData({
      center: orderStore.getCustomerImportExport()
    })
  },

  onBackTap() {
    if (getCurrentPages().length > 1) {
      wx.navigateBack()
      return
    }
    wx.switchTab({ url: '/pages/customers/index' })
  },

  onDownloadTemplateTap() {
    writeTextFile('客户导入模板.csv', orderStore.getCustomerTemplateCsv())
      .then(filePath => {
        orderStore.addCustomerImportTask({
          title: '客户导入模板.csv',
          desc: '模板文件已生成，可用 Excel 打开后填写客户资料。',
          statusText: '可打开',
          statusTone: 'success',
          filePath,
          actionType: 'template'
        })
        this.refreshCenter()
        wx.showToast({
          title: '模板已生成',
          icon: 'success'
        })
      })
      .catch(() => {
        orderStore.addCustomerImportTask({
          title: '客户导入模板.csv',
          desc: '当前环境无法写入本地模板文件。',
          statusText: '生成失败',
          statusTone: 'danger',
          actionType: 'template'
        })
        this.refreshCenter()
        wx.showToast({
          title: '模板生成失败',
          icon: 'none'
        })
      })
  },

  onUploadTap() {
    chooseCustomerFile()
      .then(file => {
        if (!file) return
        const extension = getExtension(file.name)
        const allowTypes = ['csv', 'xlsx', 'xls']

        if (!allowTypes.includes(extension)) {
          wx.showToast({
            title: '请选择 Excel 或 CSV',
            icon: 'none'
          })
          return
        }

        orderStore.addCustomerImportTask({
          title: `客户导入：${file.name}`,
          desc: `已选择 ${extension.toUpperCase()} 文件，大小 ${formatFileSize(file.size)}。待接入后端上传接口后，由后端解析并回写客户资料。`,
          statusText: '待上传',
          statusTone: 'warning',
          filePath: file.path || '',
          fileName: file.name || '',
          fileSize: file.size || 0,
          fileType: extension,
          actionType: 'import'
        })
        this.refreshCenter()
        wx.showToast({
          title: '已创建上传任务',
          icon: 'none'
        })
      })
      .catch(error => {
        if (error && /cancel/i.test(error.errMsg || '')) return
        wx.showToast({
          title: '没有选择文件',
          icon: 'none'
        })
      })
  },

  onExportTap(event) {
    const type = event.currentTarget.dataset.type || 'current'
    const titleMap = {
      current: '客户当前筛选导出.csv',
      authorized: '授权客户导出.csv',
      link: '客户下载文件.csv'
    }
    const fileName = titleMap[type] || titleMap.current

    writeTextFile(fileName, orderStore.getCustomerExportCsv(type))
      .then(filePath => {
        orderStore.addCustomerImportTask({
          title: fileName,
          desc: `已根据当前客户数据生成本地 CSV 文件，共 ${orderStore.getCustomerList().length} 位客户。`,
          statusText: '可打开',
          statusTone: 'success',
          filePath,
          actionType: 'export'
        })
        this.refreshCenter()
        wx.showToast({
          title: '导出文件已生成',
          icon: 'success'
        })
      })
      .catch(() => {
        orderStore.addCustomerImportTask({
          title: fileName,
          desc: '当前环境无法写入导出文件。',
          statusText: '导出失败',
          statusTone: 'danger',
          actionType: 'export'
        })
        this.refreshCenter()
        wx.showToast({
          title: '导出失败',
          icon: 'none'
        })
      })
  },

  onTaskTap(event) {
    const task = orderStore.getCustomerImportTask(event.currentTarget.dataset.id)
    if (!task || !task.filePath) return

    wx.openDocument({
      filePath: task.filePath,
      showMenu: true,
      fail: () => {
        wx.setClipboardData({
          data: task.filePath,
          success: () => {
            wx.showToast({
              title: '文件路径已复制',
              icon: 'none'
            })
          }
        })
      }
    })
  },

  onStartImportTap() {
    this.onUploadTap()
  }
})
