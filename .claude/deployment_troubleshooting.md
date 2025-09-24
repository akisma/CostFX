# CostFX Deployment Troubleshooting Guide
*Common deployment issues and their solutions*

**Last Updated**: September 19, 2025  
**Context**: GitHub Actions OIDC deployment to AWS ECS

---

## 🚨 Critical Deployment Issues & Solutions

### **Issue 1: SSM Parameter Access Denied**

#### **Error Signature:**
```
An error occurred (AccessDeniedException) when calling the GetParameter operation: 
User: arn:aws:sts::568530517605:assumed-role/GitHubActionsRole-CostFX/GitHubActions 
is not authorized to perform: ssm:GetParameter on resource: 
arn:aws:ssm:us-west-2:568530517605:parameter/costfx/dev/database/url 
because no identity-based policy allows the ssm:GetParameter action
```

#### **Root Cause:**
The GitHub Actions OIDC role (`GitHubActionsRole-CostFX`) had ECS and ECR permissions but was missing SSM permissions needed to retrieve database configuration.

#### **Solution Applied (Sep 19, 2025):**
1. **Updated IAM Policy**: Added SSM permissions to `CostFX-Deployment-Policy`
   ```json
   {
     "Sid": "SSMParameterAccess",
     "Effect": "Allow",
     "Action": [
       "ssm:GetParameter",
       "ssm:GetParameters"
     ],
     "Resource": [
       "arn:aws:ssm:us-west-2:568530517605:parameter/costfx/dev/*"
     ]
   }
   ```

2. **AWS Command Used:**
   ```bash
   aws iam create-policy-version \
     --policy-arn arn:aws:iam::568530517605:policy/CostFX-Deployment-Policy \
     --policy-document file://updated-policy.json \
     --set-as-default
   ```

#### **Prevention:**
- Always verify IAM permissions match the resources accessed by deployment workflows
- Test SSM parameter access locally before deployment
- Include SSM permissions in initial OIDC role setup

---

### **Issue 2: Wrong SSM Parameter Path**

#### **Error Context:**
Database connection failures during migration:
```
could not connect to postgres: AggregateError [ECONNREFUSED]:
Error: connect ECONNREFUSED 127.0.0.1:5432
```

#### **Root Cause:**
GitHub Actions workflow used incorrect SSM parameter path:
- ❌ **Used**: `/costfx/dev/database/url`
- ✅ **Actual**: `/costfx/dev/database_url`

#### **Solution Applied:**
Updated `.github/workflows/app-deploy.yml`:
```yaml
# OLD - INCORRECT
export DATABASE_URL=$(aws ssm get-parameter --name "/costfx/dev/database/url" --with-decryption --query 'Parameter.Value' --output text)

# NEW - CORRECT  
export DATABASE_URL=$(aws ssm get-parameter --name "/costfx/dev/database_url" --with-decryption --query 'Parameter.Value' --output text)
```

#### **Verification Command:**
```bash
aws ssm get-parameters-by-path --path "/costfx/dev" --query 'Parameters[].Name'
```

#### **Prevention:**
- Always verify SSM parameter names using `get-parameters-by-path`
- Use consistent naming conventions across Terraform and deployment scripts
- Add parameter validation to deployment workflows

---

## 🔧 Diagnostic Commands

### **Check GitHub Actions Role Permissions:**
```bash
# List attached policies
aws iam list-attached-role-policies --role-name GitHubActionsRole-CostFX

# View policy content
aws iam get-policy-version \
  --policy-arn arn:aws:iam::568530517605:policy/CostFX-Deployment-Policy \
  --version-id v2 \
  --query 'PolicyVersion.Document'
```

### **Verify SSM Parameters:**
```bash
# List all CostFX parameters
aws ssm get-parameters-by-path --path "/costfx/dev" --query 'Parameters[].Name'

# Test database URL retrieval
aws ssm get-parameter \
  --name "/costfx/dev/database_url" \
  --with-decryption \
  --query 'Parameter.Value' \
  --output text
```

### **Test Database Connection:**
```bash
# Use retrieved DATABASE_URL to test connection
export DATABASE_URL=$(aws ssm get-parameter --name "/costfx/dev/database_url" --with-decryption --query 'Parameter.Value' --output text)
echo "Database URL format: ${DATABASE_URL%%@*}@[REDACTED]"
```

---

## 📚 Related Documentation

- **GitHub Actions Configuration**: `.github/workflows/app-deploy.yml`
- **Terraform SSM Setup**: `deploy/terraform/ssm-parameters.tf`  
- **OIDC Role Setup**: Managed via Terraform (GitHubActionsRole-CostFX)
- **Database Configuration**: `deploy/terraform/database.tf`

---

## 🎯 Deployment Checklist

Before each deployment, verify:

- [ ] **SSM Parameters Exist**: `aws ssm get-parameters-by-path --path "/costfx/dev"`
- [ ] **IAM Permissions Current**: Role has SSM, ECS, ECR access
- [ ] **Parameter Paths Match**: Workflow uses correct SSM parameter names
- [ ] **Database Connectivity**: RDS instance is accessible
- [ ] **Migration Status**: Local migrations are tested and ready

---

## 🚀 Success Indicators

A successful deployment should show:
```
✅ Database migrations completed successfully!
✅ Backend service updated successfully
✅ Frontend service updated successfully  
✅ All ECS services healthy
```

Monitor CloudWatch logs for any container startup issues after deployment.
