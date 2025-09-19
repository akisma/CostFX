# Configuration Management Guide

This document explains the centralized configuration system implemented across the CostFX application to eliminate hardcoded ports and URLs.

## Overview

We've implemented a centralized configuration system that:
- ✅ Eliminates hardcoded ports/URLs across the codebase
- ✅ Provides environment-specific configurations
- ✅ Centralizes test configurations
- ✅ Makes port changes easy to manage

## Configuration Files

### 1. Backend Configuration
**File**: `backend/src/config/settings.js`

```javascript
import settings from './config/settings.js';

// Use settings throughout your backend code
const port = settings.port;
const apiUrl = settings.baseUrl + settings.apiPath;
const corsOrigins = settings.corsOrigins;
```

**Key configurations:**
- `settings.port` - Backend server port (default: 3001)
- `settings.baseUrl` - Backend base URL
- `settings.apiPath` - API path prefix (/api/v1)
- `settings.corsOrigins` - Allowed CORS origins

### 2. Frontend Configuration
**File**: `frontend/src/config/settings.js`

```javascript
import config, { getApiConfig, getCurrentUrls } from './config/settings.js';

// Use configuration in your frontend code
const apiConfig = getApiConfig();
const urls = getCurrentUrls();
```

**Key configurations:**
- `config.api.baseUrl` - API endpoint URL
- `config.development` - Development environment URLs
- `config.production` - Production environment URLs

### 3. Shared Test Configuration
**File**: `shared/src/config/testConfig.js`

```javascript
import { testConfig, getTestApiUrl } from '../../shared/src/config/testConfig.js';

// Use in test files
const apiUrl = getTestApiUrl('/restaurants');
const backendPort = testConfig.backend.port;
```

## Usage Examples

### Backend Server Setup
```javascript
// OLD WAY (hardcoded)
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

// NEW WAY (centralized config)
import settings from './config/settings.js';
app.listen(settings.port, () => {
  console.log(`Server running on ${settings.baseUrl}`);
});
```

### Frontend API Calls
```javascript
// OLD WAY (hardcoded)
const API_BASE_URL = 'http://localhost:3001/api/v1';
const api = axios.create({ baseURL: API_BASE_URL });

// NEW WAY (centralized config)
import { getApiConfig } from './config/settings.js';
const api = axios.create(getApiConfig());
```

### Test Configuration
```javascript
// OLD WAY (hardcoded in each test file)
const API_URL = 'http://localhost:3001/api/v1';

// NEW WAY (centralized test config)
import { testConfig } from '../../shared/src/config/testConfig.js';
const API_URL = testConfig.backend.apiUrl;
```

## Environment Variables

### Backend Environment Variables
- `PORT` - Server port (default: 3001)
- `FRONTEND_URL` - Frontend URL for CORS
- `NODE_ENV` - Environment (development/production/test)

### Frontend Environment Variables
- `VITE_API_URL` - API endpoint URL
- `VITE_FRONTEND_URL` - Frontend URL
- `VITE_BACKEND_URL` - Backend URL

### Database Configuration (Enhanced September 19, 2025)

The backend database configuration supports flexible environment variable setup for both development and production environments.

**File**: `backend/src/config/database.js`

#### Configuration Options

**Option 1: Full DATABASE_URL (Recommended for Production)**
```bash
DATABASE_URL=postgresql://username:password@host:port/database
```

**Option 2: Individual Credentials (Development)**
```bash
POSTGRES_USER=postgres
POSTGRES_PASSWORD=password
POSTGRES_DB=restaurant_ai
DB_HOST=localhost
DB_PORT=5432
```

#### Environment Variable Requirements

- **DATABASE_URL**: If provided, individual credentials become optional
- **POSTGRES_PASSWORD**: Required only if DATABASE_URL is not provided
- **SSL Configuration**: Automatic detection based on environment

#### Production Deployment Compatibility

The enhanced configuration automatically validates that either:
1. `DATABASE_URL` is provided (AWS RDS/production setup), OR
2. Individual database credentials are provided (local development)

```javascript
// Validation logic
if (!dbConfig.url && !dbConfig.password) {
  throw new Error('Either DATABASE_URL or POSTGRES_PASSWORD must be provided');
}
```

