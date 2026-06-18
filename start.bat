@echo off
chcp 65001 >nul
echo.
echo  ========================================
echo    قطة الدوام - بدء التشغيل
echo  ========================================
echo.

where node >nul 2>&1
if %errorlevel% neq 0 (
  echo  خطأ: Node.js غير مثبت على جهازك
  echo  حمله من: https://nodejs.org
  pause
  exit /b 1
)

if not exist node_modules (
  echo  جاري تثبيت المتطلبات...
  call npm install
  echo.
)

echo  جاري تشغيل السيرفر...
echo.
node server.js
pause
