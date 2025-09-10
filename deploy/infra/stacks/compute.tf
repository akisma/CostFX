module "ecs" {
  count                  = var.create_ecs ? 1 : 0
  source                 = "./modules/ecs"
  app_name               = var.app_name
  environment            = var.environment
  vpc_id                 = module.network.vpc_id
  subnet_ids             = module.network.public_subnet_ids
  backend_image          = var.backend_image
  frontend_image         = var.frontend_image
  desired_backend_count  = var.desired_backend_count
  desired_frontend_count = var.desired_frontend_count
  alb_listener_arn       = module.alb.http_listener_arn
  backend_target_group_arn = module.alb.backend_tg_arn
  frontend_target_group_arn = module.alb.frontend_tg_arn
  execution_role_arn     = module.iam.execution_role_arn
  task_role_arn          = module.iam.task_role_arn
  log_group_name         = "/ecs/${var.app_name}-${var.environment}"
  log_retention_days     = var.log_retention_days
  ssm_path_prefix        = local.ssm_path_prefix
}
