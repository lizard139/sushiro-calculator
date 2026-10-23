const RED = '#D71920';
const INK = '#0B0C0E';
const MUTED = '#68707A';
const RULE = '#AEB4BC';
const SYSTEM_FONT = '-apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif';
const NUMBER_FONT = '"SF Pro Rounded", "Arial Rounded MT Bold", "DIN Alternate", sans-serif';

function formatAmount(value) {
  return String(value === undefined || value === null || value === '' ? 0 : value);
}

function drawRoundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.arcTo(x + width, y, x + width, y + r, r);
  ctx.lineTo(x + width, y + height - r);
  ctx.arcTo(x + width, y + height, x + width - r, y + height, r);
  ctx.lineTo(x + r, y + height);
  ctx.arcTo(x, y + height, x, y + height - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function drawDashedRule(ctx, y) {
  ctx.save();
  ctx.beginPath();
  ctx.setLineDash([12, 10]);
  ctx.lineWidth = 2;
  ctx.strokeStyle = RULE;
  ctx.moveTo(110, y);
  ctx.lineTo(790, y);
  ctx.stroke();
  ctx.restore();
}

function fitText(ctx, text, maxWidth) {
  const value = String(text || '未命名');
  if (ctx.measureText(value).width <= maxWidth) return value;
  let output = value;
  while (output.length > 1 && ctx.measureText(`${output}…`).width > maxWidth) {
    output = output.slice(0, -1);
  }
  return `${output}…`;
}

function getCanvasNode(page, selector) {
  return new Promise((resolve, reject) => {
    wx.createSelectorQuery()
      .in(page)
      .select(selector)
      .fields({ node: true, size: true })
      .exec(result => {
        const target = result && result[0];
        if (!target || !target.node) {
          reject(new Error('未找到小票导出画布'));
          return;
        }
        resolve(target.node);
      });
  });
}

function canvasToTempFilePath(canvas, width, height, page) {
  return new Promise((resolve, reject) => {
    wx.canvasToTempFilePath({
      canvas,
      x: 0,
      y: 0,
      width,
      height,
      destWidth: width,
      destHeight: height,
      fileType: 'png',
      quality: 1,
      success: result => resolve(result.tempFilePath),
      fail: reject
    }, page);
  });
}

function saveToAlbum(filePath) {
  return new Promise((resolve, reject) => {
    wx.saveImageToPhotosAlbum({ filePath, success: resolve, fail: reject });
  });
}

async function renderReceiptImage(page, selector, receipt, displayDate, displayTime) {
  const canvas = await getCanvasNode(page, selector);
  const items = [...(receipt.plates || []), ...(receipt.customItems || [])];
  const summaryRows = 1
    + (Number(receipt.customAmount || 0) > 0 ? 1 : 0)
    + (receipt.useDiscount ? 1 : 0)
    + (receipt.useServiceFee ? 1 : 0);
  const hasPeople = Number(receipt.peopleCount || 0) > 0;
  const width = 900;
  const height = 960 + Math.max(items.length, 1) * 68 + summaryRows * 58 + (hasPeople ? 78 : 0);
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, width, height);

  ctx.save();
  ctx.shadowColor = 'rgba(15, 18, 22, 0.14)';
  ctx.shadowBlur = 22;
  ctx.shadowOffsetY = 8;
  drawRoundedRect(ctx, 60, 40, 780, height - 80, 14);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = RED;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(450, 116, 45, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(450, 116, 31, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = RED;
  ctx.beginPath();
  ctx.arc(450, 116, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.fillStyle = INK;
  ctx.font = `700 52px ${SYSTEM_FONT}`;
  ctx.fillText('寿司郎消费小票', 450, 220);
  ctx.fillStyle = MUTED;
  ctx.font = `500 28px ${NUMBER_FONT}`;
  ctx.fillText(`${displayDate || receipt.date || ''}  ${displayTime || String(receipt.time || '').slice(0, 5)}`, 450, 282);
  ctx.fillText(`单号：${receipt.id || '未记录'}`, 450, 329);

  drawDashedRule(ctx, 382);
  ctx.fillStyle = INK;
  ctx.font = `700 36px ${SYSTEM_FONT}`;
  ctx.fillText('消费明细', 450, 438);

  let y = 510;
  const drawItem = item => {
    ctx.textAlign = 'left';
    ctx.fillStyle = INK;
    ctx.font = `500 30px ${SYSTEM_FONT}`;
    ctx.fillText(fitText(ctx, item.name || item.label || '未命名', 250), 110, y);
    ctx.textAlign = 'right';
    ctx.font = `500 30px ${NUMBER_FONT}`;
    ctx.fillText(`¥${formatAmount(item.price)} × ${Number(item.count || 0)}`, 625, y);
    ctx.fillText(`¥${formatAmount(item.subtotal)}`, 790, y);
    y += 68;
  };

  if (items.length) {
    items.forEach(drawItem);
  } else {
    ctx.textAlign = 'center';
    ctx.fillStyle = MUTED;
    ctx.font = `500 28px ${SYSTEM_FONT}`;
    ctx.fillText('暂无消费明细', 450, y);
    y += 68;
  }

  drawDashedRule(ctx, y + 8);
  y += 65;

  const drawSummary = (label, value, color) => {
    ctx.textAlign = 'left';
    ctx.fillStyle = color || INK;
    ctx.font = `500 29px ${SYSTEM_FONT}`;
    ctx.fillText(label, 110, y);
    ctx.textAlign = 'right';
    ctx.font = `500 30px ${NUMBER_FONT}`;
    ctx.fillText(value, 790, y);
    y += 58;
  };

  drawSummary('碟子小计', `¥${formatAmount(receipt.plateAmount)}`);
  if (Number(receipt.customAmount || 0) > 0) drawSummary('单点小计', `¥${formatAmount(receipt.customAmount)}`);
  if (receipt.useDiscount) drawSummary('88折优惠', `-¥${formatAmount(receipt.discountAmount)}`, RED);
  if (receipt.useServiceFee) {
    const peopleSuffix = hasPeople ? `（${receipt.peopleCount}人）` : '';
    drawSummary(`服务费${peopleSuffix}`, `+¥${formatAmount(receipt.serviceFeeTotal)}`);
  }

  drawDashedRule(ctx, y + 3);
  y += 70;
  ctx.textAlign = 'left';
  ctx.fillStyle = INK;
  ctx.font = `700 40px ${SYSTEM_FONT}`;
  ctx.fillText('合计', 110, y);
  ctx.textAlign = 'right';
  ctx.fillStyle = RED;
  ctx.font = `600 58px ${NUMBER_FONT}`;
  ctx.fillText(`¥${formatAmount(receipt.totalAmount)}`, 790, y);
  y += 86;
  drawDashedRule(ctx, y);
  y += 62;

  if (hasPeople) {
    ctx.fillStyle = INK;
    ctx.textAlign = 'left';
    ctx.font = `500 29px ${SYSTEM_FONT}`;
    ctx.fillText(`人数 ${receipt.peopleCount}人`, 110, y);
    ctx.textAlign = 'right';
    ctx.font = `500 30px ${NUMBER_FONT}`;
    ctx.fillText(`人均 ¥${formatAmount(receipt.perCapita)}`, 790, y);
    y += 76;
    drawDashedRule(ctx, y);
    y += 64;
  }

  ctx.textAlign = 'center';
  ctx.fillStyle = INK;
  ctx.font = `500 28px ${SYSTEM_FONT}`;
  ctx.fillText('谢谢惠顾，欢迎再次光临', 450, y);
  ctx.fillStyle = MUTED;
  ctx.font = `500 23px ${SYSTEM_FONT}`;
  ctx.fillText('由吃郎计算器生成', 450, y + 48);

  return canvasToTempFilePath(canvas, width, height, page);
}

async function exportReceiptImage(page, selector, receipt, displayDate, displayTime) {
  const filePath = await renderReceiptImage(page, selector, receipt, displayDate, displayTime);
  await saveToAlbum(filePath);
  return filePath;
}

function isAlbumPermissionError(error) {
  const message = String((error && error.errMsg) || (error && error.message) || error || '');
  return /auth|authorize|permission|writePhotosAlbum/i.test(message);
}

module.exports = { exportReceiptImage, isAlbumPermissionError };
