# 代理配置指南

## 为什么需要配置代理？

如果你在中国大陆或其他无法直接访问OpenAI的地区，需要通过代理来访问OpenAI API。

## 常见代理软件配置

### 1. Clash

**默认端口：** `7890`

在 `.env.local` 文件中添加：
```env
HTTP_PROXY=http://127.0.0.1:7890
HTTPS_PROXY=http://127.0.0.1:7890
```

### 2. V2Ray

**默认端口：** `10809`

在 `.env.local` 文件中添加：
```env
HTTP_PROXY=http://127.0.0.1:10809
HTTPS_PROXY=http://127.0.0.1:10809
```

### 3. Shadowsocks

**默认端口：** `1080`

在 `.env.local` 文件中添加：
```env
HTTP_PROXY=http://127.0.0.1:1080
HTTPS_PROXY=http://127.0.0.1:1080
```

### 4. HTTP代理

**常见端口：** `8080`, `3128`

在 `.env.local` 文件中添加：
```env
HTTP_PROXY=http://127.0.0.1:8080
HTTPS_PROXY=http://127.0.0.1:8080
```

## 验证代理配置

### 1. 检查代理是否工作

访问 http://localhost:3001/api/test

如果配置正确，应该看到：
```json
{
  "proxy": {
    "http": "http://127.0.0.1:7890",
    "https": "http://127.0.0.1:7890"
  },
  "networkTest": "connected"
}
```

### 2. 测试代理连接

在浏览器中访问：https://api.openai.com

如果代理工作正常，应该能够访问该网站。

### 3. 常见问题排查

**问题1：代理端口错误**
- 检查代理软件的设置
- 确认端口号是否正确
- 重启代理软件

**问题2：代理不支持HTTPS**
- 确保代理软件支持HTTPS
- 检查代理软件的配置
- 尝试使用SOCKS5代理

**问题3：代理认证**
如果代理需要认证，使用以下格式：
```env
HTTP_PROXY=http://username:password@127.0.0.1:7890
HTTPS_PROXY=http://username:password@127.0.0.1:7890
```

## 完整配置示例

```env
# OpenAI API配置
OPENAI_API_KEY=sk-your-api-key-here
OPENAI_MODEL=gpt-4o-mini

# 代理配置
HTTP_PROXY=http://127.0.0.1:7890
HTTPS_PROXY=http://127.0.0.1:7890
NO_PROXY=localhost,127.0.0.1
```

## 故障排除

1. **确认代理软件正在运行**
2. **检查端口是否正确**
3. **重启开发服务器**
4. **查看控制台错误信息**
5. **测试代理是否支持HTTPS** 