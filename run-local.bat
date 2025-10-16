@echo off
REM Run the Spring Boot application locally on Windows
REM This script builds and runs the application with the H2 database

echo ================================
echo Building the application...
echo ================================

REM Build the application
REM Load environment variables from .env if present (simple parser)
if exist .env (
    echo Loading environment variables from .env
    for /f "usebackq tokens=1,* delims==" %%A in (`type .env`) do (
        set "%%A=%%B"
    )
)

call mvn clean package -DskipTests

if %ERRORLEVEL% neq 0 (
    echo Build failed! Please check for errors.
    exit /b 1
)

echo.
echo ================================
echo Starting the application...
echo ================================
echo Application will be available at: http://localhost:8080
echo H2 Console will be available at: http://localhost:8080/h2-console
echo   - JDBC URL: jdbc:h2:file:./data/customerdb
echo   - Username: sa
echo   - Password: (leave empty)
echo.
echo Press Ctrl+C to stop the application
echo ================================
echo.

REM Run the application
REM Run the application with current environment variables (TELEGRAM_TOKEN/CHAT_ID will be available if loaded above)
java -jar target\customer-service-0.0.1-SNAPSHOT.jar
