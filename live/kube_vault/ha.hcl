ui = true

listener "tcp" {
  tls_disable = 1
  address = "0.0.0.0:8200"
  cluster_address = "0.0.0.0:8201"
  x_forwarded_for_authorized_addrs = "10.0.0.0/16"
  x_forwarded_for_reject_no_present = "false"
  telemetry {
    unauthenticated_metrics_access = "true" # (necessary for Prometheus Operator)
  }
}

storage "raft" {
  path = "/vault/data"
  retry_join {
    leader_api_addr = "https://vault-0.vault-internal:8200"
  }
  retry_join {
    leader_api_addr = "https://vault-1.vault-internal:8200"
  }
  retry_join {
    leader_api_addr = "https://vault-2.vault-internal:8200"
  }
}

seal "awskms" {
  region = "${aws_region}"
  kms_key_id = "${kms_key_id}"

  # Fixes for Vault 1.14+
  role_arn = "${aws_role_arn}"
  web_identity_token_file = "/var/run/secrets/eks.amazonaws.com/serviceaccount/token"
}

telemetry {
  prometheus_retention_time = "30s"
  disable_hostname = true
}

# enables service-based routing to the active vault instance
service_registration "kubernetes" {}
