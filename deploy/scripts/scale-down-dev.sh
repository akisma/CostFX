# Development Cost Optimization Script
# Run this to scale down resources during off-hours

#!/bin/bash

# Scale down ECS services during nights/weekends
aws ecs update-service \
  --cluster costfx-dev-cluster \
  --service costfx-dev-backend \
  --desired-count 0

aws ecs update-service \
  --cluster costfx-dev-cluster \
  --service costfx-dev-frontend \
  --desired-count 0

echo "Services scaled down. Run scale-up.sh when ready to develop."
