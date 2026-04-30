const profileStore = require('../../services/profile-store')

Page({
  data: {
    settings: profileStore.getReceiptSettings(),
    note: ''
  },

  onLoad() {
    this.loadSettings()
  },

  onShow() {
    this.loadSettings()
  },

  loadSettings() {
    const settings = profileStore.getReceiptSettings()
    this.setData({
      settings,
      note: settings.note
    })
  },

  onNoteInput(event) {
    this.setData({
      note: event.detail.value
    })
  },

  onUploadTap() {
    const onSuccess = filePath => {
      this.setData({
        settings: {
          ...this.data.settings,
          imagePath: filePath
        }
      })
    }

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

  onCancelTap() {
    if (getCurrentPages().length > 1) {
      wx.navigateBack()
      return
    }
    wx.switchTab({ url: '/pages/profile/index' })
  },

  onSaveTap() {
    profileStore.saveReceiptSettings({
      imagePath: this.data.settings.imagePath,
      note: this.data.note
    })
    wx.showToast({
      title: '收款码已保存',
      icon: 'success'
    })
    setTimeout(() => {
      this.onCancelTap()
    }, 500)
  }
})
