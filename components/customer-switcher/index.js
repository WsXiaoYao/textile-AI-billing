Component({
  options: {
    styleIsolation: 'apply-shared'
  },

  properties: {
    customers: {
      type: Array,
      value: []
    },
    activeIndex: {
      type: Number,
      value: 0
    }
  },

  methods: {
    onSelect(event) {
      this.triggerEvent('select', {
        index: Number(event.currentTarget.dataset.index)
      })
    },

    onMore() {
      this.triggerEvent('more')
    }
  }
})
