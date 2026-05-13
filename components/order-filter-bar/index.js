Component({
  properties: {
    keyword: {
      type: String,
      value: ''
    },
    searchPlaceholder: {
      type: String,
      value: '搜索客户、单号、制单人'
    },
    statusTabs: {
      type: Array,
      value: []
    },
    activeStatus: {
      type: String,
      value: 'all'
    },
    dateLabel: {
      type: String,
      value: '全部日期'
    },
    dateTitle: {
      type: String,
      value: '销售日期'
    },
    dateVisible: {
      type: Boolean,
      value: true
    },
    sortLabel: {
      type: String,
      value: '排序'
    },
    sortOptions: {
      type: Array,
      value: []
    },
    sortIndex: {
      type: Number,
      value: 0
    },
    filterLabel: {
      type: String,
      value: '筛选'
    },
    filterVisible: {
      type: Boolean,
      value: true
    },
    filterCount: {
      type: Number,
      value: 0
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

    onStatusTap(event) {
      this.triggerEvent('statuschange', {
        value: event.currentTarget.dataset.value
      })
    },

    onDateTap() {
      this.triggerEvent('datetap')
    },

    onSortPickerChange(event) {
      this.triggerEvent('sortchange', {
        index: Number(event.detail.value)
      })
    },

    onFilterTap() {
      this.triggerEvent('filtertap')
    }
  }
})
