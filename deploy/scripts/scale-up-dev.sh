# Development Scale-Up Script  
# Run this when ready to develop

#!/bin/bash

# Scale up ECS services for development
aws ecs update-service \
  --cluster costfx-dev-cluster \
  --service costfx-dev-backend \
  --desired-count 1

aws ecs update-service \
  --cluster costfx-dev-cluster \
  --service costfx-dev-frontend \
  --desired-count 1

echo "Services scaling up. Wait 2-3 minutes for containers to be ready."
echo "Check status: aws ecs describe-services --cluster costfx-dev-cluster --services costfx-dev-backend"
