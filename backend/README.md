# 纺织开单小工具后端

这是微信小程序的本地后端骨架，用于后续把前端从 `mockAdapter` 平滑切到真实 HTTP 接口。

当前后端包含两层：

- `mock-bridge`：把 `/api/v1/*` 请求转发到小程序项目现有的 mock store，方便立刻联调。
- `Prisma + PostgreSQL`：提供真实后端的数据模型基础，后续逐步把 mock 路由替换成数据库事务实现。

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
```

小程序联调时把 `config/env.js` 改成：

```js
API_MODE: 'http',
API_BASE_URL: 'http://127.0.0.1:3000/api/v1'
```

微信开发者工具需要在本地设置里勾选“不校验合法域名、web-view、TLS 版本以及 HTTPS 证书”。

## 后续替换路线

1. 保留 `/api/v1` 路径和 `{ code, message, data, traceId }` 响应格式。
2. 先实现销售单、客户、产品、库存这几组高频接口。
3. 写操作必须使用数据库事务，并支持 `X-Request-Id` 幂等。
4. 导入导出、图片上传先走本地文件，正式部署再替换成对象存储。
5. 登录接入微信 `wx.login` 后，后端负责组织、员工和仓库权限过滤。
