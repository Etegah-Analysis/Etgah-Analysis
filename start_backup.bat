@echo off
chcp 65001 >nul
title نسخه من جميع بيانات الداش firbase - جاري التشغيل...
color 0A
echo.
echo  ====================================================
echo   نسخه من جميع بيانات الداش firbase
echo   Firebase Real-Time Backup - Etegah Dashboard
echo  ====================================================
echo.
echo  جاري الاتصال بـ Firebase...
echo.
cd /d "%~dp0"
node backup_firebase.mjs
echo.
echo  تم إيقاف المراقبة.
pause
