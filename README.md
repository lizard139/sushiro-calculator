# 寿司郎计算器

使用微信原生小程序开发的用餐计价工具，支持按餐碟数量计算金额、保存小票、查看历史记录与消费统计。

## 本地运行

1. 使用微信开发者工具导入本项目目录。
2. 在项目配置中填写自己的小程序 AppID，或使用工具提供的测试模式。
3. 编译并在模拟器或真机中预览。

项目不需要安装 npm 依赖。小票历史保存在微信本地存储中。

## 目录

- `pages/`：计算、设置、历史、统计、小票等页面
- `components/`、`custom-tab-bar/`：界面组件
- `utils/`：布局、小票存储与导出工具
- `tests/`：回归测试
- `prd.md`、`PRODUCT.md`：产品说明

## 测试

安装 Node.js 后运行：

```sh
node tests/receipt-store.test.js
node tests/checkout-transition.test.js
```

本仓库为个人项目，与寿司郎官方无关联。
