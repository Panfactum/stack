ui = true

listener "tcp" {

  # We use the service mesh for TLS so we do not need to do it natively
  tls_disable = 1

  # These are the vault defaults
  address = "0.0.0.0:8200"
  cluster_address = "0.0.0.0:8201"

  # Vault tokens can be bound to particular IP addresses. However, the source
  # IP won't be available if communicating to vault through our ingress system
  # (the source IP will look like the ingress pod id).
  # Our ingress system allows adding a x-forwarded-for header that vault
  # can then read to derive the actual source IP.
  # If the header isn't present, that means it came from inside the cluster.
  x_forwarded_for_authorized_addrs = "10.0.0.0/16" #TODO: This should be an input
  x_forwarded_for_reject_not_authorized = "true"
  x_forwarded_for_reject_not_present = "false"

  telemetry {
    # Necessary for Prometheus Operator
    unauthenticated_metrics_access = "true"
  }
}


# enables service-based routing to the active vault instance
service_registration "kubernetes" {}

# Use the headless Kubernetes service addresses to connect with the other instances
storage "raft" {
  path = "/vault/data"
  retry_join {
    leader_api_addr = "http://vault-0.vault-internal:8200"
  }
  retry_join {
    leader_api_addr = "http://vault-1.vault-internal:8200"
  }
  retry_join {
    leader_api_addr = "http://vault-2.vault-internal:8200"
  }
}

plugin_directory = "/plugins"

# This instructs Vault to use the automatic unsealing (https://developer.hashicorp.com/vault/docs/concepts/seal#auto-unseal)
# Without this, we would need to manually enter the unseal keys every time the Vault pod restarts.
# We use AWS KMS for the unseal mechanism to prevent ever leaking the unseal encryption material
# Vault will use IRSA to authenticate with the AWS API
seal "awskms" {
  region = "${aws_region}"
  kms_key_id = "${kms_key_id}"

  # Fixes for Vault 1.14+
  role_arn = "${aws_role_arn}"
  web_identity_token_file = "/var/run/secrets/eks.amazonaws.com/serviceaccount/token"
}

telemetry {
  disable_hostname = true
  enable_hostname_label = true
  prometheus_retention_time = "2m"
}


