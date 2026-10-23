const { getHeaderSafeHeight } = require('../../utils/layout');
const { exportReceiptImage, isAlbumPermissionError } = require('../../utils/receipt-export');
const receiptStore = require('../../utils/receipt-store');

function getReceiptLayout(receipt) {
  let windowHeight = 667;
  try {
    const windowInfo = typeof wx.getWindowInfo === 'function'
      ? wx.getWindowInfo()
      : wx.getSystemInfoSync();
    if (windowInfo && windowInfo.windowHeight > 0) windowHeight = windowInfo.windowHeight;
  } catch (error) {
    // Use a conservative viewport until the device reports its window size.
  }
  const itemCount = receipt
    ? (receipt.plates || []).length + (receipt.customItems || []).length
    : 0;
  const extraRows = receipt
    ? Number(Number(receipt.customAmount) > 0) + Number(!!receipt.useDiscount) + Number(!!receipt.useServiceFee)
    : 0;
  return {
    receiptViewportHeight: windowHeight,
    receiptDialogHeight: Math.max(240, Math.min(windowHeight - 48, Math.floor(windowHeight * 0.78), 380 + itemCount * 30 + extraRows * 22))
  };
}

Page({
  data: {
    headerSafeHeight: 76,
    history: [],
    visibleHistory: [],
    monthSpent: '0',
    monthCount: 0,
    monthPlates: 0,
    showAll: false,
    managing: false,
    selectedReceipt: null,
    receiptVisible: false,
    receiptViewportHeight: 667,
    receiptDialogHeight: 380,
    selectedDate: '',
    selectedTime: '',
    exportingReceipt: false
  },

  onLoad() {
    this.setData({ headerSafeHeight: getHeaderSafeHeight(), ...getReceiptLayout() });
    this.loadHistory();
  },

  onShow() {
    if (this.getTabBar()) this.getTabBar().setData({ current: 'history' });
    this.loadHistory();
  },

  onResize() {
    this.setData(getReceiptLayout(this.data.selectedReceipt));
  },

  onUnload() {
    if (this.receiptFadeTimer) clearTimeout(this.receiptFadeTimer);
  },

  loadHistory() {
    try {
      const rawHistory = receiptStore.readHistory();
      const history = rawHistory.map((item, index) => {
        const dateParts = String(item.date || '').split('-');
        const displayDate = dateParts.length === 3
          ? `${Number(dateParts[1])}月${Number(dateParts[2])}日`
          : (item.date || '未记录日期');
        const plateCount = (item.plates || []).reduce((sum, plate) => sum + Number(plate.count || 0), 0);
        return {
          ...item,
          storageIndex: index,
          displayDate,
          displayTime: String(item.time || '').slice(0, 5),
          plateCount,
          peopleLabel: Number(item.peopleCount || 0) > 0 ? `${item.peopleCount} 人` : '未填写人数'
        };
      });

      const now = new Date();
      const prefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const monthHistory = history.filter(item => String(item.date || '').startsWith(prefix));
      const monthSpent = monthHistory.reduce((sum, item) => sum + Number(item.totalAmount || 0), 0);
      const monthPlates = monthHistory.reduce((sum, item) => sum + item.plateCount, 0);

      this.setData({
        history,
        visibleHistory: this.data.showAll ? history : history.slice(0, 3),
        monthSpent: this.formatAmount(monthSpent),
        monthCount: monthHistory.length,
        monthPlates
      });
    } catch (error) {
      console.error('加载历史记录失败:', error);
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  formatAmount(value) {
    return Number(value || 0).toFixed(2).replace(/\.00$/, '');
  },

  onManage() {
    this.setData({ managing: !this.data.managing });
  },

  onToggleAll() {
    const showAll = !this.data.showAll;
    this.setData({
      showAll,
      visibleHistory: showAll ? this.data.history : this.data.history.slice(0, 3)
    });
  },

  onViewDetail(e) {
    if (this.data.managing) return;
    const id = e.currentTarget.dataset.id;
    const selectedReceipt = this.data.history.find(item => item.id === id);
    if (!selectedReceipt) return;
    const dateParts = String(selectedReceipt.date || '').split('-');
    const selectedDate = dateParts.length === 3
      ? `${dateParts[0]}年${Number(dateParts[1])}月${Number(dateParts[2])}日`
      : selectedReceipt.date;
    if (this.receiptFadeTimer) clearTimeout(this.receiptFadeTimer);
    this.setData({
      selectedReceipt,
      selectedDate,
      selectedTime: String(selectedReceipt.time || '').slice(0, 5),
      ...getReceiptLayout(selectedReceipt),
      receiptVisible: false
    }, () => {
      this.receiptFadeTimer = setTimeout(() => {
        this.receiptFadeTimer = null;
        if (this.data.selectedReceipt) this.setData({ receiptVisible: true });
      }, 50);
    });
  },

  onCloseReceipt() {
    if (this.receiptFadeTimer) clearTimeout(this.receiptFadeTimer);
    this.receiptFadeTimer = null;
    this.setData({ selectedReceipt: null, receiptVisible: false });
  },

  onStopPropagation() {},

  onDeleteReceipt() {
    const receipt = this.data.selectedReceipt;
    if (!receipt) return;
    wx.showModal({
      title: '删除消费记录',
      content: '删除后无法恢复，确定继续吗？',
      confirmText: '删除',
      confirmColor: '#D71920',
      success: (res) => {
        if (!res.confirm) return;
        receiptStore.deleteReceipt(receipt.id);
        this.onCloseReceipt();
        this.loadHistory();
        wx.showToast({ title: '已删除', icon: 'success' });
      }
    });
  },

  async onExportReceipt() {
    const { selectedReceipt: receipt, selectedDate, selectedTime, exportingReceipt } = this.data;
    if (exportingReceipt) return;
    if (!receipt) return;
    this.setData({ exportingReceipt: true });
    wx.showLoading({ title: '正在生成小票' });
    try {
      await exportReceiptImage(this, '#receiptExportCanvas', receipt, selectedDate, selectedTime);
      wx.hideLoading();
      wx.showToast({ title: '小票图片已保存', icon: 'success' });
    } catch (error) {
      wx.hideLoading();
      console.error('导出小票图片失败:', error);
      if (isAlbumPermissionError(error)) {
        wx.showModal({
          title: '需要相册权限',
          content: '请允许保存图片到相册，然后再次导出小票。',
          confirmText: '前往设置',
          success: result => {
            if (result.confirm) wx.openSetting();
          }
        });
      } else {
        wx.showToast({ title: '生成失败，请重试', icon: 'none' });
      }
    } finally {
      this.setData({ exportingReceipt: false });
    }
  },

  onDeleteItem(e) {
    const id = e.currentTarget.dataset.id;
    const item = this.data.history.find(record => record.id === id);
    if (!item) return;

    wx.showModal({
      title: '删除消费记录',
      content: `确定删除 ${item.displayDate} 的记录吗？`,
      confirmText: '删除',
      confirmColor: '#D71920',
      success: (res) => {
        if (!res.confirm) return;
        receiptStore.deleteReceipt(id);
        wx.showToast({ title: '已删除', icon: 'success' });
        this.loadHistory();
      }
    });
  },

  onClearAll() {
    if (!this.data.history.length) return;
    wx.showModal({
      title: '清空全部记录',
      content: '此操作无法撤销，确定继续吗？',
      confirmText: '清空',
      confirmColor: '#D71920',
      success: (res) => {
        if (!res.confirm) return;
        receiptStore.clearReceipts();
        this.setData({ showAll: false, managing: false });
        this.loadHistory();
      }
    });
  }
});
