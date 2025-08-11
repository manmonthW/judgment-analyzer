@echo off
echo 🚀 启动判决书分析器...

REM 检查是否存在 .env.local 文件
if not exist ".env.local" (
    echo ⚠️  未找到 .env.local 文件
    echo 📝 请按照以下步骤配置环境变量：
    echo.
    echo 1. 在项目根目录创建 .env.local 文件
    echo 2. 添加以下内容：
    echo    OPENAI_API_KEY=your_openai_api_key_here
    echo    OPENAI_MODEL=gpt-4o-mini
    echo.
    echo 3. 获取 OpenAI API 密钥：
    echo    - 访问 https://platform.openai.com/api-keys
    echo    - 创建新的 API 密钥
    echo    - 将密钥添加到 .env.local 文件
    echo.
    echo 📖 详细配置指南请查看 SETUP.md 文件
    echo.
    set /p continue="是否继续启动开发服务器？(y/n): "
    if /i not "%continue%"=="y" exit /b 1
)

REM 检查是否安装了依赖
if not exist "node_modules" (
    echo 📦 安装依赖...
    npm install
)

REM 启动开发服务器
echo 🌐 启动开发服务器...
npm run dev 