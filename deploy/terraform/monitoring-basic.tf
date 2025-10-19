# ============================================================================
# BASIC CLOUDWATCH MONITORING AND ALERTS
# ============================================================================

# SNS Topic for Alerts
resource "aws_sns_topic" "alerts" {
  name = "${var.app_name}-${var.environment}-alerts"

  tags = {
    Name        = "${var.app_name}-${var.environment}-alerts"
    Environment = var.environment
  }
}

# Email subscription for alerts (only if email provided)
resource "aws_sns_topic_subscription" "email" {
  count     = var.alert_email != "" ? 1 : 0
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = var.alert_email
}

# CloudWatch Alarm: ALB Response Time (ECS only)
resource "aws_cloudwatch_metric_alarm" "alb_response_time" {
  count = var.deployment_type == "ecs" ? 1 : 0

  alarm_name          = "${var.app_name}-${var.environment}-alb-response-time"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "TargetResponseTime"
  namespace           = "AWS/ApplicationELB"
  period              = "300"
  statistic           = "Average"
  threshold           = "1"
  alarm_description   = "This metric monitors ALB response time - triggers when >1 second"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions          = [aws_sns_topic.alerts.arn]

  dimensions = {
    LoadBalancer = aws_lb.main[0].arn_suffix
  }

  tags = {
    Name        = "${var.app_name}-${var.environment}-alb-response-time-alarm"
    Environment = var.environment
  }
}

# CloudWatch Alarm: ALB 5XX Errors (ECS only)
resource "aws_cloudwatch_metric_alarm" "alb_5xx_errors" {
  count = var.deployment_type == "ecs" ? 1 : 0

  alarm_name          = "${var.app_name}-${var.environment}-alb-5xx-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "HTTPCode_Target_5XX_Count"
  namespace           = "AWS/ApplicationELB"
  period              = "300"
  statistic           = "Sum"
  threshold           = "5"
  alarm_description   = "This metric monitors ALB 5XX errors - triggers when >5 errors in 5 minutes"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions          = [aws_sns_topic.alerts.arn]
  treat_missing_data  = "notBreaching"

  dimensions = {
    LoadBalancer = aws_lb.main[0].arn_suffix
  }

  tags = {
    Name        = "${var.app_name}-${var.environment}-alb-5xx-errors-alarm"
    Environment = var.environment
  }
}

# CloudWatch Alarm: ECS Backend CPU High (ECS only)
resource "aws_cloudwatch_metric_alarm" "ecs_backend_cpu_high" {
  count = var.deployment_type == "ecs" ? 1 : 0

  alarm_name          = "${var.app_name}-${var.environment}-ecs-backend-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ECS"
  period              = "300"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "This metric monitors ECS backend CPU utilization - triggers when >80%"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions          = [aws_sns_topic.alerts.arn]

  dimensions = {
    ServiceName = aws_ecs_service.backend[0].name
    ClusterName = aws_ecs_cluster.main[0].name
  }

  tags = {
    Name        = "${var.app_name}-${var.environment}-ecs-backend-cpu-alarm"
    Environment = var.environment
  }
}

# CloudWatch Alarm: ECS Backend Memory High (ECS only)
resource "aws_cloudwatch_metric_alarm" "ecs_backend_memory_high" {
  count = var.deployment_type == "ecs" ? 1 : 0

  alarm_name          = "${var.app_name}-${var.environment}-ecs-backend-memory-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "MemoryUtilization"
  namespace           = "AWS/ECS"
  period              = "300"
  statistic           = "Average"
  threshold           = "85"
  alarm_description   = "This metric monitors ECS backend memory utilization - triggers when >85%"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions          = [aws_sns_topic.alerts.arn]

  dimensions = {
    ServiceName = aws_ecs_service.backend[0].name
    ClusterName = aws_ecs_cluster.main[0].name
  }

  tags = {
    Name        = "${var.app_name}-${var.environment}-ecs-backend-memory-alarm"
    Environment = var.environment
  }
}

