function getHeaderSafeHeight() {
  try {
    const menu = wx.getMenuButtonBoundingClientRect();
    if (menu && menu.bottom > 0) {
      return Math.ceil(menu.bottom + 8);
    }
  } catch (error) {
    // Some development environments do not expose the menu button bounds.
  }

  try {
    const system = wx.getSystemInfoSync();
    return (system.statusBarHeight || 24) + 52;
  } catch (error) {
    return 76;
  }
}

module.exports = { getHeaderSafeHeight };
