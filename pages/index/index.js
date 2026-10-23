// 寿司郎计算器主页逻辑
const { getHeaderSafeHeight } = require('../../utils/layout');
const receiptStore = require('../../utils/receipt-store');

const DEFAULT_PLATES = [
  { label: '白碟', color: '#FFFFFF', price: 8 },
  { label: '红碟', color: '#D71920', price: 10 },
  { label: '银碟', color: '#C0C0C0', price: 15 },
  { label: '黄碟', color: '#FFD700', price: 20 },
  { label: '黑碟', color: '#333333', price: 28 }
];

const ACTIVE_MEAL_DRAFT_KEY = 'activeMealDraft';

let customIdSeed = 1;

function getReceiptLayout(receiptData) {
  let windowHeight = 667;
  try {
    const windowInfo = typeof wx.getWindowInfo === 'function'
      ? wx.getWindowInfo()
      : wx.getSystemInfoSync();
    if (windowInfo && windowInfo.windowHeight > 0) {
      windowHeight = windowInfo.windowHeight;
    }
  } catch (error) {
    // Keep a usable viewport while the simulator has not reported its size yet.
  }
  const paperMaxHeight = Math.max(140, Math.min(Math.floor(windowHeight * 0.68), windowHeight - 112));
  const itemCount = receiptData
    ? (receiptData.plates || []).length + (receiptData.customItems || []).length
    : 0;
  const extraRows = receiptData
    ? Number(Number(receiptData.customAmount) > 0) + Number(!!receiptData.useDiscount) + Number(!!receiptData.useServiceFee)
    : 0;
  return {
    receiptViewportHeight: windowHeight,
    receiptPaperHeight: Math.min(paperMaxHeight, 275 + itemCount * 30 + extraRows * 22)
  };
}

