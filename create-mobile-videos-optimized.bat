@echo off
echo 🚀 Creating Mobile-Optimized Shield Break Videos
echo ===============================================

cd /d "%~dp0"

echo.
echo 📁 Current directory: %CD%
echo.

REM Check if FFmpeg is available
ffmpeg -version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ FFmpeg not found! Please install FFmpeg and add it to your PATH.
    echo.
    echo 📥 Download FFmpeg from: https://ffmpeg.org/download.html
    echo 📖 Installation guide: https://www.wikihow.com/Install-FFmpeg-on-Windows
    echo.
    pause
    exit /b 1
)

REM Check if source file exists
if not exist "shield_break.mp4" (
    echo ❌ Source file 'shield_break.mp4' not found!
    echo Please make sure the source video file is in the current directory.
    pause
    exit /b 1
)

echo ✅ FFmpeg found and source file exists
echo.

echo 🎬 Creating Mobile-Optimized WebM (Ultra-Light for Mobile)...
echo    - Resolution: 240x180 (smaller for mobile)
echo    - Bitrate: 200k (very low for better performance)
echo    - Codec: VP9 (best compression)
ffmpeg -i shield_break.mp4 -c:v libvpx-vp9 -c:a libvorbis -b:v 200k -b:a 64k -vf "scale=240:180" -y shield_break_mobile.webm

if %errorlevel% neq 0 (
    echo ❌ Failed to create mobile WebM version
    pause
    exit /b 1
)

echo.
echo 🎬 Creating Standard WebM (For Desktop)...
echo    - Resolution: 320x240 (standard size)
echo    - Bitrate: 400k (good quality)
echo    - Codec: VP9
ffmpeg -i shield_break.mp4 -c:v libvpx-vp9 -c:a libvorbis -b:v 400k -b:a 128k -vf "scale=320:240" -y shield_break.webm

if %errorlevel% neq 0 (
    echo ❌ Failed to create standard WebM version
    pause
    exit /b 1
)

echo.
echo 🎬 Creating GIF Fallback (For Low-Performance Devices)...
echo    - Resolution: 200x150 (very small)
echo    - Colors: 64 (reduced for smaller file)
echo    - FPS: 15 (lower frame rate)
ffmpeg -i shield_break.mp4 -vf "scale=200:150,fps=15,palettegen=reserve_transparent=0" palette.png
ffmpeg -i shield_break.mp4 -i palette.png -filter_complex "scale=200:150,fps=15[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=3" -y shield_break.gif

if %errorlevel% neq 0 (
    echo ❌ Failed to create GIF version
    pause
    exit /b 1
)

REM Clean up palette file
del palette.png 2>nul

echo.
echo ✅ All mobile-optimized videos created successfully!
echo.
echo 📁 Files created:
echo    - shield_break_mobile.webm (ultra-light mobile version, 200k bitrate)
echo    - shield_break.webm (standard desktop version, 400k bitrate)
echo    - shield_break.gif (fallback for low-performance devices)
echo.
echo 📊 File sizes:
for %%f in (shield_break_mobile.webm shield_break.webm shield_break.gif) do (
    if exist "%%f" (
        for %%s in ("%%f") do echo    - %%f: %%~zs bytes
    )
)

echo.
echo 🚀 Mobile video optimization complete!
echo 💡 The system will now automatically select the best format based on device performance.
echo.
pause
