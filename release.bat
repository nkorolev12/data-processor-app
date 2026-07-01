@echo off
setlocal
chcp 65001 >nul
echo ========================================================
echo Data Processor - Релиз новой версии
echo ========================================================
echo.
echo ВНИМАНИЕ: Убедитесь, что приложение сейчас ЗАКРЫТО.
echo.

:: Получаем текущую версию из package.json через Node.js
for /f "delims=" %%i in ('node -p "require('./package.json').version"') do set CUR_VER=%%i
echo Текущая версия: %CUR_VER%
echo.

set /p NEW_VER="Введите НОВУЮ версию (например, 1.0.1) и нажмите Enter: "
if "%NEW_VER%"=="" (
    echo.
    echo Версия не введена. Отмена.
    pause
    exit /b
)

echo.
echo 1. Обновляем версию до %NEW_VER% в файлах настроек...
call npm version %NEW_VER% --no-git-tag-version >nul

echo.
echo 2. Сохраняем изменения в GitHub...
call git add package.json package-lock.json >nul
call git commit -m "Bump version to v%NEW_VER%" -q >nul
call git push -q

echo.
echo 3. Сборка и отправка релиза %NEW_VER%...
echo Это займет несколько минут, пожалуйста, подождите...
set GH_TOKEN=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
call npm run release

echo.
echo ========================================================
echo ГОТОВО! Релиз v%NEW_VER% успешно загружен на GitHub.
echo Пользователи автоматически обновятся при запуске.
echo ========================================================
pause