Page({
  data: {
    headerSafeHeight: 76,
    plates: [],
    customItems: [],
    totalPlateCount: 0,
    plateAmount: 0,
    customAmount: 0,
    totalAmount: 0,
    peopleCount: '',
    perCapita: 0,
    useDiscount: false,
    useServiceFee: false,
    showOptions: false,
    discountAmount: 0,
    serviceFeeTotal: 0,
    showReceipt: false,
    receiptVisible: false,
    receiptViewportHeight: 667,
    receiptPaperHeight: 275,
    receiptData: {},
    showUndoReset: false
  },

  onLoad() {
    this.setData({ headerSafeHeight: getHeaderSafeHeight(), ...getReceiptLayout() });
    console.log('页面加载');
    this.restoreDraft();
  },

  onShow() {
    if (this.getTabBar()) this.getTabBar().setData({ current: 'calculator' });
    console.log('页面显示');
  },

  onResize() {
    this.setData(getReceiptLayout(this.data.receiptData));
  },

  onUnload() {
    if (this.receiptFadeTimer) clearTimeout(this.receiptFadeTimer);
  },

  onHide() {
    if (this.receiptFadeTimer) clearTimeout(this.receiptFadeTimer);
    this.receiptFadeTimer = null;
    this.checkoutInProgress = false;
    if (this.data.showReceipt && !this.data.receiptVisible) {
      this.setData({ receiptVisible: true });
    }
  },

  initPlates() {
    const plates = DEFAULT_PLATES.map(p => ({
      ...p,
      count: 0,
      subtotal: 0
    }));
    this.setData({ plates }, () => {
      this.recalculate();
    });
  },

  getDraftData() {
    return {
      version: 1,
      plates: this.data.plates.map(item => ({ label: item.label, count: Number(item.count || 0) })),
      customItems: this.data.customItems.map(item => ({
        id: item.id,
        name: item.name,
        price: item.price,
        count: Number(item.count || 0)
      })),
      peopleCount: this.data.peopleCount,
      useDiscount: this.data.useDiscount,
      useServiceFee: this.data.useServiceFee,
      updatedAt: Date.now()
    };
  },

  hasActiveMeal() {
    return this.data.plates.some(item => Number(item.count || 0) > 0)
      || this.data.customItems.length > 0
      || Number(this.data.peopleCount || 0) > 0
      || this.data.useDiscount
      || this.data.useServiceFee;
  },

  saveDraft() {
    try {
      if (!this.hasActiveMeal()) {
        wx.removeStorageSync(ACTIVE_MEAL_DRAFT_KEY);
        return;
      }
      wx.setStorageSync(ACTIVE_MEAL_DRAFT_KEY, this.getDraftData());
    } catch (error) {
      console.error('保存本餐草稿失败:', error);
    }
  },

  restoreDraft() {
    try {
      const draft = wx.getStorageSync(ACTIVE_MEAL_DRAFT_KEY);
      if (!draft || !Array.isArray(draft.plates)) {
        this.initPlates();
        return;
      }
      this.applyDraft(draft);
    } catch (error) {
      console.error('恢复本餐草稿失败:', error);
      this.initPlates();
    }
  },

  applyDraft(draft) {
    const savedCounts = new Map((draft.plates || []).map(item => [item.label, Number(item.count || 0)]));
    const plates = DEFAULT_PLATES.map(item => {
      const count = Math.max(0, savedCounts.get(item.label) || 0);
      return { ...item, count, subtotal: count * item.price };
    });
    const customItems = (draft.customItems || []).map((item, index) => {
      const count = Math.max(0, Number(item.count || 0));
      const price = item.price === '' ? '' : Math.max(0, Number(item.price || 0));
      return {
        id: item.id || `c-${index + 1}`,
        name: String(item.name || ''),
        price,
        count,
        subtotal: (Number(price) || 0) * count
      };
    });
    customIdSeed = customItems.reduce((max, item) => {
      const matched = String(item.id).match(/^c-(\d+)$/);
      return matched ? Math.max(max, Number(matched[1]) + 1) : max;
    }, 1);
    this.setData({
      plates,
      customItems,
      peopleCount: Number(draft.peopleCount || 0) || '',
      useDiscount: Boolean(draft.useDiscount),
      useServiceFee: Boolean(draft.useServiceFee)
    }, () => this.recalculate());
  },

  // 碟子数量操作
  onPlateMinus(e) {
    console.log('点击减号按钮');
    const index = e.currentTarget.dataset.index;
    const plates = [...this.data.plates];
    const current = plates[index];
    const nextCount = Math.max(0, Number(current.count || 0) - 1);
    plates[index] = {
      ...current,
      count: nextCount,
      subtotal: nextCount * current.price
    };
    this.setData({ plates }, () => this.recalculate());
  },

  onPlatePlus(e) {
    const index = e.currentTarget.dataset.index;
    const plates = [...this.data.plates];
    const current = plates[index];
    const nextCount = Number(current.count || 0) + 1;
    plates[index] = {
      ...current,
      count: nextCount,
      subtotal: nextCount * current.price
    };
    this.setData({ plates }, () => this.recalculate());
  },

  onPlateInput(e) {
    const index = e.currentTarget.dataset.index;
    const value = e.detail.value;
    let count = parseInt(value, 10);
    if (isNaN(count) || count < 0) count = 0;
    const plates = [...this.data.plates];
    const current = plates[index];
    plates[index] = {
      ...current,
      count,
      subtotal: count * current.price
    };
    this.setData({ plates }, () => this.recalculate());
  },

  // 自定义单点
  onAddCustomItem() {
    const list = [...this.data.customItems];
    list.push({
      id: `c-${customIdSeed++}`,
      name: '',
      price: '',
      count: 1,
      subtotal: 0
    });
    this.setData({ customItems: list }, () => this.recalculate());
  },

  onRemoveCustomItem(e) {
    const id = e.currentTarget.dataset.id;
    const list = this.data.customItems.filter(item => item.id !== id);
    this.setData({ customItems: list }, () => this.recalculate());
  },

  onCustomChange(e) {
    const { id, field } = e.currentTarget.dataset;
    const value = e.detail.value;
    const list = this.data.customItems.map(item => {
      if (item.id !== id) return item;
      const next = { ...item, [field]: value };
      const priceNum = parseFloat(next.price) || 0;
      const countNum = Number(next.count || 0);
      next.subtotal = priceNum * countNum;
      return next;
    });
    this.setData({ customItems: list }, () => this.recalculate());
  },

  onCustomCountChange(e) {
    const id = e.currentTarget.dataset.id;
    let count = parseInt(e.detail.value, 10);
    if (isNaN(count) || count < 0) count = 0;
    const list = this.data.customItems.map(item => {
      if (item.id !== id) return item;
      const next = { ...item, count };
      const priceNum = parseFloat(next.price) || 0;
      next.subtotal = priceNum * count;
      return next;
    });
    this.setData({ customItems: list }, () => this.recalculate());
  },

  onCustomMinus(e) {
    const id = e.currentTarget.dataset.id;
    const list = this.data.customItems.map(item => {
      if (item.id !== id) return item;
      let count = Number(item.count || 0) - 1;
      if (count < 0) count = 0;
      const next = { ...item, count };
      const priceNum = parseFloat(next.price) || 0;
      next.subtotal = priceNum * count;
      return next;
    });
    this.setData({ customItems: list }, () => this.recalculate());
  },

  onCustomPlus(e) {
    const id = e.currentTarget.dataset.id;
    const list = this.data.customItems.map(item => {
      if (item.id !== id) return item;
      const count = Number(item.count || 0) + 1;
      const next = { ...item, count };
      const priceNum = parseFloat(next.price) || 0;
      next.subtotal = priceNum * count;
      return next;
    });
    this.setData({ customItems: list }, () => this.recalculate());
  },

  // 人数
  onPeopleInput(e) {
    let value = e.detail.value;
    let num = parseInt(value, 10);
    if (isNaN(num) || num <= 0) {
      this.setData({ peopleCount: '', perCapita: 0 }, () => this.recalculate());
      return;
    }
    this.setData({ peopleCount: num }, () => this.recalculate());
  },

  onPeopleMinus() {
    const current = Number(this.data.peopleCount || 0);
    const next = Math.max(0, current - 1);
    this.setData({ peopleCount: next || '' }, () => this.recalculate());
  },

  onPeoplePlus() {
    const current = Number(this.data.peopleCount || 0);
    this.setData({ peopleCount: current + 1 }, () => this.recalculate());
  },

  onToggleDiscount(e) {
    const value = e.detail.value && e.detail.value.length > 0;
    this.setData({ useDiscount: value }, () => this.recalculate());
  },

  onToggleServiceFee(e) {
    const value = e.detail.value && e.detail.value.length > 0;
    this.setData({ useServiceFee: value }, () => this.recalculate());
  },

  onToggleDiscountTap() {
    this.setData({ useDiscount: !this.data.useDiscount }, () => this.recalculate());
  },

  onToggleServiceFeeTap() {
    const useServiceFee = !this.data.useServiceFee;
    const nextData = { useServiceFee };
    if (useServiceFee && !Number(this.data.peopleCount || 0)) {
      nextData.peopleCount = 1;
    }
    this.setData(nextData, () => this.recalculate());
  },

  onToggleOptions() {
    this.setData({ showOptions: !this.data.showOptions });
  },

  // 重置
  onReset() {
    if (!this.hasActiveMeal()) return;
    wx.showModal({
      title: '重置本餐',
      content: '当前已填写的碟子、单点和费用会被清空。',
      confirmText: '清空本餐',
      confirmColor: '#D71920',
      cancelText: '继续计算',
      success: (res) => {
        if (!res.confirm) return;
        this.lastResetDraft = this.getDraftData();
        this.performReset(true);
      }
    });
  },

  performReset(offerUndo) {
    console.log('执行重置操作');
    if (this.undoResetTimer) clearTimeout(this.undoResetTimer);
    customIdSeed = 1;
    const plates = DEFAULT_PLATES.map(item => ({ ...item, count: 0, subtotal: 0 }));
    this.setData({
      plates,
      customItems: [],
      peopleCount: '',
      perCapita: 0,
      useDiscount: false,
      useServiceFee: false,
      showOptions: false,
      discountAmount: 0,
      serviceFeeTotal: 0,
      showUndoReset: Boolean(offerUndo)
    }, () => {
      console.log('重置完成，数据已清空');
      this.recalculate();
      if (offerUndo) {
        this.undoResetTimer = setTimeout(() => {
          this.lastResetDraft = null;
          this.setData({ showUndoReset: false });
        }, 6000);
      } else {
        this.lastResetDraft = null;
      }
    });
  },

  onUndoReset() {
    if (!this.lastResetDraft) return;
    if (this.undoResetTimer) clearTimeout(this.undoResetTimer);
    const draft = this.lastResetDraft;
    this.lastResetDraft = null;
    this.setData({ showUndoReset: false });
    this.applyDraft(draft);
    wx.showToast({ title: '已恢复本餐', icon: 'success' });
  },

  // 统一重新计算金额
  recalculate() {
    const plateAmount = this.data.plates.reduce(
      (sum, p) => sum + (Number(p.subtotal) || 0),
      0
    );
    const totalPlateCount = this.data.plates.reduce(
      (sum, p) => sum + (Number(p.count) || 0),
      0
    );
    const customAmount = this.data.customItems.reduce(
      (sum, item) => sum + (Number(item.subtotal) || 0),
      0
    );
    
    let rawTotal = plateAmount + customAmount;
    let discountAmount = 0;
    let serviceFeeTotal = 0;

    // 88折优惠
    if (this.data.useDiscount) {
      const discounted = rawTotal * 0.88;
      discountAmount = rawTotal - discounted;
      rawTotal = discounted;
    }

    // 服务费：每人 5 元
    const people = Number(this.data.peopleCount || 0);
    if (this.data.useServiceFee && people > 0) {
      serviceFeeTotal = people * 5;
      rawTotal += serviceFeeTotal;
    }

    let perCapita = 0;
    if (people > 0) {
      perCapita = rawTotal / people;
      // 保留一位小数
      perCapita = Math.round(perCapita * 10) / 10;
    }

    this.setData({
      plateAmount: plateAmount.toFixed(2).replace(/\.00$/, ''),
      totalPlateCount,
      customAmount: customAmount.toFixed(2).replace(/\.00$/, ''),
      totalAmount: rawTotal.toFixed(2).replace(/\.00$/, ''),
      perCapita: perCapita ? perCapita.toFixed(1) : 0,
      discountAmount: discountAmount.toFixed(2).replace(/\.00$/, ''),
      serviceFeeTotal: serviceFeeTotal
    }, () => this.saveDraft());
  },

  // 结算按钮 - 生成小票
  onCheckout() {
    if (this.checkoutInProgress || this.data.showReceipt) return;
    console.log('点击结算按钮');
    // 检查是否有消费
    if (this.data.totalAmount <= 0) {
      wx.showToast({
        title: '请先添加消费项目',
        icon: 'none'
      });
      return;
    }

    // 生成小票数据
    const now = new Date();
    const receiptId = `${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`;
    
    const receiptData = {
      id: receiptId,
      date: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`,
      time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`,
      timestamp: now.getTime(),
      
      // 碟子明细（过滤数量为0的）
      plates: this.data.plates.filter(p => p.count > 0).map(p => ({
        label: p.label,
        color: p.color,
        price: p.price,
        count: p.count,
        subtotal: p.subtotal.toFixed(2).replace(/\.00$/, '')
      })),
      
      // 自定义单点明细（过滤数量为0的）
      customItems: this.data.customItems.filter(item => item.count > 0).map(item => ({
        id: item.id,
        name: item.name || '未命名',
        price: item.price,
        count: item.count,
        subtotal: item.subtotal.toFixed(2).replace(/\.00$/, '')
      })),
      
      // 金额信息
      plateAmount: this.data.plateAmount,
      customAmount: this.data.customAmount,
      totalAmount: this.data.totalAmount,
      
      // 优惠和费用
      useDiscount: this.data.useDiscount,
      discountAmount: this.data.discountAmount,
      useServiceFee: this.data.useServiceFee,
      serviceFeeTotal: this.data.serviceFeeTotal,
      
      // 人数和人均
      peopleCount: this.data.peopleCount,
      perCapita: this.data.perCapita
    };

    if (this.receiptFadeTimer) clearTimeout(this.receiptFadeTimer);
    this.checkoutInProgress = true;
    this.setData({
      receiptData,
      ...getReceiptLayout(receiptData),
      showReceipt: true,
      receiptVisible: false
    }, () => {
      this.receiptFadeTimer = setTimeout(() => {
        this.receiptFadeTimer = null;
        this.setData({ receiptVisible: true });
        this.checkoutInProgress = false;
      }, 30);
    });
  },

  // 关闭小票
  onCloseReceipt() {
    if (this.receiptFadeTimer) clearTimeout(this.receiptFadeTimer);
    this.receiptFadeTimer = null;
    this.checkoutInProgress = false;
    this.setData({ 
      showReceipt: false,
      receiptVisible: false,
      receiptData: {}
    });
  },

  // 阻止事件冒泡
  onStopPropagation() {
    // 空函数，仅用于阻止事件冒泡
  },

  // 保存历史记录
  onSaveReceipt() {
    console.log('开始保存历史记录');
    try {
      receiptStore.addReceipt(this.data.receiptData);
      
      // 先关闭小票，清空小票数据
      this.setData({ 
        showReceipt: false,
        receiptVisible: false,
        receiptData: {}
      }, () => {
        console.log('小票已关闭');
        // 显示保存成功提示
        wx.showToast({
          title: '已保存到历史记录',
          icon: 'success',
          duration: 1500
        });
        
        // 延迟重置，确保提示显示完整
        setTimeout(() => {
          console.log('准备执行重置');
          this.performReset(false);
        }, 300);
      });
      
    } catch (error) {
      console.error('保存历史记录失败:', error);
      wx.showToast({
        title: '保存失败',
        icon: 'error'
      });
    }
  },

  // 跳转到吃郎概览页面
  onGoToHistory() {
    console.log('点击历史记录按钮');
    wx.switchTab({
      url: '/pages/history/history',
      fail: (err) => {
        console.error('跳转失败:', err);
        wx.showToast({
          title: '跳转失败',
          icon: 'error'
        });
      }
    });
  },

  onUnload() {
    if (this.undoResetTimer) clearTimeout(this.undoResetTimer);
  }
});
