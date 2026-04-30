const employeeStore = require('../../services/employee-store')

Page({
  data: {
    selectedRoleId: '',
    roles: []
  },

  onLoad(options = {}) {
    const selectedRoleId = decodeURIComponent(options.roleId || '')
    this.setData({
      selectedRoleId,
      roles: employeeStore.getRoleList(selectedRoleId)
    })
  },

  onRoleTap(event) {
    const selectedRoleId = event.currentTarget.dataset.id
    this.setData({
      selectedRoleId,
      roles: employeeStore.getRoleList(selectedRoleId)
    })
  }
})
