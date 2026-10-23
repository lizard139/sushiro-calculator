const assert = require('assert');

let pageDefinition;
let now = 0;
let nextTimerId = 1;
const timers = new Map();
global.Page = definition => { pageDefinition = definition; };
global.wx = {
  getWindowInfo: () => ({ windowHeight: 700 }),
  showToast: () => {},
  getStorageSync: () => undefined,
  setStorageSync: () => {}
};
global.setTimeout = (callback, delay) => {
  const id = nextTimerId++;
  timers.set(id, { at: now + delay, callback });
  return id;
};
global.clearTimeout = id => timers.delete(id);

require('../pages/index/index');
const page = {
  ...pageDefinition,
  data: {
    ...pageDefinition.data,
    totalAmount: '20',
    plateAmount: '20',
    plates: [{ label: '黄碟', color: '#ffd700', price: 20, count: 1, subtotal: 20 }]
  },
  setData(update, callback) {
    Object.assign(this.data, update);
    if (callback) callback();
  }
};

function advanceTo(target) {
  while (true) {
    const due = Array.from(timers.entries())
      .filter(([, timer]) => timer.at <= target)
      .sort((a, b) => a[1].at - b[1].at)[0];
    if (!due) break;
    now = due[1].at;
    timers.delete(due[0]);
    due[1].callback();
  }
  now = target;
}

page.onCheckout();
assert.equal(page.data.showReceipt, true);
assert.equal(page.data.receiptVisible, false);
const timerCount = timers.size;
page.onCheckout();
assert.equal(timers.size, timerCount, 'repeated taps must not queue another fade');
advanceTo(30);
assert.equal(page.data.receiptVisible, true);
assert.equal(timers.size, 0, 'fade timer must finish promptly');
page.onCloseReceipt();
assert.equal(page.data.showReceipt, false);
assert.equal(timers.size, 0);

page.onCheckout();
assert.equal(page.data.receiptVisible, false);
page.onHide();
assert.equal(page.data.receiptVisible, true, 'leaving the page must not strand an invisible receipt');
assert.equal(timers.size, 0, 'leaving the page must clear fade timer');
page.onCloseReceipt();

page.data.totalAmount = '0';
page.onCheckout();
assert.equal(page.data.showReceipt, false, 'empty meals must not show a receipt');

console.log('receipt fade tests passed');
