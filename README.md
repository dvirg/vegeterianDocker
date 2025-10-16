# Customer Service (Spring Boot + H2 Database)

This repository contains a Spring Boot microservice with a Thymeleaf web UI.
It stores customer data in a local H2 file-based database. The application can be run 
locally without Docker or deployed using Docker Compose.

## Features
- Customer entity with columns: id (UUID), userId, name, phones, address, email, defaultPackage, metadata
- Order management system
- Item catalog management
- CRUD UI implemented with Thymeleaf
- H2 file-based database (no external database server required)
- H2 Console for database management
- Excel import/export functionality
- Telegram integration support

## Prerequisites
- Java 17 or higher
- Maven 3.6+

## Quick Start - Local Execution (Recommended)

### Option 1: Using the provided scripts

**On Windows:**
```cmd
run-local.bat
```

**On Linux/Mac:**
```bash
chmod +x run-local.sh
./run-local.sh
```

### Option 2: Manual execution

1. Build the application:
```bash
mvn clean package
```

2. Run the application:
```bash
java -jar target/customer-service-0.0.1-SNAPSHOT.jar
```

3. Access the application:
- **Main Application:** http://localhost:8080
- **H2 Database Console:** http://localhost:8080/h2-console
  - JDBC URL: `jdbc:h2:file:./data/customerdb`
  - Username: `sa`
  - Password: (leave empty)

## Running with Docker Compose (Optional)

If you prefer to use Docker:

1. Build and start services:
```bash
docker compose up --build
```

2. Access the application at http://localhost:8080

## Database

The application uses H2, a lightweight file-based database:
- Database files are stored in the `./data` directory
- Data persists between application restarts
- No separate database server required
- H2 Console available for direct database access at `/h2-console`

## Deployment to EC2

For detailed instructions on deploying this application to AWS EC2, see [DEPLOYMENT.md](DEPLOYMENT.md).

The deployment guide includes:
- Setting up Java and Maven on EC2
- Creating a systemd service
- Configuring Nginx as reverse proxy
- Database backup procedures
- Production best practices

## Environment Variables

Optional environment variables for Telegram integration:
- `TELEGRAM_TOKEN` - Your Telegram bot token
- `TELEGRAM_CHAT_ID` - Your Telegram chat ID

## Notes
- The application uses Spring JPA with `hibernate.ddl-auto=update` for development convenience
- Database files in the `./data` directory should be backed up regularly
- The H2 console is enabled by default - disable it in production by setting `spring.h2.console.enabled=false`
- For production deployment, see [DEPLOYMENT.md](DEPLOYMENT.md) for security best practices
