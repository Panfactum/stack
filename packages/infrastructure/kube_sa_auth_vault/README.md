# Vault Authentication via Kubernetes Service Account

Gives a kubernetes service account in an EKS cluster access to an Vault role through the ServiceAccount token.

This allows our Kubernetes pods to utilize the Vault API without static credentials.