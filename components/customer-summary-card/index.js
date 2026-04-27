Component({
  options: {
    styleIsolation: 'apply-shared'
  },

  properties: {
    customer: {
      type: Object,
      value: {}
    }
  },

  methods: {
    onReceivableTap() {
      this.triggerEvent('receivabletap')
    }
  }
})
