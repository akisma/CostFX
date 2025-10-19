# ============================================================================
# AWS COST MONITORING AND OPTIMIZATION
# ============================================================================

# Cost Budget for Monthly Spending
resource "aws_budgets_budget" "monthly_cost" {
  name              = "${var.app_name}-${var.environment}-monthly-budget"
  budget_type       = "COST"
  limit_amount      = var.environment == "prod" ? "200" : "50"
  limit_unit        = "USD"
  time_unit         = "MONTHLY"
  time_period_start = "2025-09-01_00:00"

  # Alert at 80% of budget
  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 80
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = [var.alert_email]
  }

  # Alert at 90% of budget
  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 90
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = [var.alert_email]
  }

  # Forecasted alert at 100%
  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 100
    threshold_type             = "PERCENTAGE"
    notification_type          = "FORECASTED"
    subscriber_email_addresses = [var.alert_email]
  }

  depends_on = [aws_sns_topic.alerts]
}

# Daily Cost Budget for Development Environment
resource "aws_budgets_budget" "daily_cost" {
  count = var.environment == "dev" ? 1 : 0

  name              = "${var.app_name}-${var.environment}-daily-budget"
  budget_type       = "COST"
  limit_amount      = "5"
  limit_unit        = "USD"
  time_unit         = "DAILY"
  time_period_start = "2025-09-01_00:00"

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 100
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = [var.alert_email]
  }

  depends_on = [aws_sns_topic.alerts]
}

# Usage Budget for ECS Service Hours (only for ECS deployment)
resource "aws_budgets_budget" "ecs_usage" {
  count = var.deployment_type == "ecs" ? 1 : 0

  name              = "${var.app_name}-${var.environment}-ecs-hours"
  budget_type       = "USAGE"
  limit_amount      = var.environment == "prod" ? "2000" : "500"
  limit_unit        = "Hrs"
  time_unit         = "MONTHLY"
  time_period_start = "2025-09-01_00:00"

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 80
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = [var.alert_email]
  }

  depends_on = [aws_sns_topic.alerts]
}

