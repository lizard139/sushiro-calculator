// 数据分析页面逻辑
const { getHeaderSafeHeight } = require('../../utils/layout');
const receiptStore = require('../../utils/receipt-store');

Page({
  data: {
    headerSafeHeight: 76,
    contentHeight: 520,
    timeRange: 'month', // week, month, year
    summaryTitle: '本月消费',
    summaryAmount: '0',
    visitCount: 0,
    avgSpent: '0',
    trendData: [],
    yAxisLabels: [],
    plateData: [],
    totalPlates: 0,
    topRecords: []
  },

  onLoad() {
    this.updateLayout();
    this.loadAnalytics();
  },

  onResize(event) {
    this.updateLayout(event && event.size);
  },

  onShow() {
    if (this.getTabBar()) this.getTabBar().setData({ current: 'analytics' });
    this.loadAnalytics();
  },

  updateLayout(size) {
    const headerSafeHeight = getHeaderSafeHeight();
    let windowInfo = size;
    if (!windowInfo) {
      try {
        windowInfo = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
      } catch (error) {
        windowInfo = { windowWidth: 375, windowHeight: 667 };
      }
    }
    const windowWidth = Number(windowInfo.windowWidth || 375);
    const windowHeight = Number(windowInfo.windowHeight || 667);
    const pageHeaderHeight = 112 * windowWidth / 750;
    const contentHeight = Math.max(120, Math.floor(windowHeight - headerSafeHeight - pageHeaderHeight));
    this.setData({ headerSafeHeight, contentHeight });
  },

  // 切换时间范围
  onChangeTimeRange(e) {
    const range = e.currentTarget.dataset.range;
    this.setData({ timeRange: range }, () => {
      this.loadAnalytics();
    });
  },

  // 加载所有分析数据
  loadAnalytics() {
    this.loadSummary();
    this.loadTrendData();
    this.loadPlateData();
    this.loadTopRecords();
  },

  loadSummary() {
    const history = receiptStore.readHistory();
    const scoped = this.getRangeHistory(history, this.data.timeRange);
    const amount = scoped.reduce((sum, item) => sum + Number(item.totalAmount || 0), 0);
    const avg = scoped.length ? amount / scoped.length : 0;
    const titles = {
      week: '本周消费',
      month: '本月消费',
      year: '本年消费'
    };
    this.setData({
      summaryTitle: titles[this.data.timeRange],
      summaryAmount: amount.toFixed(2).replace(/\.00$/, ''),
      visitCount: scoped.length,
      avgSpent: avg.toFixed(1).replace(/\.0$/, '')
    });
  },

  getRangeHistory(history, range) {
    const now = new Date();
    return history.filter(item => {
      const date = new Date(item.date);
      if (Number.isNaN(date.getTime())) return false;
      if (range === 'week') {
        const start = new Date(now);
        start.setHours(0, 0, 0, 0);
        start.setDate(start.getDate() - 6);
        return date >= start && date <= now;
      }
      if (range === 'year') {
        return date.getFullYear() === now.getFullYear();
      }
      return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
    });
  },

  // 加载消费趋势数据
  loadTrendData() {
    try {
      const history = receiptStore.readHistory();
      const { timeRange } = this.data;
      
      let trendData = [];
      let maxAmount = 0;

      if (timeRange === 'week') {
        // 最近7天
        trendData = this.getLast7DaysData(history);
      } else if (timeRange === 'month') {
        // 最近30天，按周统计
        trendData = this.getLast4WeeksData(history);
      } else if (timeRange === 'year') {
        // 最近12个月
        trendData = this.getLast12MonthsData(history);
      }

      // 计算最大值和百分比
      maxAmount = Math.max(...trendData.map(d => d.amount), 0);
      if (maxAmount === 0) maxAmount = 100; // 避免除以0

      trendData = trendData.map(d => ({
        ...d,
        percentage: (d.amount / maxAmount) * 100
      }));

      // 生成Y轴标签
      const yAxisLabels = this.generateYAxisLabels(maxAmount);

      this.setData({
        trendData,
        yAxisLabels
      });
    } catch (error) {
      console.error('加载趋势数据失败:', error);
    }
  },

  // 获取最近7天数据
  getLast7DaysData(history) {
    const data = [];
    const today = new Date();
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = this.formatDate(date);
      
      const dayData = history.filter(item => item.date === dateStr);
      const amount = dayData.reduce((sum, item) => sum + parseFloat(item.totalAmount || 0), 0);
      
      data.push({
        date: dateStr,
        label: i === 0 ? '今天' : `${date.getMonth() + 1}/${date.getDate()}`,
        amount: parseFloat(amount.toFixed(2)),
        percentage: 0
      });
    }
    
    return data;
  },

  // 获取最近4周数据
  getLast4WeeksData(history) {
    const data = [];
    const today = new Date();
    
    for (let i = 3; i >= 0; i--) {
      const weekStart = new Date(today);
      weekStart.setDate(weekStart.getDate() - (i + 1) * 7);
      const weekEnd = new Date(today);
      weekEnd.setDate(weekEnd.getDate() - i * 7);
      
      const weekData = history.filter(item => {
        const itemDate = new Date(item.date);
        return itemDate >= weekStart && itemDate < weekEnd;
      });
      
      const amount = weekData.reduce((sum, item) => sum + parseFloat(item.totalAmount || 0), 0);
      
      data.push({
        date: `${weekStart.getMonth() + 1}月${weekStart.getDate()}日`,
        label: i === 0 ? '本周' : `第${4-i}周`,
        amount: parseFloat(amount.toFixed(2)),
        percentage: 0
      });
    }
    
    return data;
  },

  // 获取最近12个月数据
  getLast12MonthsData(history) {
    const data = [];
    const today = new Date();
    
    for (let i = 11; i >= 0; i--) {
      const month = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const monthStr = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;
      
      const monthData = history.filter(item => item.date && item.date.startsWith(monthStr));
      const amount = monthData.reduce((sum, item) => sum + parseFloat(item.totalAmount || 0), 0);
      
      data.push({
        date: monthStr,
        label: i === 0 ? '本月' : `${month.getMonth() + 1}月`,
        amount: parseFloat(amount.toFixed(2)),
        percentage: 0
      });
    }
    
    return data;
  },

  // 生成Y轴标签
  generateYAxisLabels(maxAmount) {
    const step = Math.ceil(maxAmount / 4 / 10) * 10; // 向上取整到10的倍数
    return [
      step * 4,
      step * 3,
      step * 2,
      step,
      0
    ];
  },

  // 加载碟子数据
  loadPlateData() {
    try {
      const allHistory = receiptStore.readHistory();
      const history = this.getRangeHistory(allHistory, this.data.timeRange);
      
      // 统计每种碟子的数量
      const plateStats = {};
      let totalPlates = 0;
      
      history.forEach(record => {
        if (record.plates && Array.isArray(record.plates)) {
          record.plates.forEach(plate => {
            if (!plateStats[plate.label]) {
              plateStats[plate.label] = {
                label: plate.label,
                color: plate.color,
                count: 0
              };
            }
            plateStats[plate.label].count += plate.count;
            totalPlates += plate.count;
          });
        }
      });

      // 转换为数组并计算百分比
      let plateData = Object.values(plateStats);
      
      if (totalPlates > 0) {
        let currentAngle = 0;
        plateData = plateData.map(plate => {
          const percentage = ((plate.count / totalPlates) * 100).toFixed(1);
          const angle = (plate.count / totalPlates) * 360;
          const result = {
            ...plate,
            percentage,
            startAngle: currentAngle,
            endAngle: currentAngle + angle
          };
          currentAngle += angle;
          return result;
        });

        // 按数量排序
        plateData.sort((a, b) => b.count - a.count);
      }

      this.setData({
        plateData,
        totalPlates
      });
    } catch (error) {
      console.error('加载碟子数据失败:', error);
    }
  },

  // 近期消费记录，用于分析页的明细区
  loadTopRecords() {
    try {
      const history = receiptStore.readHistory();
      const topRecords = history
        .slice()
        .sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0))
        .slice(0, 3)
        .map(record => {
          const dateParts = String(record.date || '').split('-');
          return {
            ...record,
            displayDate: dateParts.length === 3
              ? `${Number(dateParts[1])}月${Number(dateParts[2])}日`
              : (record.date || '未记录日期'),
            plateCount: (record.plates || []).reduce((sum, plate) => sum + Number(plate.count || 0), 0),
            peopleLabel: Number(record.peopleCount || 0) > 0 ? `${record.peopleCount} 人` : '未填写人数'
          };
        });

      this.setData({
        topRecords
      });
    } catch (error) {
      console.error('加载排行数据失败:', error);
    }
  },

  // 格式化日期
  formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
});

