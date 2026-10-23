const routes = {
  calculator: '/pages/index/index',
  history: '/pages/history/history',
  analytics: '/pages/analytics/analytics'
};

Component({
  data: { current: 'calculator' },
  lifetimes: {
    attached() {
      this.syncCurrent();
    }
  },
  pageLifetimes: {
    show() {
      this.syncCurrent();
    }
  },
  methods: {
    syncCurrent() {
      const pages = getCurrentPages();
      const route = pages.length ? `/${pages[pages.length - 1].route}` : '';
      const current = Object.keys(routes).find(key => routes[key] === route);
      if (current && current !== this.data.current) this.setData({ current });
    },

    onSelect(e) {
      const key = e.currentTarget.dataset.key;
      const url = routes[key];
      if (!url || key === this.data.current) return;
      const previous = this.data.current;
      this.setData({ current: key });
      wx.switchTab({
        url,
        fail: error => {
          console.error('底部导航切换失败:', error);
          this.setData({ current: previous });
          wx.showToast({ title: '页面切换失败，请重试', icon: 'none' });
        }
      });
    }
  }
});
