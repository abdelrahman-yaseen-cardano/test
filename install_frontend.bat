@echo off
SET PATH=C:\Program Files (x86)\blp\bqnt\environments\bqnt-3;%PATH%
cd /d C:\projects\loop-engine\frontend
echo Starting npm install...
npm install
echo.
echo EXIT CODE: %ERRORLEVEL%
if exist node_modules (
    echo node_modules created successfully
) else (
    echo FAILED: node_modules not found
)
pause
