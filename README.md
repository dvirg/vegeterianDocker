# Customer Service (Spring Boot + MySQL + Docker Compose)

This repository contains a minimal Spring Boot microservice with a Thymeleaf web UI.
It stores customers in a MySQL database. The project is dockerized and can be run using
docker-compose.

Features:
- Customer entity with columns: id (UUID), userId, name, phones, address, email, defaultPackage, metadata
- CRUD UI implemented with Thymeleaf
- Dockerfile and docker-compose.yml to run MySQL + the app

Quick start

1. Build the application jar:

```powershell
mvn -DskipTests package
```

2. Start services with Docker Compose:

```powershell
docker compose up --build
```

3. Open http://localhost:8080/customers to view the UI

Notes
- The application uses Spring JPA with hibernate.ddl-auto=update for development convenience.
- For production, change the database credentials and remove `ddl-auto: update`.
