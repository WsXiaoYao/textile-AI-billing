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
    },

    onActionTap(event) {
      this.triggerEvent('action', {
        id: this.properties.order.id,
        action: event.currentTarget.dataset.action
      })
    }
  }
})
