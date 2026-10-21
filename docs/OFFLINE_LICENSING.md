# Codex Skin Pro 离线许可证

当前方案面向初期中国大陆售卖：爱发电负责微信/支付宝收款，Codex Skin 使用设备绑定的 Ed25519 离线许可证解锁 Pro，不需要自建服务器。

## 首次配置

在仓库外的安全目录生成密钥：

```powershell
node tools/offline-license.mjs keygen --out D:\private\codex-skin-license
```

- `codex-skin-license-private.pem` 只能由卖家保管，不得提交、上传或打入安装包。
- 将 `codex-skin-license-public.pem` 的完整内容写入 `PRODUCT.json` 的 `licensing.publicKeyPem`。
- 将爱发电商品链接写入 `PRODUCT.json` 的 `licensing.purchaseUrl`。
- 执行 `node tools/sync-runtime-assets.mjs`，再运行测试和构建。

购买链接和公钥都配置后，软件才会启用 Pro 门禁；配置不完整时保留现有功能，避免误锁开发版本。

## 每笔订单签发

客户在授权窗口复制机器码并随爱发电订单号发给卖家。签发永久许可证：

```powershell
node tools/offline-license.mjs issue `
  --private-key D:\private\codex-skin-license\codex-skin-license-private.pem `
  --machine-code AAAA-BBBB-CCCC-DDDD-EEEE-FFFF-0000-1111 `
  --order-id AFDIAN-ORDER-123
```

把命令输出的单行许可证发给客户。客户粘贴后可离线激活；许可证只能在对应机器码上使用。

如需签发限时许可证，可增加 `--expires-at 2027-10-21T00:00:00.000Z`。

## 边界

- 换机、Windows 身份变化或重装导致机器码变化时，需要核对订单后重新签发。
- 纯离线许可证无法远程撤销退款订单，也无法阻止修改开源客户端绕过门禁。
- 不要使用聊天、网盘或仓库传递私钥；私钥泄露后必须更换公钥并重新发布客户端。
