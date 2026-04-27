Component({
  options: {
    styleIsolation: 'apply-shared'
  },

  properties: {
    items: {
      type: Array,
      value: []
    },
    total: {
      type: String,
      value: ''
    }
  },

  methods: {
    onOpen() {
      this.triggerEvent('open')
    }
  }
})
