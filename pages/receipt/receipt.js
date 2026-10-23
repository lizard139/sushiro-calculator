const { getHeaderSafeHeight } = require('../../utils/layout');
const { exportReceiptImage, isAlbumPermissionError } = require('../../utils/receipt-export');
const receiptStore = require('../../utils/receipt-store');

Page({
  data: {
    headerSafeHeight: 76,
    receipt: null,
    displayDate: '',
    displayTime: '',
    exportingReceipt: false
  },

  onLoad(options) {
    this.setData({ headerSafeHeight: getHeaderSafeHeight() });
    const id = decodeURIComponent(options.id || '');
    const history = receiptStore.readHistory();
    const receipt = history.find(item => item.id === id);
    if (!receipt) {
      wx.showToast({ title: '记录不存在', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 600);
      return;
    }

    const dateParts = String(receipt.date || '').split('-');
    const displayDate = dateParts.length === 3
      ? `${dateParts[0]}年${Number(dateParts[1])}月${Number(dateParts[2])}日`
      : receipt.date;
    this.setData({
      receipt,
      displayDate,
      displayTime: String(receipt.time || '').slice(0, 5)
    });
  },

  onBack() {
    wx.navigateBack();
  },

  onMore() {
    wx.showActionSheet({
      itemList: ['删除记录'],
      itemColor: '#D71920',
      success: () => this.confirmDelete()
    });
  },

  confirmDelete() {
    const { receipt } = this.data;
    if (!receipt) return;
    wx.showModal({
      title: '删除消费记录',
      content: '删除后无法恢复，确定继续吗？',
      confirmText: '删除',
      confirmColor: '#D71920',
      success: (res) => {
        if (!res.confirm) return;
        receiptStore.deleteReceipt(receipt.id);
        wx.showToast({ title: '已删除', icon: 'success' });
        setTimeout(() => wx.navigateBack(), 500);
      }
    });
  },

  async onExportReceipt() {
    const { receipt, displayDate, displayTime, exportingReceipt } = this.data;
    if (exportingReceipt) return;
    if (!receipt) return;
    this.setData({ exportingReceipt: true });
    wx.showLoading({ title: '正在生成小票' });
    try {
      await exportReceiptImage(this, '#receiptExportCanvas', receipt, displayDate, displayTime);
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
  }
});
