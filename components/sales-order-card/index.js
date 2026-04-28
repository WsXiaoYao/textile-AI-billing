Component({
  properties: {
    order: {
      type: Object,
      value: {}
    }
  },

  methods: {
    onOpen() {
      this.triggerEvent('open', {
        id: this.properties.order.id
      })
    }
  }
})
