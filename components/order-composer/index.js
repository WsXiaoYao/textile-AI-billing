Component({
  options: {
    styleIsolation: 'apply-shared'
  },

  properties: {
    value: {
      type: String,
      value: ''
    }
  },

  methods: {
    onInput(event) {
      this.triggerEvent('inputchange', {
        value: event.detail.value
      })
    },

    onRecognize() {
      this.triggerEvent('recognize')
    }
  }
})
