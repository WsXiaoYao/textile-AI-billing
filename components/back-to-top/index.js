Component({
  properties: {
    show: {
      type: Boolean,
      value: false
    },
    bottom: {
      type: String,
      value: '144rpx'
    }
  },

  methods: {
    onTap() {
      this.triggerEvent('backtop')
    }
  }
})
