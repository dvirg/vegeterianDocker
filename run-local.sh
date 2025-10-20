#!/bin/bash

# Run the Spring Boot application locally
# This script builds and runs the application with the H2 database

echo "================================"
echo "Building the application..."
echo "================================"

# Build the application
mvn_clean() {
    mvn clean package -DskipTests
}

# If .env exists, export its variables into the environment (ignore comments and blank lines)
if [ -f .env ]; then
    echo "Loading environment variables from .env"
    set -a
    # shellcheck disable=SC1091
    # Use a subshell to filter out comments and blank lines then source
    export $(grep -v '^#' .env | xargs)
    set +a
fi

mvn_clean

if [ $? -ne 0 ]; then
    echo "Build failed! Please check for errors."
    exit 1
fi

echo ""
echo "================================"
echo "Starting the application..."
echo "================================"
echo "Application will be available at: http://localhost:8080"
echo "H2 Console will be available at: http://localhost:8080/h2-console"
echo "  - JDBC URL: jdbc:h2:file:./data/customerdb"
echo "  - Username: sa"
echo "  - Password: (leave empty)"
echo ""
echo "Press Ctrl+C to stop the application"
echo "================================"
echo ""

# Run the application
# Usage: ./run-local.sh [detach|-d|detach]

DETACH=false
if [ "$1" = "-d" ] || [ "$1" = "detach" ] || [ "$DETACH" = "true" ]; then
    DETACH=true
fi

JAR=target/customer-service-0.0.1-SNAPSHOT.jar
LOGDIR=logs
LOGFILE="$LOGDIR/app.log"

mkdir -p "$LOGDIR"

if [ "$DETACH" = "true" ]; then
    echo "Starting application in detached/background mode..."
    echo "Logs will be written to: $LOGFILE"

    # Prefer nohup, fall back to setsid, then background with disown if available
    if command -v nohup >/dev/null 2>&1; then
        nohup java -jar "$JAR" > "$LOGFILE" 2>&1 &
        PID=$!
    elif command -v setsid >/dev/null 2>&1; then
        setsid java -jar "$JAR" > "$LOGFILE" 2>&1 &
        PID=$!
    else
        # Background process; attempt to disown if shell supports it
        java -jar "$JAR" > "$LOGFILE" 2>&1 &
        PID=$!
        if command -v disown >/dev/null 2>&1; then
            disown $PID >/dev/null 2>&1 || true
        fi
    fi

    # Save PID
    if [ -n "$PID" ]; then
        echo $PID > run-local.pid
        echo "Application started (detached) with PID $PID"
        echo "To stop: kill $PID";
    else
        echo "Failed to start detached process. Check $LOGFILE for details."
        exit 1
    fi
else
    # Run in foreground (default)
    java -jar "$JAR"
fi
