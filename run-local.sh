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
java -jar target/customer-service-0.0.1-SNAPSHOT.jar
