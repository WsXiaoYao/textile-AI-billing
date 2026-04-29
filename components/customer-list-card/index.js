Component({
  properties: {
    customer: {
      type: Object,
      value: {}
    }
  },

  methods: {
    onOpen() {
      this.triggerEvent('open', {
        id: this.properties.customer.id
      })
    },

    onStartOrder() {
      this.triggerEvent('startorder', {
        id: this.properties.customer.id
      })
    },

    onViewOrders() {
      this.triggerEvent('vieworders', {
        id: this.properties.customer.id
      })
    }
  }
})
