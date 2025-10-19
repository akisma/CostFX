#!/bin/bash
# User data script for EC2 simplified deployment
# This script sets up Docker and runs the CostFX application containers

set -e

# Logging
exec > >(tee /var/log/user-data.log)
exec 2>&1

echo "=== Starting CostFX EC2 Setup ==="
echo "Environment: ${environment}"
echo "Region: ${aws_region}"

# Update the system
echo "Updating system packages..."
dnf update -y

# Install Docker
echo "Installing Docker..."
dnf install -y docker

# Start and enable Docker
systemctl start docker
systemctl enable docker

# Add ec2-user to docker group
usermod -a -G docker ec2-user

# Install Docker Compose
echo "Installing Docker Compose..."
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Install AWS CLI v2 (if not already installed)
echo "Installing AWS CLI..."
if ! command -v aws &> /dev/null; then
    curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
    dnf install -y unzip
    unzip -q awscliv2.zip
    ./aws/install
    rm -rf aws awscliv2.zip
fi

# Install CloudWatch agent
echo "Installing CloudWatch agent..."
wget -q https://s3.amazonaws.com/amazoncloudwatch-agent/amazon_linux/amd64/latest/amazon-cloudwatch-agent.rpm
rpm -U ./amazon-cloudwatch-agent.rpm
rm -f amazon-cloudwatch-agent.rpm

# Configure CloudWatch agent
echo "Configuring CloudWatch agent..."
cat > /opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json << 'EOF'
{
  "metrics": {
    "namespace": "CostFX/EC2",
    "metrics_collected": {
      "cpu": {
        "measurement": [
          {"name": "cpu_usage_idle", "rename": "CPU_IDLE", "unit": "Percent"},
          {"name": "cpu_usage_iowait", "rename": "CPU_IOWAIT", "unit": "Percent"}
        ],
        "metrics_collection_interval": 60,
        "totalcpu": false
      },
      "disk": {
        "measurement": [
          {"name": "used_percent", "rename": "DISK_USED", "unit": "Percent"}
        ],
        "metrics_collection_interval": 60,
        "resources": ["*"]
      },
      "mem": {
        "measurement": [
          {"name": "mem_used_percent", "rename": "MEM_USED", "unit": "Percent"}
        ],
        "metrics_collection_interval": 60
      }
    }
  },
  "logs": {
    "logs_collected": {
      "files": {
        "collect_list": [
          {
            "file_path": "/var/log/user-data.log",
            "log_group_name": "${log_group}",
            "log_stream_name": "user-data"
          },
          {
            "file_path": "/var/log/docker-app.log",
            "log_group_name": "${log_group}",
            "log_stream_name": "docker-app"
          }
        ]
      }
    }
  }
}
EOF

# Start CloudWatch agent
/opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
    -a fetch-config \
    -m ec2 \
    -c file:/opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json \
    -s

# Install and enable SSM agent (should be pre-installed on Amazon Linux 2023)
echo "Ensuring SSM agent is running..."
systemctl start amazon-ssm-agent
systemctl enable amazon-ssm-agent

# Login to ECR
echo "Logging in to ECR..."
aws ecr get-login-password --region ${aws_region} | docker login --username AWS --password-stdin ${backend_image%%/*}

# Pull Docker images
echo "Pulling Docker images..."
docker pull ${backend_image}
docker pull ${frontend_image}

# Get secrets from SSM Parameter Store
echo "Retrieving secrets from SSM Parameter Store..."
JWT_SECRET=$(aws ssm get-parameter --name "/${app_name}/${environment}/jwt_secret" --with-decryption --query 'Parameter.Value' --output text --region ${aws_region})
OPENAI_API_KEY=$(aws ssm get-parameter --name "/${app_name}/${environment}/openai_api_key" --with-decryption --query 'Parameter.Value' --output text --region ${aws_region})
DB_PASSWORD=$(aws ssm get-parameter --name "/${app_name}/${environment}/db_password" --with-decryption --query 'Parameter.Value' --output text --region ${aws_region})
DATABASE_URL=$(aws ssm get-parameter --name "/${app_name}/${environment}/database_url" --with-decryption --query 'Parameter.Value' --output text --region ${aws_region})

# Get instance public IP
INSTANCE_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)

# Create application directory
mkdir -p /opt/costfx
cd /opt/costfx

# Create Docker Compose file
echo "Creating Docker Compose configuration..."
cat > docker-compose.yml << EOF
version: '3.8'

services:
  backend:
    image: ${backend_image}
    container_name: costfx-backend
    restart: unless-stopped
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=${environment}
      - PORT=3001
      - DATABASE_URL=$${DATABASE_URL}
      - JWT_SECRET=$${JWT_SECRET}
      - OPENAI_API_KEY=$${OPENAI_API_KEY}
      - DB_SSL=true
      - PGSSLMODE=require
      - DB_POOL_MIN=2
      - DB_POOL_MAX=10
      - FRONTEND_URL=http://$${INSTANCE_IP}
      - CORS_ORIGINS=http://$${INSTANCE_IP},https://$${INSTANCE_IP}
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"

  frontend:
    image: ${frontend_image}
    container_name: costfx-frontend
    restart: unless-stopped
    ports:
      - "80:80"
    environment:
      - NODE_ENV=production
    depends_on:
      - backend
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:80/health"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 20s
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"
EOF

# Create .env file with secrets
cat > .env << ENVEOF
DATABASE_URL=$DATABASE_URL
JWT_SECRET=$JWT_SECRET
OPENAI_API_KEY=$OPENAI_API_KEY
INSTANCE_IP=$INSTANCE_IP
ENVEOF

# Secure the .env file
chmod 600 .env

# Start the application
echo "Starting CostFX application..."
docker-compose up -d 2>&1 | tee -a /var/log/docker-app.log

# Wait for services to be healthy
echo "Waiting for services to start..."
sleep 30

# Check service health
echo "Checking service health..."
docker-compose ps

# Test backend health
if curl -f http://localhost:3001/health > /dev/null 2>&1; then
    echo "✅ Backend is healthy"
else
    echo "⚠️ Backend health check failed"
fi

# Test frontend health
if curl -f http://localhost/health > /dev/null 2>&1; then
    echo "✅ Frontend is healthy"
else
    echo "⚠️ Frontend health check failed"
fi

# Create a systemd service for the application (ensures restart on reboot)
cat > /etc/systemd/system/costfx.service << 'SERVICEEOF'
[Unit]
Description=CostFX Docker Compose Application
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/costfx
ExecStart=/usr/local/bin/docker-compose up -d
ExecStop=/usr/local/bin/docker-compose down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
SERVICEEOF

# Enable the service
systemctl daemon-reload
systemctl enable costfx.service

echo "=== CostFX EC2 Setup Complete ==="
echo "Application URL: http://$INSTANCE_IP"
echo "Backend API: http://$INSTANCE_IP:3001/api/v1"
echo ""
echo "To view logs:"
echo "  docker-compose logs -f"
echo ""
echo "To restart services:"
echo "  systemctl restart costfx"
