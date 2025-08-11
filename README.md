# 判决书分析器 (Judgment Analyzer)

一个基于AI的法律判决书分析工具，支持多种分析模式，为法律专业人士、企业法务、媒体和公众提供智能化的法律文档分析服务。

## ✨ 功能特性

- 🤖 **AI驱动分析**: 基于OpenAI GPT-4o-mini的智能分析
- 📋 **多模式分析**: 律师、企业、媒体、公众四种专业分析模式
- 📁 **多格式支持**: 支持文件上传、URL抓取、文本输入
- 📊 **结构化输出**: JSON格式的结构化分析结果
- 📱 **现代化UI**: 基于shadcn/ui的响应式设计
- 🔄 **实时分析**: 快速响应的AI分析服务

## 🚀 快速开始

### 环境要求

- Node.js 18+ 
- npm/yarn/pnpm
- OpenAI API 密钥

### 安装依赖

```bash
npm install
```

### 环境配置

#### 方法一：使用启动脚本（推荐）

**Windows:**
```bash
start.bat
```

**Linux/Mac:**
```bash
chmod +x start.sh
./start.sh
```

#### 方法二：手动配置

1. 复制环境变量模板：
```bash
cp .env.example .env.local
```

2. 配置OpenAI API密钥：
```bash
# 在 .env.local 中设置
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-4o-mini
```

### 启动开发服务器

```bash
npm run dev
```

访问 [http://localhost:3000](http://localhost:3000) 查看应用。

## 🔧 配置验证

启动服务器后，访问以下URL验证配置：

- **健康检查**: http://localhost:3000/api/health
- **配置测试**: http://localhost:3000/api/test

## 🏗️ 技术栈

- **前端**: Next.js 15, React 19, TypeScript
- **UI**: Tailwind CSS, shadcn/ui, Framer Motion
- **AI**: OpenAI GPT-4o-mini
- **部署**: Vercel (推荐)

## 📁 项目结构

```
judgment-analyzer/
├── app/
│   ├── api/
│   │   ├── analyze/     # AI分析API
│   │   ├── health/      # 健康检查
│   │   └── test/        # 配置测试
│   ├── page.tsx         # 主页面
│   └── layout.tsx       # 布局组件
├── components/
│   └── ui/              # UI组件库
├── .env.local           # 环境变量（需要创建）
├── SETUP.md             # 详细配置指南
└── README.md            # 项目说明
```

## 🛠️ 故障排除

### 常见问题

1. **500错误 - Missing OPENAI_API_KEY**
   - 检查 `.env.local` 文件是否存在
   - 确认 `OPENAI_API_KEY` 已正确设置
   - 重启开发服务器

2. **API调用失败**
   - 验证API密钥是否有效
   - 检查账户余额是否充足
   - 确认网络连接正常

3. **分析结果为空**
   - 检查输入的文本是否有效
   - 确认文本长度适中（建议100-5000字）
   - 查看控制台错误信息

### 调试步骤

1. 访问 `/api/health` 检查服务状态
2. 访问 `/api/test` 验证环境变量配置
3. 查看浏览器控制台和服务器日志
4. 检查网络请求的详细信息

## 📖 详细配置

更多配置选项和故障排除指南，请查看 [SETUP.md](./SETUP.md)。

## 🤝 贡献

欢迎提交Issue和Pull Request！

## �� 许可证

MIT License
