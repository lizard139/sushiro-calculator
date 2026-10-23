// 设置页：保存基础配置到本地 storage，供主页面使用（可按需扩展）

const STORAGE_KEY = 'sushiro_settings';

Page({
  data: {
    taxRate: '',
    serviceRate: '',
    defaultPeople: '',
    keepOneDecimal: true
  },

  onLoad() {
    this.loadSettings();
  },

  loadSettings() {
    try {
      const stored = wx.getStorageSync(STORAGE_KEY);
      if (stored) {
        this.setData(stored);
      }
    } catch (e) {
      // ignore
    }
  },

  onFieldChange(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({
      [field]: e.detail.value
    });
  },

  onToggleRound(e) {
    this.setData({
      keepOneDecimal: e.detail.value
    });
  },

  onResetSettings() {
    this.setData({
      taxRate: '',
      serviceRate: '',
      defaultPeople: '',
      keepOneDecimal: true
    });
    try {
      wx.removeStorageSync(STORAGE_KEY);
    } catch (e) {
      // ignore
    }
  },

  onSave() {
    const data = {
      taxRate: this.data.taxRate,
      serviceRate: this.data.serviceRate,
      defaultPeople: this.data.defaultPeople,
      keepOneDecimal: this.data.keepOneDecimal
    };
    try {
      wx.setStorageSync(STORAGE_KEY, data);
      wx.showToast({
        title: '已保存',
        icon: 'success'
      });
    } catch (e) {
      wx.showToast({
        title: '保存失败',
        icon: 'none'
      });
    }
  }
});


