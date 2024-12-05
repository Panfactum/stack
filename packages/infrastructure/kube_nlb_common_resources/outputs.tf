output "annotations" {
  description = "Annotations to add to the LoadBalancer service"
  value = {
    "service.beta.kubernetes.io/aws-load-balancer-name"                            = random_id.lb_name.hex
    "service.beta.kubernetes.io/aws-load-balancer-type"                            = "external"
    "service.beta.kubernetes.io/aws-load-balancer-backend-protocol"                = "tcp"
    "service.beta.kubernetes.io/aws-load-balancer-scheme"                          = "internet-facing"
    "service.beta.kubernetes.io/aws-load-balancer-nlb-target-type"                 = "ip"
    "service.beta.kubernetes.io/aws-load-balancer-healthcheck-unhealthy-threshold" = "2"
    "service.beta.kubernetes.io/aws-load-balancer-healthcheck-healthy-threshold"   = "2"
    "service.beta.kubernetes.io/aws-load-balancer-healthcheck-timeout"             = "2"
    "service.beta.kubernetes.io/aws-load-balancer-healthcheck-interval"            = "5"
    "service.beta.kubernetes.io/aws-load-balancer-attributes"                      = "zonal_shift.config.enabled=true"
    "service.beta.kubernetes.io/aws-load-balancer-target-group-attributes" = join(",", [

      // Ensures a client always connects to the same backing server; important
      // for both performance and rate-limiting
      "stickiness.enabled=true",
      "stickiness.type=source_ip",

      // Preserve the client IP even when routing through the LB
      "preserve_client_ip.enabled=true",

      // This needs to be SHORTER than it takes for the NGINX pod to terminate as incoming connections
      // will only be stopped when this delay is met
      "deregistration_delay.timeout_seconds=${var.deregistration_delay_seconds}",
      "deregistration_delay.connection_termination.enabled=true",
      "target_health_state.unhealthy.connection_termination.enabled=false"
    ])
  }
}

