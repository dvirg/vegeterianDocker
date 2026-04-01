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

## CI / GitHub Actions

This repository includes a GitHub Actions workflow that builds the Maven project and publishes a Docker image to GitHub Container Registry (GHCR).

Location: `.github/workflows/ci.yml`

What it does:
- Checks out the code
- Sets up JDK 17 and caches Maven
- Runs `mvn clean package` to build the JAR
- Builds a Docker image using the repository `Dockerfile`
- Pushes the image to GHCR as `ghcr.io/<owner>/customer-service:latest` and `ghcr.io/<owner>/customer-service:<sha>`

Required configuration:
- The workflow uses the built-in `GITHUB_TOKEN` to authenticate to GHCR. Make sure repository permissions allow writing packages (this is usually enabled by default). If you have restricted permissions, enable `packages: write` for workflows in repository settings or provide a PAT with package write scope.

Optional:
- To also publish to Docker Hub, add the following repository secrets in GitHub: `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN`. The workflow will push to Docker Hub only when those secrets are available.

How to trigger:
- Push to `main` or open a pull request targeting `main`. You can also run the workflow manually from the Actions tab in GitHub.

Notes and suggestions:
- The workflow builds and pushes images from the repository root and expects the `Dockerfile` at the project root.
- For production deployments, consider adding an environment tag (e.g., `:prod`) or adding a promotion workflow which only runs on releases or tags.
- If you'd like Actions to also run an integration test using docker-compose, I can add an additional job that runs `docker compose up --build` and runs smoke tests against it, but that increases runner resource/time usage.

### Automatic deployment from GitHub Actions

There is an example deployment workflow at `.github/workflows/deploy.yml` that demonstrates a simple CI->CD flow:

- It builds the JAR with Maven.
- It uses SCP to copy the generated `target/*.jar` to a remote server (EC2 or any SSH-accessible host).
- It runs remote commands over SSH to restart the `customer-service` systemd service (or fall back to starting the jar).

Secrets required (add these in the repository Settings → Secrets → Actions):

- `DEPLOY_HOST` — IP or hostname of your target server (e.g., `1.2.3.4`).
- `DEPLOY_USER` — SSH username (e.g., `ec2-user` or `ubuntu`).
- `DEPLOY_KEY` — SSH private key (PEM) for the user (no passphrase recommended for automation).
- `DEPLOY_PATH` — Remote folder where the JAR should be placed (e.g., `/home/ubuntu/vegeterianDocker`).
- `DEPLOY_PORT` — Optional SSH port (leave empty for default 22).

Notes and suggestions:
- The workflow uses `appleboy/scp-action` and `appleboy/ssh-action` to copy files and run remote commands — no additional setup on the runner is required.
- Before using the workflow, set up a systemd service on the remote host (see `DEPLOYMENT.md`) named `customer-service` or adjust the workflow script to match your service name. Example systemd service content is in `DEPLOYMENT.md` under "Create a Systemd Service".
- The workflow is basic and intended as a starting point. If you prefer to deploy Docker images instead (pull image from GHCR and restart docker-compose), I can switch the workflow to push images to GHCR and remotely run `docker compose pull && docker compose up -d` on the server.