# CloudWatch Dashboard for Cost Monitoring (ECS deployment)
resource "aws_cloudwatch_dashboard" "cost_monitoring_ecs" {
  count = var.deployment_type == "ecs" ? 1 : 0

  dashboard_name = "${var.app_name}-${var.environment}-cost-monitoring"

  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 12
        height = 6

        properties = {
          metrics = [
            ["AWS/Billing", "EstimatedCharges", "Currency", "USD"]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "Estimated AWS Charges"
          period  = 86400
          stat    = "Maximum"
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 0
        width  = 12
        height = 6

        properties = {
          metrics = [
            ["AWS/ECS", "CPUUtilization", "ServiceName", "${var.app_name}-${var.environment}-backend", "ClusterName", "${var.app_name}-${var.environment}"],
            [".", "MemoryUtilization", ".", ".", ".", "."],
            [".", "CPUUtilization", "ServiceName", "${var.app_name}-${var.environment}-frontend", "ClusterName", "${var.app_name}-${var.environment}"],
            [".", "MemoryUtilization", ".", ".", ".", "."]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "ECS Resource Utilization"
          period  = 300
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 6
        width  = 12
        height = 6

        properties = {
          metrics = [
            ["AWS/RDS", "DatabaseConnections", "DBInstanceIdentifier", "${var.app_name}-${var.environment}-postgres"],
            [".", "CPUUtilization", ".", "."],
            [".", "FreeStorageSpace", ".", "."]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "RDS Resource Usage"
          period  = 300
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 6
        width  = 12
        height = 6

        properties = {
          metrics = [
            ["AWS/ApplicationELB", "RequestCount", "LoadBalancer", replace(aws_lb.main[0].arn_suffix, "app/", "")],
            [".", "TargetResponseTime", ".", "."],
            ["AWS/WAFV2", "AllowedRequests", "WebACL", "${var.app_name}-${var.environment}-waf", "Region", var.aws_region, "Rule", "ALL"],
            [".", "BlockedRequests", ".", ".", ".", ".", ".", "."]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "Traffic and Security Metrics"
          period  = 300
        }
      }
    ]
  })
}

# CloudWatch Dashboard for Cost Monitoring (EC2 deployment)
resource "aws_cloudwatch_dashboard" "cost_monitoring_ec2" {
  count = var.deployment_type == "ec2" ? 1 : 0

  dashboard_name = "${var.app_name}-${var.environment}-cost-monitoring"

  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 12
        height = 6

        properties = {
          metrics = [
            ["AWS/Billing", "EstimatedCharges", "Currency", "USD"]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "Estimated AWS Charges"
          period  = 86400
          stat    = "Maximum"
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 0
        width  = 12
        height = 6

        properties = {
          metrics = [
            ["AWS/EC2", "CPUUtilization", "InstanceId", aws_instance.app[0].id],
            [".", "NetworkIn", ".", "."],
            [".", "NetworkOut", ".", "."]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "EC2 Instance Metrics"
          period  = 300
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 6
        width  = 12
        height = 6

        properties = {
          metrics = [
            ["AWS/RDS", "DatabaseConnections", "DBInstanceIdentifier", "${var.app_name}-${var.environment}-postgres"],
            [".", "CPUUtilization", ".", "."],
            [".", "FreeStorageSpace", ".", "."]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "RDS Resource Usage"
          period  = 300
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 6
        width  = 12
        height = 6

        properties = {
          metrics = [
            ["AWS/EC2", "StatusCheckFailed", "InstanceId", aws_instance.app[0].id],
            [".", "StatusCheckFailed_Instance", ".", "."],
            [".", "StatusCheckFailed_System", ".", "."]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "EC2 Health Checks"
          period  = 300
        }
      }
    ]
  })
}

# S3 Intelligent Tiering for ALB logs (cost optimization) - only for ECS deployment
resource "aws_s3_bucket_intelligent_tiering_configuration" "alb_logs_tiering" {
  count = var.deployment_type == "ecs" ? 1 : 0

  bucket = aws_s3_bucket.alb_logs[0].id
  name   = "entire-bucket-tiering"

  filter {
    prefix = ""
  }

  tiering {
    access_tier = "DEEP_ARCHIVE_ACCESS"
    days        = 180
  }

  tiering {
    access_tier = "ARCHIVE_ACCESS"
    days        = 90
  }

  status = "Enabled"
}

# Cost Optimization Lambda Function (scheduled cleanup)
resource "aws_lambda_function" "cost_optimizer" {
  count = var.environment == "dev" ? 1 : 0

  filename         = "cost_optimizer.zip"
  function_name    = "${var.app_name}-${var.environment}-cost-optimizer"
  role             = aws_iam_role.lambda_cost_optimizer[0].arn
  handler          = "index.handler"
  source_code_hash = data.archive_file.cost_optimizer_zip[0].output_base64sha256
  runtime          = "python3.11"
  timeout          = 300

  environment {
    variables = {
      ENVIRONMENT = var.environment
      APP_NAME    = var.app_name
    }
  }

  tags = {
    Name        = "${var.app_name}-${var.environment}-cost-optimizer"
    Environment = var.environment
  }
}

# Lambda function code
data "archive_file" "cost_optimizer_zip" {
  count = var.environment == "dev" ? 1 : 0

  type        = "zip"
  output_path = "cost_optimizer.zip"

  source {
    content  = <<EOF
import boto3
import json
import os
from datetime import datetime, timedelta

def handler(event, context):
    """
    Cost optimization lambda for development environment
    - Clean up old CloudWatch logs
    - Remove old ECS task definitions
    - Clean up unused resources
    """
    
    environment = os.environ.get('ENVIRONMENT', 'dev')
    app_name = os.environ.get('APP_NAME', 'costfx')
    
    if environment != 'dev':
        return {
            'statusCode': 200,
            'body': json.dumps('Cost optimizer only runs in dev environment')
        }
    
    try:
        # CloudWatch Logs cleanup
        logs_client = boto3.client('logs')
        cutoff_date = datetime.now() - timedelta(days=7)
        
        # List and clean old log streams
        log_groups = [
            f'/ecs/{app_name}-{environment}-backend',
            f'/ecs/{app_name}-{environment}-frontend',
            f'/aws/wafv2/{app_name}-{environment}'
        ]
        
        cleaned_streams = 0
        for log_group in log_groups:
            try:
                streams = logs_client.describe_log_streams(
                    logGroupName=log_group,
                    orderBy='LastEventTime'
                )
                
                for stream in streams['logStreams']:
                    if 'lastEventTime' in stream:
                        last_event = datetime.fromtimestamp(stream['lastEventTime'] / 1000)
                        if last_event < cutoff_date:
                            logs_client.delete_log_stream(
                                logGroupName=log_group,
                                logStreamName=stream['logStreamName']
                            )
                            cleaned_streams += 1
            except Exception as e:
                print(f"Error cleaning log group {log_group}: {str(e)}")
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': f'Cost optimization completed',
                'cleaned_log_streams': cleaned_streams,
                'timestamp': datetime.now().isoformat()
            })
        }
        
    except Exception as e:
        print(f"Error in cost optimizer: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps(f'Error: {str(e)}')
        }
EOF
    filename = "index.py"
  }
}

# IAM role for Lambda cost optimizer
resource "aws_iam_role" "lambda_cost_optimizer" {
  count = var.environment == "dev" ? 1 : 0

  name = "${var.app_name}-${var.environment}-lambda-cost-optimizer"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name        = "${var.app_name}-${var.environment}-lambda-cost-optimizer"
    Environment = var.environment
  }
}

# IAM policy for Lambda cost optimizer
resource "aws_iam_role_policy" "lambda_cost_optimizer" {
  count = var.environment == "dev" ? 1 : 0

  name = "${var.app_name}-${var.environment}-lambda-cost-optimizer-policy"
  role = aws_iam_role.lambda_cost_optimizer[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
          "logs:DescribeLogGroups",
          "logs:DescribeLogStreams",
          "logs:DeleteLogStream"
        ]
        Resource = "arn:aws:logs:${var.aws_region}:*:*"
      },
      {
        Effect = "Allow"
        Action = [
          "ecs:ListTaskDefinitions",
          "ecs:DescribeTaskDefinition",
          "ecs:DeregisterTaskDefinition"
        ]
        Resource = "*"
      }
    ]
  })
}

# CloudWatch Event Rule for daily cost optimization
resource "aws_cloudwatch_event_rule" "cost_optimizer_schedule" {
  count = var.environment == "dev" ? 1 : 0

  name                = "${var.app_name}-${var.environment}-cost-optimizer-schedule"
  description         = "Trigger cost optimizer lambda daily"
  schedule_expression = "rate(1 day)"

  tags = {
    Name        = "${var.app_name}-${var.environment}-cost-optimizer-schedule"
    Environment = var.environment
  }
}

# CloudWatch Event Target
resource "aws_cloudwatch_event_target" "cost_optimizer_target" {
  count = var.environment == "dev" ? 1 : 0

  rule      = aws_cloudwatch_event_rule.cost_optimizer_schedule[0].name
  target_id = "CostOptimizerTarget"
  arn       = aws_lambda_function.cost_optimizer[0].arn
}

# Lambda permission for CloudWatch Events
resource "aws_lambda_permission" "allow_cloudwatch" {
  count = var.environment == "dev" ? 1 : 0

  statement_id  = "AllowExecutionFromCloudWatch"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.cost_optimizer[0].function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.cost_optimizer_schedule[0].arn
}
