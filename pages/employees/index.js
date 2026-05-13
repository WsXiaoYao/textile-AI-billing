const employeeApi = require('../../api/employee-api')

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
    roles: [],
    employees: [],
    displayedEmployees: [],
    scrollTop: 0,
    showBackTop: false,
    loading: false
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

  onListScroll(event) {
    const showBackTop = Number(event.detail.scrollTop || 0) > 700
    if (showBackTop !== this.data.showBackTop) this.setData({ showBackTop })
  },

  onBackTopTap() {
    this.setData({
      scrollTop: this.data.scrollTop === 0 ? 1 : 0,
      showBackTop: false
    })
  },

  async loadEmployees(callback) {
    this.setData({ loading: true })
    try {
      const [roles, result] = await Promise.all([
        employeeApi.getRoleList(),
        employeeApi.listEmployees()
      ])
      this.employees = Array.isArray(result && result.list) ? result.list : []
      this.setData({
        roles: Array.isArray(roles) ? roles : []
      }, () => {
        this.applyFilters(callback)
      })
    } catch (error) {
      wx.showToast({
        title: error.message || '员工加载失败',
        icon: 'none'
      })
      if (callback) callback()
    } finally {
      this.setData({ loading: false })
    }
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
    const roles = this.data.roles || []
    if (!roles.length) {
      wx.showToast({ title: '暂无角色可筛选', icon: 'none' })
      return
    }
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
      const searchText = String(employee.searchText || '').toLowerCase()
      if (keyword && !searchText.includes(keyword)) return false
      if (activeStatus === 'enabled') return employee.statusKey === 'enabled'
      if (activeStatus === 'disabled') return employee.statusKey === 'disabled'
      if (activeStatus === 'role' && roleFilterId) {
        const roleIds = Array.isArray(employee.roleIds) ? employee.roleIds : [employee.roleId].filter(Boolean)
        return roleIds.includes(roleFilterId)
      }
      return true
    })

    this.setData({ displayedEmployees }, callback)
  }
})
