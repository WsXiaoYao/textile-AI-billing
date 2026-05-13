# 纺织开单小工具后端

这是微信小程序的本地后端骨架。当前请求层已关闭 mock 数据源，未实现的接口会直接返回 404，避免页面误走本地假数据。

当前后端包含：

- `auth`：提供微信手机号授权登录、会话查询和退出登录，前端切到 HTTP 后会自动携带 `Authorization`。
- `customers / customer-categories / sales-orders / accounts`：客户、客户分类、销售单、收款账户等真实数据库接口。
- `Prisma + PostgreSQL`：真实后端的数据模型和事务实现。

## 本地环境

PostgreSQL 已按用户目录安装，默认连接：

```bash
postgresql://xiaoyao@127.0.0.1:5432/textile_ai_billing
```

如需手动启动数据库：

```bash
pg_ctl -D ~/.local/pgsql/data -l ~/.local/pgsql/log/postgresql.log start
```

## 快速开始

```bash
cd backend
cp .env.example .env
npm install
npm run db:generate
npm run db:push
npm run smoke
npm run dev
```

服务启动后：

```bash
curl http://127.0.0.1:3000/health
curl 'http://127.0.0.1:3000/api/v1/customers?page=1&pageSize=2'
curl -X POST http://127.0.0.1:3000/api/v1/auth/wechat-phone-login \
  -H 'content-type: application/json' \
  -d '{"phoneCode":"1358270496","loginCode":"local"}'
```

小程序联调使用 `config/env.js` 的真实接口地址：

```js
API_BASE_URL: 'http://127.0.0.1:3000/api/v1'
```

微信开发者工具需要在本地设置里勾选“不校验合法域名、web-view、TLS 版本以及 HTTPS 证书”。

完整接口文档见：

```text
../docs/backend-api-reference.md
```

## 微信手机号登录

登录逻辑按小程序真实链路设计：

1. 前端调用 `wx.login` 获取 `loginCode`。
2. 用户点击 `open-type="getPhoneNumber"` 按钮，前端拿到 `phoneCode`。
3. 前端调用 `POST /api/v1/auth/wechat-phone-login`。
4. 后端用 `phoneCode` 调微信 `getuserphonenumber` 换手机号，用手机号作为唯一标识创建或匹配 `User`。
5. 后端按手机号绑定员工，返回 `token`、当前组织、员工、角色权限和仓库权限。

接口：

| 接口 | 说明 |
| --- | --- |
| `POST /api/v1/auth/wechat-phone-login` | 入参 `{ phoneCode, loginCode }`，返回 `{ token, expiresAt, user, currentOrg, employee, permissions }` |
| `GET /api/v1/auth/me` | 根据 `Authorization: Bearer <token>` 返回当前登录态 |
| `POST /api/v1/auth/logout` | 删除当前会话 |

本地开发默认 `WECHAT_MOCK_LOGIN="true"`，可以不配置微信密钥直接跑通。正式环境需要配置：

```bash
WECHAT_APP_ID="小程序 appid"
WECHAT_APP_SECRET="小程序 secret"
WECHAT_MOCK_LOGIN="false"
AUTH_AUTO_PROVISION="false"
```

`AUTH_AUTO_PROVISION` 控制未匹配员工时是否自动创建默认组织员工。正式业务建议关闭，改为要求管理员提前维护员工手机号。

## 后续替换路线

1. 保留 `/api/v1` 路径和 `{ code, message, data, traceId }` 响应格式。
2. 先实现销售单、客户、产品、库存这几组高频接口。
3. 写操作必须使用数据库事务，并支持 `X-Request-Id` 幂等。
4. 导入导出、图片上传先走本地文件，正式部署再替换成对象存储。
5. 登录接入微信 `wx.login` 后，后端负责组织、员工和仓库权限过滤。
