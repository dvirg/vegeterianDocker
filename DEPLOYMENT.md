# Running the Application Locally and on EC2

This guide explains how to run the application locally without Docker and deploy it to EC2.

## Prerequisites

- Java 17 or higher installed
- Maven 3.6+ installed
- Git (for cloning/updating the repository)

## Running Locally

### 1. Build the Application

```bash
mvn clean package
```

This will create a JAR file in the `target` directory (e.g., `customer-service-0.0.1-SNAPSHOT.jar`).

### 2. Set Environment Variables (Optional)

If you need Telegram integration, create a `.env` file or set environment variables:

**On Windows (Command Prompt):**
```cmd
set TELEGRAM_TOKEN=your_telegram_bot_token
set TELEGRAM_CHAT_ID=your_chat_id
```

**On Windows (PowerShell):**
```powershell
$env:TELEGRAM_TOKEN="your_telegram_bot_token"
$env:TELEGRAM_CHAT_ID="your_chat_id"
```

**On Linux/Mac:**
```bash
export TELEGRAM_TOKEN=your_telegram_bot_token
export TELEGRAM_CHAT_ID=your_chat_id
```

### 3. Run the Application

```bash
java -jar target/customer-service-0.0.1-SNAPSHOT.jar
```

The application will:
- Start on port 8080
- Create a `data` directory in the current folder
- Store the H2 database files in `./data/customerdb.mv.db`

### 4. Access the Application

- **Main Application:** http://localhost:8080
- **H2 Database Console:** http://localhost:8080/h2-console
  - JDBC URL: `jdbc:h2:file:./data/customerdb`
  - Username: `sa`
  - Password: (leave empty)

## Deploying to EC2

### 1. Prepare Your EC2 Instance

Launch an EC2 instance (recommended: Amazon Linux 2023 or Ubuntu 22.04 LTS) and connect via SSH:

```bash
ssh -i your-key.pem ec2-user@your-ec2-ip
```

### 2. Install Java 17

**For Amazon Linux 2023:**
```bash
sudo yum install java-17-amazon-corretto-devel -y
```

**For Ubuntu:**
```bash
sudo apt update
sudo apt install openjdk-17-jdk -y
```

Verify installation:
```bash
java -version
```

### 3. Install Maven (if building on EC2)

**For Amazon Linux 2023:**
```bash
sudo yum install maven -y
```

**For Ubuntu:**
```bash
sudo apt install maven -y
```

### 4. Transfer or Clone Your Application

**Option A: Clone from Git Repository**
```bash
cd ~
git clone https://github.com/your-repo/vegeterianDocker.git
cd vegeterianDocker
```

**Option B: Transfer JAR file using SCP**
```bash
# On your local machine:
scp -i your-key.pem target/customer-service-0.0.1-SNAPSHOT.jar ec2-user@your-ec2-ip:~/
```

### 5. Build the Application (if cloned from Git)

```bash
mvn clean package -DskipTests
```

### 6. Set Environment Variables

Create a `.env` file or set environment variables:

```bash
sudo nano /etc/environment
```

Add:
```
TELEGRAM_TOKEN=your_telegram_bot_token
TELEGRAM_CHAT_ID=your_chat_id
```

Or use export in the startup script.

### 7. Create a Systemd Service (Recommended for Production)

Create a service file:

```bash
sudo nano /etc/systemd/system/customer-service.service
```

Add the following content:

```ini
[Unit]
Description=Customer Service Application
After=network.target

[Service]
Type=simple
User=ec2-user
WorkingDirectory=/home/ec2-user/vegeterianDocker
ExecStart=/usr/bin/java -jar /home/ec2-user/vegeterianDocker/target/customer-service-0.0.1-SNAPSHOT.jar
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=customer-service

# Environment variables (optional)
Environment="TELEGRAM_TOKEN=your_telegram_bot_token"
Environment="TELEGRAM_CHAT_ID=your_chat_id"

[Install]
WantedBy=multi-user.target
```

### 8. Start the Service

```bash
# Reload systemd to recognize the new service
sudo systemctl daemon-reload

# Enable the service to start on boot
sudo systemctl enable customer-service

# Start the service
sudo systemctl start customer-service

# Check status
sudo systemctl status customer-service

# View logs
sudo journalctl -u customer-service -f
```

### 9. Configure Security Group

In AWS Console, configure your EC2 instance's Security Group to allow:
- **Inbound Rule:** Custom TCP, Port 8080, Source: Your IP or 0.0.0.0/0 (for public access)
- **Outbound Rules:** All traffic (default)

### 10. Access Your Application

Access the application at:
```
http://your-ec2-public-ip:8080
```

## Managing the Service

```bash
# Start the service
sudo systemctl start customer-service

# Stop the service
sudo systemctl stop customer-service

# Restart the service
sudo systemctl restart customer-service

# Check status
sudo systemctl status customer-service

# View logs
sudo journalctl -u customer-service -f

# View last 100 lines of logs
sudo journalctl -u customer-service -n 100
```

## Updating the Application

1. Stop the service:
```bash
sudo systemctl stop customer-service
```

2. Pull latest changes (if using Git):
```bash
cd ~/vegeterianDocker
git pull
mvn clean package -DskipTests
```

Or upload new JAR file via SCP.

3. Start the service:
```bash
sudo systemctl start customer-service
```

## Database Backup

The H2 database files are stored in the `data` directory. To backup:

```bash
# Create backup
tar -czf db-backup-$(date +%Y%m%d-%H%M%S).tar.gz data/

# Restore backup
tar -xzf db-backup-YYYYMMDD-HHMMSS.tar.gz
```

## Using Nginx as Reverse Proxy (Optional)

For production, you may want to use Nginx as a reverse proxy:

1. Install Nginx:
```bash
sudo yum install nginx -y  # Amazon Linux
# or
sudo apt install nginx -y  # Ubuntu
```

2. Configure Nginx:
```bash
sudo nano /etc/nginx/conf.d/customer-service.conf
```

Add:
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

3. Start Nginx:
```bash
sudo systemctl enable nginx
sudo systemctl start nginx
```

Now access your application at http://your-ec2-ip (port 80).

## Troubleshooting

### Check if Java is installed
```bash
java -version
```

### Check if the application is running
```bash
sudo netstat -tulpn | grep 8080
```

### View application logs
```bash
sudo journalctl -u customer-service -f
```

### Check disk space
```bash
df -h
```

### Check memory usage
```bash
free -h
