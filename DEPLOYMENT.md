# Deployment Guide

This document describes the deployment setup for the Jetson Capacity Planner application.

## Environments

The application supports three environments:

### 1. Development (Local)
- Branch: Any local branch
- Purpose: Local development and testing
- Configuration: `.env.local`

### 2. Test
- Branch: `develop` or `test`
- Purpose: Testing and QA before production
- Configuration: GitHub Secrets for test environment
- Workflow: [.github/workflows/deploy-test.yml](.github/workflows/deploy-test.yml)

### 3. Production
- Branch: `main`
- Purpose: Live production environment
- Configuration: GitHub Secrets for production environment
- Workflow: [.github/workflows/deploy-production.yml](.github/workflows/deploy-production.yml)

## Setup Instructions

### 1. Configure GitHub Environments

1. Go to your GitHub repository: https://github.com/PSS-Berke/Jetson
2. Navigate to **Settings > Environments**
3. Create two environments:
   - `test`
   - `production`

#### Test Environment Settings
- Add protection rules (optional):
  - No required reviewers needed
  - Limit deployment to `develop` and `test` branches

#### Production Environment Settings
- Add protection rules (recommended):
  - Require at least 1 reviewer for deployments
  - Limit deployment to `main` branch only
  - Add deployment delay (optional)

### 2. Add GitHub Secrets

For each environment, add the necessary secrets:

1. Go to **Settings > Secrets and variables > Actions**
2. Select the appropriate environment
3. Add the following secrets (customize based on your needs):

#### Required Secrets
- `VERCEL_TOKEN` (if using Vercel)
- `VERCEL_ORG_ID` (if using Vercel)
- `VERCEL_PROJECT_ID` (if using Vercel)

#### Optional Secrets
- `TEST_API_URL` / `PROD_API_URL`
- Database credentials
- Third-party service API keys

### 3. Create Required Branches

```bash
# Create test/develop branch (if not exists)
git checkout -b develop
git push -u origin develop

# Or create a test branch
git checkout -b test
git push -u origin test
```

### 4. Local Development Setup

1. Copy the example environment file:
```bash
cp .env.example .env.local
```

2. Update `.env.local` with your local configuration
3. Install dependencies:
```bash
npm install
```

4. Run the development server:
```bash
npm run dev
```

## Deployment Workflow

### Deploying to Test

1. Create a feature branch from `develop`:
```bash
git checkout develop
git pull origin develop
git checkout -b feature/my-feature
```

2. Make your changes and commit:
```bash
git add .
git commit -m "Add new feature"
```

3. Push to develop or create a PR:
```bash
git push origin feature/my-feature
# Create PR to develop branch
```

4. When merged to `develop`, the test deployment workflow automatically runs

### Deploying to Production

1. Ensure all changes are tested in the test environment
2. Create a PR from `develop` to `main`:
```bash
git checkout develop
git pull origin develop
git push origin develop
# Create PR from develop to main
```

3. Get PR approved (if protection rules are enabled)
4. Merge to `main`
5. The production deployment workflow automatically runs

## Customizing Deployment

The workflow files are located at:
- Test: [.github/workflows/deploy-test.yml](.github/workflows/deploy-test.yml)
- Production: [.github/workflows/deploy-production.yml](.github/workflows/deploy-production.yml)

### Common Deployment Targets

#### Vercel
Uncomment and configure the Vercel deployment step in the workflow files.

#### AWS
Add AWS deployment steps using `aws-actions/configure-aws-credentials@v4`

#### Custom Server
Add SSH deployment steps or use deployment tools like Ansible

## Environment Variables

Environment variables should be managed as follows:

1. **Local Development**: `.env.local` (not committed)
2. **Test Environment**: GitHub Environment Secrets
3. **Production Environment**: GitHub Environment Secrets

Never commit sensitive credentials to the repository.

## Monitoring Deployments

1. Go to **Actions** tab in your GitHub repository
2. View deployment history and logs
3. Check the status of each environment

## Rollback Procedure

If a production deployment fails:

1. Go to the **Actions** tab
2. Find the last successful deployment
3. Re-run the workflow or revert the commit:
```bash
git revert <commit-hash>
git push origin main
```

## Troubleshooting

### Build Failures
- Check the Actions logs for specific errors
- Verify all environment variables are set correctly
- Test the build locally: `npm run build`

### Deployment Failures
- Verify deployment credentials in GitHub Secrets
- Check deployment service status
- Review workflow logs for detailed error messages

## Next Steps

1. Configure your actual deployment target (Vercel, AWS, etc.)
2. Set up monitoring and error tracking
3. Configure notifications for deployment failures
4. Set up automated testing in the workflows
