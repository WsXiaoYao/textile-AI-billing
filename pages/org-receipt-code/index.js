const profileStore = require('../../services/profile-store')
const profileApi = require('../../api/profile-api')
const validator = require('../../utils/form-validation')

Page({
  data: {
    settings: profileStore.getReceiptSettings(),
    note: '',
    loading: false,
    uploading: false
  },

  onLoad() {
    this.loadSettings()
  },

  onShow() {
    this.loadSettings()
  },

  async loadSettings() {
    this.setData({ loading: true })
    try {
      const settings = await profileApi.getReceiptSettings()
      this.setData({
        settings,
        note: settings.note || settings.qrcodeRemark || ''
      })
    } catch (error) {
      const settings = profileStore.getReceiptSettings()
      this.setData({
        settings,
        note: settings.note
      })
      wx.showToast({
        title: error.message || '收款码设置加载失败',
        icon: 'none'
      })
    } finally {
      this.setData({ loading: false })
    }
  },

  onNoteInput(event) {
    this.setData({
      note: event.detail.value.slice(0, 500)
    })
  },

  onUploadTap() {
    const onSuccess = filePath => this.uploadReceiptImage(filePath)

    if (wx.chooseMedia) {
      wx.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sourceType: ['album', 'camera'],
        success: res => {
          const file = (res.tempFiles || [])[0]
          if (file && file.tempFilePath) onSuccess(file.tempFilePath)
        }
      })
      return
    }

    wx.chooseImage({
      count: 1,
      sourceType: ['album', 'camera'],
      success: res => {
        const filePath = (res.tempFilePaths || [])[0]
        if (filePath) onSuccess(filePath)
      }
    })
  },

  readImageBase64(filePath) {
    return new Promise((resolve, reject) => {
      wx.getFileSystemManager().readFile({
        filePath,
        encoding: 'base64',
        success: res => resolve(res.data),
        fail: reject
      })
    })
  },

  compressImage(filePath) {
    return new Promise(resolve => {
      if (!wx.compressImage) {
        resolve(filePath)
        return
      }

      wx.compressImage({
        src: filePath,
        quality: 60,
        compressedWidth: 800,
        compressedHeight: 800,
        success: res => resolve(res.tempFilePath || filePath),
        fail: () => resolve(filePath)
      })
    })
  },

  async uploadReceiptImage(filePath) {
    if (!filePath || this.data.uploading) return
    this.setData({ uploading: true })
    try {
      const compressedPath = await this.compressImage(filePath)
      const base64 = await this.readImageBase64(compressedPath)
      if (base64.length > 6 * 1024 * 1024) {
        wx.showToast({
          title: '图片过大，请裁剪后再上传',
          icon: 'none'
        })
        return
      }
      const extMatch = String(compressedPath).match(/\.([a-z0-9]+)(?:\?|$)/i)
      const ext = extMatch ? extMatch[1] : 'png'
      const result = await profileApi.uploadReceiptCodeImage({
        imageBase64: base64,
        ext
      })
      this.setData({
        settings: {
          ...this.data.settings,
          ...result,
          imagePath: result.imageUrl || result.imagePath || ''
        }
      })
      wx.showToast({ title: '图片已上传', icon: 'success' })
    } catch (error) {
      wx.showToast({
        title: error.message || '图片上传失败',
        icon: 'none'
      })
    } finally {
      this.setData({ uploading: false })
    }
  },

  onCancelTap() {
    if (getCurrentPages().length > 1) {
      wx.navigateBack()
      return
    }
    wx.switchTab({ url: '/pages/profile/index' })
  },

  async onSaveTap() {
    if (this.data.loading) return
    const note = validator.trimText(this.data.note)
    const errors = []
    validator.maxLength(errors, '收款码备注', note, 500)
    if (validator.showFirstError(errors)) return

    this.setData({ loading: true })
    try {
      await profileApi.saveReceiptSettings({
        imagePath: this.data.settings.imagePath || this.data.settings.paymentQrcodeUrl || '',
        note
      })
      wx.showToast({
        title: '收款码已保存',
        icon: 'success'
      })
      setTimeout(() => {
        this.onCancelTap()
      }, 500)
    } catch (error) {
      wx.showToast({
        title: error.message || '收款码保存失败',
        icon: 'none'
      })
    } finally {
      this.setData({ loading: false })
    }
  }
})
