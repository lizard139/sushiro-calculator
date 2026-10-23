const assert = require('assert');

const storage = new Map();
global.wx = {
  getStorageSync: key => storage.get(key),
  setStorageSync: (key, value) => storage.set(key, value),
  removeStorageSync: key => storage.delete(key),
  cloud: {
    init() { throw new Error('cloud init should not run'); },
    database() { throw new Error('cloud database should not run'); }
  }
};

const store = require('../utils/receipt-store');
const receipt = n => ({ id: `r${n}`, timestamp: n, totalAmount: n });

storage.set('orderHistory', [receipt(1)]);
assert.equal(store.readHistory().length, 1, 'existing local receipt remains readable');

store.addReceipt(receipt(2));
assert.deepEqual(store.readHistory().map(item => item.id), ['r2', 'r1']);

store.deleteReceipt('r1');
assert.deepEqual(store.readHistory().map(item => item.id), ['r2']);

for (let n = 3; n <= 105; n++) store.addReceipt(receipt(n));
assert.equal(store.readHistory().length, 100, 'only latest 100 receipts remain');
assert.equal(store.readHistory()[0].id, 'r105');

store.clearReceipts();
assert.deepEqual(store.readHistory(), []);
console.log('local receipt-store tests passed');
