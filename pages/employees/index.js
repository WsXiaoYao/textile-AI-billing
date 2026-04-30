const employeeStore = require('../../services/employee-store')

const statusTabs = [
  { label: '全部', value: 'all' },
  { label: '启用', value: 'enabled' },
  { label: '禁用', value: 'disabled' },
  { label: '按角色', value: 'role' }
]

Page({
  data: {
    keyword: '',
    activeStatus: 'all',
    statusTabs,
    roleFilterId: '',
    roleFilterName: '',
    employees: [],
    displayedEmployees: []
  },

  onLoad() {
    this.loadEmployees()
  },

  onShow() {
    this.loadEmployees()
  },

  onPullDownRefresh() {
    this.loadEmployees(() => {
      wx.stopPullDownRefresh()
    })
  },

  loadEmployees(callback) {
    this.employees = employeeStore.getEmployeeList()
    this.applyFilters(callback)
  },

  onKeywordInput(event) {
    this.setData({ keyword: event.detail.value }, () => {
      this.applyFilters()
    })
  },

  onKeywordConfirm() {
    this.applyFilters()
  },

  onStatusTap(event) {
    const value = event.currentTarget.dataset.value || 'all'
    if (value === 'role') {
      this.openRoleFilter()
      return
    }

    this.setData({
      activeStatus: value,
      roleFilterId: '',
      roleFilterName: ''
    }, () => {
      this.applyFilters()
    })
  },

  openRoleFilter() {
    const roles = employeeStore.getRoleList()
    wx.showActionSheet({
      itemList: ['全部角色'].concat(roles.map(role => role.name)),
      success: res => {
        if (res.tapIndex === 0) {
          this.setData({
            activeStatus: 'all',
            roleFilterId: '',
            roleFilterName: ''
          }, () => {
            this.applyFilters()
          })
          return
        }

        const role = roles[res.tapIndex - 1]
        this.setData({
          activeStatus: 'role',
          roleFilterId: role.id,
          roleFilterName: role.name
        }, () => {
          this.applyFilters()
        })
      }
    })
  },

  onOpenEmployee(event) {
    wx.navigateTo({
      url: `/pages/employee-edit/index?id=${encodeURIComponent(event.currentTarget.dataset.id)}`
    })
  },

  onAddEmployeeTap() {
    wx.navigateTo({ url: '/pages/employee-edit/index' })
  },

  onBackTap() {
    if (getCurrentPages().length > 1) {
      wx.navigateBack()
      return
    }
    wx.switchTab({ url: '/pages/profile/index' })
  },

  applyFilters(callback) {
    const keyword = this.data.keyword.trim().toLowerCase()
    const activeStatus = this.data.activeStatus
    const roleFilterId = this.data.roleFilterId
    const displayedEmployees = (this.employees || []).filter(employee => {
      if (keyword && !employee.searchText.includes(keyword)) return false
      if (activeStatus === 'enabled') return employee.statusKey === 'enabled'
      if (activeStatus === 'disabled') return employee.statusKey === 'disabled'
      if (activeStatus === 'role' && roleFilterId) return employee.roleId === roleFilterId
      return true
    })

    this.setData({ displayedEmployees }, callback)
  }
})
