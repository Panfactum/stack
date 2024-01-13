ui = true

api_addr      = "http://0.0.0.0:8200"
cluster_addr  = "http://0.0.0.0:8201"

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

storage "file" {
  path = "/vault/data"
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
