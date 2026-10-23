const HISTORY_KEY = 'orderHistory';
const MAX_RECORDS = 100;

function readHistory() {
  const value = wx.getStorageSync(HISTORY_KEY);
  return Array.isArray(value) ? value : [];
}

function addReceipt(record) {
  const history = readHistory().filter(item => item.id !== record.id);
  history.unshift(record);
  wx.setStorageSync(HISTORY_KEY, history.slice(0, MAX_RECORDS));
}

function deleteReceipt(id) {
  wx.setStorageSync(HISTORY_KEY, readHistory().filter(item => item.id !== id));
}

function clearReceipts() {
  wx.removeStorageSync(HISTORY_KEY);
}

module.exports = { readHistory, addReceipt, deleteReceipt, clearReceipts };
