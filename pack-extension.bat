@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo Building extension...
call npm run build:extension
if errorlevel 1 (
    echo Build failed.
    pause
    exit /b 1
)

echo Waiting for file handles to release...
timeout /t 2 /nobreak >nul
echo Creating DesignLog-extension.zip ...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Compress-Archive -Path 'dist' -DestinationPath 'DesignLog-extension.zip' -Force"

if exist DesignLog-extension.zip (
    echo.
    echo Done: %cd%\DesignLog-extension.zip
    echo Recipient: unzip and load the "dist" folder in chrome://extensions
) else (
    echo Zip creation failed.
)

pause
