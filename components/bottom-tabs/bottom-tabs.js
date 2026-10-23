Component({
  properties: {
    current: {
      type: String,
      value: 'calculator'
    }
  },

  methods: {
    onSelect(e) {
      const key = e.currentTarget.dataset.key;
      if (!key || key === this.data.current) return;

      const routes = {
        calculator: '/pages/index/index',
        history: '/pages/history/history',
        analytics: '/pages/analytics/analytics'
      };

      wx.switchTab({ url: routes[key] });
    }
  }
});