# CloudWatch Alarm: ECS Backend Service Running Tasks (ECS only)
resource "aws_cloudwatch_metric_alarm" "ecs_backend_running_tasks_low" {
  count = var.deployment_type == "ecs" ? 1 : 0

  alarm_name          = "${var.app_name}-${var.environment}-ecs-backend-tasks-low"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "RunningTaskCount"
  namespace           = "AWS/ECS"
  period              = "300"
  statistic           = "Average"
  threshold           = "1"
  alarm_description   = "This metric monitors ECS backend running tasks - triggers when <1 task running"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions          = [aws_sns_topic.alerts.arn]
  treat_missing_data  = "breaching"

  dimensions = {
    ServiceName = aws_ecs_service.backend[0].name
    ClusterName = aws_ecs_cluster.main[0].name
  }

  tags = {
    Name        = "${var.app_name}-${var.environment}-ecs-backend-tasks-alarm"
    Environment = var.environment
  }
}

# CloudWatch Alarm: EC2 Instance CPU High (EC2 only)
resource "aws_cloudwatch_metric_alarm" "ec2_cpu_high" {
  count = var.deployment_type == "ec2" ? 1 : 0

  alarm_name          = "${var.app_name}-${var.environment}-ec2-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/EC2"
  period              = "300"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "This metric monitors EC2 CPU utilization - triggers when >80%"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions          = [aws_sns_topic.alerts.arn]

  dimensions = {
    InstanceId = aws_instance.app[0].id
  }

  tags = {
    Name        = "${var.app_name}-${var.environment}-ec2-cpu-alarm"
    Environment = var.environment
  }
}

# CloudWatch Alarm: EC2 Status Check Failed (EC2 only)
resource "aws_cloudwatch_metric_alarm" "ec2_status_check_failed" {
  count = var.deployment_type == "ec2" ? 1 : 0

  alarm_name          = "${var.app_name}-${var.environment}-ec2-status-check-failed"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "StatusCheckFailed"
  namespace           = "AWS/EC2"
  period              = "60"
  statistic           = "Average"
  threshold           = "0"
  alarm_description   = "This metric monitors EC2 status checks - triggers when checks fail"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions          = [aws_sns_topic.alerts.arn]

  dimensions = {
    InstanceId = aws_instance.app[0].id
  }

  tags = {
    Name        = "${var.app_name}-${var.environment}-ec2-status-alarm"
    Environment = var.environment
  }
}

# CloudWatch Alarm: RDS CPU High
resource "aws_cloudwatch_metric_alarm" "rds_cpu_high" {
  alarm_name          = "${var.app_name}-${var.environment}-rds-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/RDS"
  period              = "300"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "This metric monitors RDS CPU utilization - triggers when >80%"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions          = [aws_sns_topic.alerts.arn]

  dimensions = {
    DBInstanceIdentifier = module.rds.db_instance_identifier
  }

  tags = {
    Name        = "${var.app_name}-${var.environment}-rds-cpu-alarm"
    Environment = var.environment
  }
}

# CloudWatch Alarm: RDS Database Connections High
resource "aws_cloudwatch_metric_alarm" "rds_connections_high" {
  alarm_name          = "${var.app_name}-${var.environment}-rds-connections-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "DatabaseConnections"
  namespace           = "AWS/RDS"
  period              = "300"
  statistic           = "Average"
  threshold           = "15" # t3.micro has max ~20 connections
  alarm_description   = "This metric monitors RDS database connections - triggers when >15 connections"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions          = [aws_sns_topic.alerts.arn]

  dimensions = {
    DBInstanceIdentifier = module.rds.db_instance_identifier
  }

  tags = {
    Name        = "${var.app_name}-${var.environment}-rds-connections-alarm"
    Environment = var.environment
  }
}

# CloudWatch Alarm: RDS Free Storage Space Low
resource "aws_cloudwatch_metric_alarm" "rds_free_storage_low" {
  alarm_name          = "${var.app_name}-${var.environment}-rds-storage-low"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "FreeStorageSpace"
  namespace           = "AWS/RDS"
  period              = "300"
  statistic           = "Average"
  threshold           = "2147483648" # 2GB in bytes
  alarm_description   = "This metric monitors RDS free storage space - triggers when <2GB remaining"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions          = [aws_sns_topic.alerts.arn]

  dimensions = {
    DBInstanceIdentifier = module.rds.db_instance_identifier
  }

  tags = {
    Name        = "${var.app_name}-${var.environment}-rds-storage-alarm"
    Environment = var.environment
  }
}
