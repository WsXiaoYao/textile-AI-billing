const employeeApi = require('../../api/employee-api')

Page({
  data: {
    selectedRoleId: '',
    selectedRoleIds: [],
    roles: []
  },

  onLoad(options = {}) {
    const selectedRoleId = decodeURIComponent(options.roleId || '')
    const selectedRoleIds = decodeURIComponent(options.roleIds || selectedRoleId || '').split(',').filter(Boolean)
    this.loadRoles(selectedRoleIds)
  },

  async loadRoles(selectedRoleIds) {
    try {
      const roles = await employeeApi.getRoleList({ selectedRoleIds: selectedRoleIds.join(',') })
      this.setData({
        selectedRoleId: selectedRoleIds[0] || '',
        selectedRoleIds,
        roles: Array.isArray(roles) ? roles : []
      })
    } catch (error) {
      wx.showToast({
        title: error.message || '角色加载失败',
        icon: 'none'
      })
    }
  },

  setSelectedRole(selectedRoleId) {
    const current = this.data.selectedRoleIds || []
    const selectedRoleIds = current.includes(selectedRoleId)
      ? current.filter(id => id !== selectedRoleId)
      : current.concat(selectedRoleId)
    this.setData({
      selectedRoleId: selectedRoleIds[0] || '',
      selectedRoleIds,
      roles: (this.data.roles || []).map(role => ({
        ...role,
        selected: selectedRoleIds.includes(role.id)
      }))
    })
  },

  onRoleTap(event) {
    const selectedRoleId = event.currentTarget.dataset.id
    this.setSelectedRole(selectedRoleId)
  }
})