This flexibility ensures compatibility with:
- ✅ **Local Development**: Individual environment variables
- ✅ **Docker Compose**: Individual environment variables  
- ✅ **AWS ECS Production**: DATABASE_URL from SSM Parameter Store
- ✅ **Testing Environments**: Both approaches supported

## Changing Ports

To change the default ports:

1. **Development**: Update the default values in config files
2. **Production**: Set environment variables
3. **Tests**: Update `testConfig.js`

### Example: Changing Backend Port from 3001 to 3005

1. Update `backend/src/config/settings.js`:
```javascript
port: process.env.PORT || 3005,
```

2. Update `shared/src/config/testConfig.js`:
```javascript
backend: {
  port: 3005,
  apiUrl: 'http://localhost:3005/api/v1'
}
```

3. Update environment files if needed:
```bash
# .env
PORT=3005
VITE_API_URL=http://localhost:3005/api/v1
```

## Migration Checklist

When adding new URLs or ports:

- [ ] Add to appropriate config file (`settings.js` or `testConfig.js`)
- [ ] Update environment variable documentation
- [ ] Update any Docker configurations
- [ ] Update README.md with new URLs
- [ ] Test all environments (dev, test, production)

## Benefits

1. **Single Source of Truth**: All ports/URLs defined in one place
2. **Environment Flexibility**: Easy to change configs per environment
3. **Test Consistency**: Shared test configuration prevents drift
4. **Maintainability**: No more hunting through files for hardcoded values
5. **Documentation**: Clear configuration structure and usage

## Files Updated

The following files were updated to use centralized configuration:

### Backend
- `src/config/settings.js` - Enhanced with URL configs
- `src/index.js` - Uses settings for port
- `src/app.js` - Uses settings for CORS origins
- `tests/setup.js` - Uses testConfig

### Frontend  
- `src/config/settings.js` - New configuration file
- `src/services/api.js` - Uses centralized API config
- `tests/setup.js` - Uses testConfig
- `tests/services/api.test.js` - Uses testConfig

### Shared
- `src/config/testConfig.js` - New shared test configuration

This centralized approach makes the application much more maintainable and eliminates the need to hunt down hardcoded values across multiple files.

---

## AWS OIDC Authentication Configuration

### Overview
The project now uses OpenID Connect (OIDC) for secure GitHub Actions authentication with AWS, eliminating the need for long-lived AWS access keys.

### OIDC Setup

#### 1. AWS OIDC Provider
**Created via Terraform**: `deploy/terraform/main.tf`
```hcl
resource "aws_iam_openid_connect_provider" "github_actions" {
  url = "https://token.actions.githubusercontent.com"
  client_id_list = ["sts.amazonaws.com"]
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1"]
}
```

#### 2. IAM Role Configuration
**Role Name**: `GitHubActionsRole-CostFX`
**ARN**: `arn:aws:iam::568530517605:role/GitHubActionsRole-CostFX`

**Trust Policy** (allows GitHub Actions from our repository):
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::568530517605:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
          "token.actions.githubusercontent.com:sub": "repo:akisma/CostFX:ref:refs/heads/main"
        }
      }
    }
  ]
}
```

#### 3. GitHub Actions Configuration
**Required Secret**: `AWS_ROLE_ARN` = `arn:aws:iam::568530517605:role/GitHubActionsRole-CostFX`

**Workflow Permissions**:
```yaml
permissions:
  id-token: write
  contents: read
```

**Authentication Step**:
```yaml
- name: Configure AWS credentials
  uses: aws-actions/configure-aws-credentials@v4
  with:
    role-to-assume: ${{ secrets.AWS_ROLE_ARN }}
    role-session-name: github-actions-deploy
    aws-region: us-west-2
```

### Security Benefits
- ✅ **No Long-lived Credentials**: No AWS access keys stored in GitHub
- ✅ **Least Privilege**: Role has minimal required permissions
- ✅ **Repository Scoped**: Trust policy restricts access to specific repository
- ✅ **Audit Trail**: All actions logged through CloudTrail
- ✅ **Token-based**: Short-lived tokens provide enhanced security

### Troubleshooting OIDC
- **Permission Errors**: Check that AWS_ROLE_ARN secret is configured in GitHub
- **Trust Policy Issues**: Verify repository name and branch in trust policy conditions
- **Token Issues**: Ensure workflow has `id-token: write` permissions
