@echo off
echo Creating mobile-optimized shield break videos...
echo.

cd /d "%~dp0public\bingo-v37"

echo Checking if shield_break.mp4 exists...
if not exist "shield_break.mp4" (
    echo ERROR: shield_break.mp4 not found!
    echo Please make sure the original video file exists.
    pause
    exit /b 1
)

echo Creating WebM version (VP9 - default format for all devices)...
ffmpeg -i shield_break.mp4 -c:v libvpx-vp9 -c:a libvorbis -b:v 400k -b:a 128k -vf "scale=320:240" -y shield_break.webm

echo Creating optimized GIF fallback...
ffmpeg -i shield_break.mp4 -vf "fps=10,scale=240:-1:flags=lanczos,palettegen" -y palette.png
ffmpeg -i shield_break.mp4 -i palette.png -filter_complex "fps=10,scale=240:-1:flags=lanczos[x];[x][1:v]paletteuse" -y shield_break.gif

echo Cleaning up temporary files...
del palette.png

echo.
echo ✅ WebM-optimized videos created successfully!
echo 📁 Files created:
echo    - shield_break.webm (default format for all devices, 6x speed)
echo    - shield_break.gif (fallback for unsupported browsers)
echo.
echo 🚀 Your WebM video optimization is ready!
pause
