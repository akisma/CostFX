output "alb_dns" { value = module.alb.alb_dns }
output "backend_service_name" { value = var.create_ecs ? module.ecs[0].backend_service_name : null }
output "frontend_service_name" { value = var.create_ecs ? module.ecs[0].frontend_service_name : null }
output "database_endpoint" { value = try(module.rds[0].endpoint, null) sensitive = true }
