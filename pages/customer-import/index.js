const customerApi = require('../../api/customer-api')

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

function readLocalFile(filePath, encoding = 'utf8') {
  return new Promise((resolve, reject) => {
    if (!wx.getFileSystemManager) {
      reject(new Error('当前环境不支持读取本地文件'))
      return
    }
    wx.getFileSystemManager().readFile({
      filePath,
      encoding,
      success: res => resolve(res.data || ''),
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
      extension: ['csv', 'xlsx'],
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
    center: {
      importTitle: '客户批量导入',
      importDesc: '加载真实客户导入配置中',
      exportTitle: '客户批量导出',
      exportDesc: '',
      importHint: '',
      tasks: []
    }
  },

  onShow() {
    this.refreshCenter()
  },

  async refreshCenter() {
    try {
      const center = await customerApi.getImportExportCenter()
      this.setData({
        center: {
          ...center,
          tasks: (this.localTasks || []).concat(center.tasks || [])
        }
      })
    } catch (error) {
      wx.showToast({
        title: error.message || '导入配置加载失败',
        icon: 'none'
      })
    }
  },

  addLocalTask(task) {
    this.localTasks = [
      {
        id: task.id || `task-${Date.now()}`,
        time: task.time || '刚刚',
        ...task
      }
    ].concat(this.localTasks || [])
    this.setData({
      center: {
        ...this.data.center,
        tasks: this.localTasks.concat((this.data.center.tasks || []).filter(item => !this.localTasks.some(taskItem => taskItem.id === item.id)))
      }
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
    customerApi.getTemplate()
      .then(template => writeTextFile(template.fileName || '客户导入模板.csv', template.content || ''))
      .then(filePath => {
        this.addLocalTask({
          id: `template-${Date.now()}`,
          title: '客户导入模板.csv',
          desc: '模板文件已生成，可用 Excel 打开后填写客户资料。',
          statusText: '可打开',
          statusTone: 'success',
          filePath,
          actionType: 'template'
        })
        wx.showToast({
          title: '模板已生成',
          icon: 'success'
        })
      })
      .catch(() => {
        this.addLocalTask({
          id: `template-failed-${Date.now()}`,
          title: '客户导入模板.csv',
          desc: '当前环境无法写入本地模板文件。',
          statusText: '生成失败',
          statusTone: 'danger',
          actionType: 'template'
        })
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
        const allowTypes = ['csv', 'xlsx']

        if (!allowTypes.includes(extension)) {
          wx.showToast({
            title: '请选择 XLSX 或 CSV',
            icon: 'none'
          })
          return
        }
        const contentPromise = readLocalFile(file.path || file.tempFilePath, extension === 'csv' ? 'utf8' : 'base64')
        contentPromise.then(content => customerApi.addImportTask({
          title: `客户导入：${file.name}`,
          desc: `已选择 ${extension.toUpperCase()} 文件，大小 ${formatFileSize(file.size)}。`,
          statusText: '解析中',
          statusTone: 'warning',
          filePath: file.path || '',
          fileName: file.name || '',
          fileSize: file.size || 0,
          fileType: extension,
          content,
          actionType: 'import'
        }))
          .then(task => {
            this.addLocalTask({
              ...task,
              title: task.title || `客户导入：${file.name}`,
              desc: task.desc || `已选择 ${extension.toUpperCase()} 文件，大小 ${formatFileSize(file.size)}。`,
              statusText: task.statusText || '已解析',
              statusTone: task.statusTone || 'warning',
              filePath: file.path || ''
            })
          })
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

    customerApi.exportCustomers({ type })
      .then(result => writeTextFile(result.fileName || fileName, result.content || ''))
      .then(filePath => {
        this.addLocalTask({
          id: `export-${Date.now()}`,
          title: fileName,
          desc: '已根据后端真实客户表生成本地 CSV 文件。',
          statusText: '可打开',
          statusTone: 'success',
          filePath,
          actionType: 'export'
        })
        wx.showToast({
          title: '导出文件已生成',
          icon: 'success'
        })
      })
      .catch(() => {
        this.addLocalTask({
          id: `export-failed-${Date.now()}`,
          title: fileName,
          desc: '当前环境无法写入导出文件。',
          statusText: '导出失败',
          statusTone: 'danger',
          actionType: 'export'
        })
        wx.showToast({
          title: '导出失败',
          icon: 'none'
        })
      })
  },

  async onTaskTap(event) {
    const id = event.currentTarget.dataset.id
    let task = (this.localTasks || []).find(item => item.id === id)
    if (!task) {
      task = await customerApi.getImportTask(id)
    }
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
