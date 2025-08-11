# 环境变量配置指南

## 必需的环境变量

### 1. 创建 .env.local 文件

在项目根目录创建 `.env.local` 文件：

```bash
# 在项目根目录执行
touch .env.local
```

### 2. 配置 OpenAI API 密钥

在 `.env.local` 文件中添加以下内容：

```env
# OpenAI API Configuration
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-4o-mini

# 代理配置（如果使用VPN）
HTTP_PROXY=http://127.0.0.1:7890
HTTPS_PROXY=http://127.0.0.1:7890
```

### 3. 获取 OpenAI API 密钥

1. 访问 [OpenAI Platform](https://platform.openai.com/)
2. 登录或注册账户
3. 进入 [API Keys](https://platform.openai.com/api-keys) 页面
4. 点击 "Create new secret key"
5. 复制生成的密钥
6. 将密钥粘贴到 `.env.local` 文件中的 `OPENAI_API_KEY=` 后面

### 4. 代理配置说明

如果你使用VPN访问OpenAI，需要配置代理：

**常见代理端口：**
- Clash: `7890`
- V2Ray: `10809`
- Shadowsocks: `1080`
- HTTP代理: `8080`

**配置示例：**
```env
# Clash代理
HTTP_PROXY=http://127.0.0.1:7890
HTTPS_PROXY=http://127.0.0.1:7890

# 或者V2Ray代理
HTTP_PROXY=http://127.0.0.1:10809
HTTPS_PROXY=http://127.0.0.1:10809
```

### 5. 验证配置

启动开发服务器后，访问以下URL验证配置：

```
http://localhost:3001/api/test
```

如果配置正确，应该看到类似以下的响应：

```json
{
  "status": "ok",
  "hasApiKey": true,
  "apiKeyLength": 51,
  "model": "gpt-4o-mini",
  "networkTest": "connected",
  "timestamp": "2024-12-18T10:30:00.000Z"
}
```

## 可选的环境变量

```env
# OpenAI Organization ID (如果有的话)
OPENAI_ORG_ID=your_organization_id_here

# 自定义 OpenAI Base URL (用于 Azure OpenAI 或其他提供商)
OPENAI_BASE_URL=https://api.openai.com/v1

# API 版本
OPENAI_API_VERSION=2024-02-15

# 代理配置（可选）
NO_PROXY=localhost,127.0.0.1
```

## 故障排除

### 1. 如果 hasApiKey 为 false

- 检查 `.env.local` 文件是否存在
- 检查 `OPENAI_API_KEY` 是否正确设置
- 重启开发服务器

### 2. 如果 API 调用失败

- 检查 API 密钥是否有效
- 检查账户余额是否充足
- 检查网络连接
- **如果使用VPN，检查代理配置是否正确**

### 3. 如果遇到 500 错误

- 检查控制台日志
- 确认环境变量已正确加载
- 验证 API 密钥格式
- **检查代理是否正常工作**

### 4. 代理相关问题

- 确认代理软件正在运行
- 检查代理端口是否正确
- 测试代理是否支持HTTPS
- 尝试在浏览器中访问 https://api.openai.com 验证代理

## 安全注意事项

- 永远不要将 `.env.local` 文件提交到版本控制系统
- 在生产环境中使用环境变量而不是文件
- 定期轮换 API 密钥 