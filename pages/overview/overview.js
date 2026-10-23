// 吃郎概览页面逻辑
const receiptStore = require('../../utils/receipt-store');

Page({
  data: {
    totalRecords: 0,
    totalSpent: '0',
    avgSpent: '0'
  },

  onLoad() {
    this.loadStats();
  },

  onShow() {
    // 每次显示页面时刷新统计数据
    this.loadStats();
  },

  // 加载统计数据
  loadStats() {
    try {
      const history = receiptStore.readHistory();
      
      const totalRecords = history.length;
      
      const totalSpent = history.reduce((sum, item) => {
        return sum + (parseFloat(item.totalAmount) || 0);
      }, 0);

      const avgSpent = totalRecords > 0 ? totalSpent / totalRecords : 0;

      this.setData({
        totalRecords,
        totalSpent: totalSpent.toFixed(2).replace(/\.00$/, ''),
        avgSpent: avgSpent.toFixed(2).replace(/\.00$/, '')
      });
    } catch (error) {
      console.error('加载统计数据失败:', error);
    }
  },

  // 跳转到小票列表
  onGoToTickets() {
    wx.navigateTo({
      url: '/pages/history/history'
    });
  },

  // 跳转到数据分析
  onGoToAnalytics() {
    wx.navigateTo({
      url: '/pages/analytics/analytics'
    });
  }
});

