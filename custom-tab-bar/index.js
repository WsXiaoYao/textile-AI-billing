const { getVisibleTabs } = require('../utils/tabbar')

Component({
  data: {
    activePath: '',
    tabs: []
  },

  lifetimes: {
    attached() {
      this.refresh()
    }
  },

  methods: {
    refresh(activePath = '') {
      const normalizedPath = activePath || this.getCurrentPath()
      this.setData({
        activePath: normalizedPath,
        tabs: getVisibleTabs().map(tab => ({
          ...tab,
          active: tab.pagePath === normalizedPath
        }))
      })
    },

    getCurrentPath() {
      const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : []
      const current = pages[pages.length - 1]
      return current && current.route ? `/${current.route}` : ''
    },

    onTabTap(event) {
      const url = event.currentTarget.dataset.url
      if (!url || url === this.data.activePath) return
      wx.switchTab({ url })
    }
  }
})
