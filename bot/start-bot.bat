@echo off
chcp 65001 >nul
echo.
echo  ============================================
echo    قطة الدوام - بوت تيليقرام
echo  ============================================
echo.

where node >nul 2>&1
if %errorlevel% neq 0 (
  echo  خطأ: Node.js غير مثبت. حمله من nodejs.org
  pause & exit /b 1
)

if not exist node_modules (
  echo  جاري تثبيت المتطلبات...
  call npm install
  echo.
)

if not exist .env (
  echo  أنشئ ملف .env وأضف:
  echo  BOT_TOKEN=your_token_here
  echo  CLAUDE_API_KEY=your_key_here
  echo.
  echo  ثم شغّل الملف مجدداً.
  pause & exit /b 1
)

echo  جاري تشغيل البوت...
echo.
node index.js
pause
