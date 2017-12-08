# Basic CI Deployment Scripts for AWS from BitBucket

## General Steps to test and deploy
* Create "aws-dev" branch
* Create "aws-prod" branch
* Push both branches up to BitBucket and setup permissions on those branches
* OPTIONAL - Create Webhook for Slack Integration (in BitBucket Repo Settings)
* Configure and add deployment yml to master bitbucket-pipelines.yml
* Configure and add deployment script to master s3_deploy.js
* Test aws-dev deploy first
* Once confirmed that dev deploy works, run prod deploy