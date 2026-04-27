Page({
  data: {
    currentCustomer: {
      name: '黔西-龙凤',
      code: 'TC-001',
      tag: '贵州客户',
      contractAmount: '¥472.50',
      receivable: '¥0'
    },
    customers: ['黔西-龙凤', '赫章杨兰物流', '徐加飞'],
    activeCustomer: 0,
    inputText: '给客户黔西-龙凤开个单子，要25码寸布米色20米、25码寸布深灰15米、280祥云H513-米10米',
    cartItems: [
      {
        id: 'cloth-rice',
        name: '25码寸布',
        spec: '25码-米色',
        quantity: '20米',
        amount: '¥30',
        isLast: false
      },
      {
        id: 'cloth-gray',
        name: '25码寸布',
        spec: '25码-深灰',
        quantity: '15米',
        amount: '¥22.50',
        isLast: false
      },
      {
        id: 'xiangyun',
        name: '280祥云',
        spec: 'H513-米',
        quantity: '10米',
        amount: '¥420',
        isLast: true
      }
    ],
    totalAmount: '¥472.50'
  },
})
