Component({
  properties: {
    tabs: {
      type: Array,
      value: []
    },
    activeStatus: {
      type: String,
      value: 'pending'
    },
    keyword: {
      type: String,
      value: ''
    }
  },

  methods: {
    onKeywordInput(event) {
      this.triggerEvent('keywordinput', {
        value: event.detail.value
      })
    },

    onKeywordConfirm(event) {
      this.triggerEvent('keywordconfirm', {
        value: event.detail.value
      })
    },

    onFilterTap() {
      this.triggerEvent('filtertap')
    },

    onTabTap(event) {
      const value = event.currentTarget.dataset.value
      this.triggerEvent('statuschange', { value })
    }
  }
})
