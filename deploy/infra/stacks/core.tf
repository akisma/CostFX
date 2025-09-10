module "network" {
  source      = "./modules/network"
  app_name    = var.app_name
  environment = var.environment
}

module "iam" {
  source      = "./modules/iam"
  app_name    = var.app_name
  environment = var.environment
  ssm_path_prefix = local.ssm_path_prefix
}

module "ecr" {
  source      = "./modules/ecr"
  app_name    = var.app_name
  environment = var.environment
}

module "alb" {
  source          = "./modules/alb"
  app_name        = var.app_name
  environment     = var.environment
  vpc_id          = module.network.vpc_id
  public_subnet_ids = module.network.public_subnet_ids
  enable_https    = var.enable_https
  certificate_arn = null # future override via tfvars
}
