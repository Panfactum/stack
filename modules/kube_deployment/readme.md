# Kubernetes Deployment

This module provides our standard set up for a configurable Kubernetes Deployment. It includes:
- A deployment
- A secret object to hold configurable secrets for the deployment
- Configurable environment variables
- A service account with associated role and role binding
- Horizontal pod autoscaling
- A service for routing traffic
- An ingress that provides some basic routing rules

See the [vars file](./vars.tf) for descriptions of the input parameters including some additional configuration for the ingress annotations to connect them to the aws alb. 

# Implementation Instructions

To implement this module, create a module in the repository that is deploying a given service in terraform/service_name_deployment/. Create a main.tf and vars.tf file. In the main.tf create a module block pointing to this module+version and fill out the inputs with either hardcoded inputs specific to the service or expose them as configurable inputs using vars.tf. Add whatever other infrastructure belongs in the deployment and then create it in your desired environment. 