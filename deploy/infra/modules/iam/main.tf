variable "app_name" {}
variable "environment" {}
variable "ssm_path_prefix" {}

resource "aws_iam_role" "task_execution" {
  name = "${var.app_name}-${var.environment}-ecs-exec"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{ Action = "sts:AssumeRole", Effect = "Allow", Principal = { Service = "ecs-tasks.amazonaws.com" } }]
  })
}

resource "aws_iam_role_policy_attachment" "exec_base" {
  role       = aws_iam_role.task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

resource "aws_iam_role_policy" "ssm_access" {
  name = "${var.app_name}-${var.environment}-ssm-access"
  role = aws_iam_role.task_execution.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["ssm:GetParameter", "ssm:GetParameters", "ssm:GetParametersByPath"]
      Resource = "arn:aws:ssm:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:parameter${var.ssm_path_prefix}/*"
    }]
  })
}

# Allow decrypt of SSM SecureString parameters used by this app path
resource "aws_iam_role_policy" "ssm_kms_decrypt" {
  name = "${var.app_name}-${var.environment}-ssm-kms-decrypt"
  role = aws_iam_role.task_execution.id
  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{
      Effect: "Allow",
      Action: ["kms:Decrypt"],
      Resource: "*",
      Condition: {
        StringEquals: {
          "kms:ViaService": "ssm.${data.aws_region.current.name}.amazonaws.com"
        },
        StringLike: {
          "kms:EncryptionContext:aws:ssm:parameter-name": "${var.ssm_path_prefix}/*"
        }
      }
    }]
  })
}

resource "aws_iam_role" "task" {
  name = "${var.app_name}-${var.environment}-ecs-task"
  assume_role_policy = aws_iam_role.task_execution.assume_role_policy
}

output "execution_role_arn" { value = aws_iam_role.task_execution.arn }
output "task_role_arn" { value = aws_iam_role.task.arn }
