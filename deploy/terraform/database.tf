# ============================================================================
# RDS PostgreSQL MODULE
# ============================================================================

# Random password for database
resource "random_password" "db_password" {
  length  = 32
  special = true
  # Exclude characters that RDS doesn't allow: / @ " and space
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

module "rds" {
  source = "terraform-aws-modules/rds/aws"

  identifier = "${var.app_name}-${var.environment}-postgres"

  # Engine configuration
  engine               = "postgres"
  engine_version       = "15.12"
  family               = "postgres15"
  major_engine_version = "15"
  instance_class       = var.db_instance_class

  # Storage configuration
  allocated_storage     = var.db_allocated_storage
  max_allocated_storage = var.db_allocated_storage * 2
  storage_type          = "gp2"
  storage_encrypted     = true

  # Database configuration
  db_name  = "restaurant_ai"
  username = "postgres"
  password = random_password.db_password.result
  port     = 5432

  # Network configuration
  create_db_subnet_group = true
  subnet_ids             = module.vpc.private_subnets
  vpc_security_group_ids = [module.rds_security_group.security_group_id]

  # Backup configuration
  backup_retention_period = var.environment == "prod" ? 30 : 7
  backup_window           = "03:00-04:00"
  maintenance_window      = "sun:04:00-sun:05:00"

  # Deletion protection
  skip_final_snapshot = var.environment == "dev" ? true : false
  deletion_protection = var.environment == "prod" ? true : false

  # Monitoring
  performance_insights_enabled          = var.environment == "prod" ? true : false
  performance_insights_retention_period = var.environment == "prod" ? 7 : null
  monitoring_interval                   = var.environment == "prod" ? 60 : 0
  monitoring_role_name                  = var.environment == "prod" ? "${var.app_name}-${var.environment}-rds-monitoring-role" : null
  create_monitoring_role                = var.environment == "prod" ? true : false

  # Enhanced monitoring
  enabled_cloudwatch_logs_exports = ["postgresql", "upgrade"]

  # Parameter group
  create_db_parameter_group = true
  parameter_group_name      = "${var.app_name}-${var.environment}-postgres15"

  parameters = [
    {
      name  = "log_statement"
      value = "all"
    },
    {
      name  = "log_min_duration_statement"
      value = "1000" # Log queries taking longer than 1 second
    }
  ]

  # Option group
  create_db_option_group = false

  tags = {
    Name = "${var.app_name}-${var.environment}-postgres"
  }
}

# ============================================================================
# ELASTICACHE REDIS MODULE - Temporarily disabled for destroy
# ============================================================================

# module "redis" {
#   source = "terraform-aws-modules/elasticache/aws"
#   
#   # Cluster configuration
#   cluster_id               = "${var.app_name}-${var.environment}-redis"
#   replication_group_id     = "${var.app_name}-${var.environment}-redis"
#   description              = "Redis cluster for ${var.app_name} ${var.environment}"
#   
#   # Engine configuration
#   engine          = "redis"
#   node_type       = var.environment == "prod" ? "cache.t3.small" : "cache.t3.micro"
#   port            = 6379
#   parameter_group_name = "default.redis7"
#   
#   # Cluster mode
#   num_cache_nodes = 1
#   
#   # Network configuration
#   subnet_group_name = "${var.app_name}-${var.environment}-redis-subnet-group"
#   subnet_ids        = module.vpc.private_subnets
#   security_group_ids = [module.redis_security_group.security_group_id]
#   
#   # Maintenance
#   maintenance_window         = "sun:05:00-sun:06:00"
#   notification_topic_arn     = null
#   
#   # Backup configuration
#   snapshot_retention_limit = var.environment == "prod" ? 7 : 1
#   snapshot_window         = "06:00-07:00"
#   
#   # Auto minor version upgrade
#   auto_minor_version_upgrade = true
#   
#   tags = {
#     Name = "${var.app_name}-${var.environment}-redis"
#   }
# }
