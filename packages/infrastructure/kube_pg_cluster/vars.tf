variable "eks_cluster_name" {
  description = "The name of the EKS cluster."
  type        = string
}

variable "aws_iam_ip_allow_list" {
  description = "A list of IPs that can use the service account token to authenticate with AWS API"
  type        = list(string)
}

variable "pg_cluster_namespace" {
  description = "The namespace to deploy to the cluster into"
  type        = string
}

variable "pg_version" {
  description = "The version of postgres to deploy"
  type        = string
  default     = "16.2-10"
}

variable "pg_instances" {
  description = "The number of instances to deploy in the postgres cluster"
  type        = number
  default     = 2
}

variable "pg_storage_gb" {
  description = "The initial number of gigabytes of storage to provision for the postgres cluster"
  type        = number
}

variable "pg_storage_limit_gb" {
  description = "The maximum number of gigabytes of storage to provision for the postgres cluster"
  type        = number
  default     = null
}

variable "pg_storage_increase_threshold_percent" {
  description = "Dropping below this percent of free storage will trigger an automatic increase in storage size"
  type        = number
  default     = 20
}

variable "pg_storage_increase_percent" {
  description = "The percent to increase storage by if free space drops below the threshold"
  type        = number
  default     = 100
}

variable "pg_shutdown_timeout" {
  description = "The number of seconds to wait for open connections to close before shutting down postgres nodes"
  type        = number
  default     = null
}

variable "pg_shared_buffers_mb" {
  type        = number
  description = "The amount of memory in MB to allocate to the shared_buffers setting in postgresql.conf. The recommendation is 25% of the total memory allocated to the postgres pod."
  default     = null
}

variable "backups_force_delete" {
  description = "Whether to delete backups on destroy"
  type        = bool
  default     = false
}

variable "vpa_enabled" {
  description = "Whether to enable the vertical pod autoscaler"
  type        = bool
  default     = true
}

variable "backups_enabled" {
  description = "Whether this database has backups enabled"
  type        = bool
  default     = true
}

variable "spot_instances_enabled" {
  description = "Whether the database nodes can be scheduled on spot instances"
  type        = bool
  default     = false
}

variable "arm_instances_enabled" {
  description = "Whether the database nodes can be scheduled on arm instances"
  type        = bool
  default     = false
}

variable "burstable_instances_enabled" {
  description = "Whether the database nodes can be scheduled on burstable instances"
  type        = bool
  default     = false
}

variable "pull_through_cache_enabled" {
  description = "Whether to use the ECR pull through cache for the deployed images"
  type        = bool
  default     = false
}

variable "pg_memory_mb" {
  description = "The amount of memory to allocate to the postgres pods (in Mi)"
  type        = number
  default     = 1000

  validation {
    condition     = var.pg_memory_mb >= 250
    error_message = "Must provide at least 250MB of memory"
  }
}

variable "pg_cpu_millicores" {
  description = "The amount of cpu to allocate to the postgres pods (in millicores)"
  type        = number
  default     = 250
}

variable "pgbouncer_log_connections" {
  description = "Whether to log each connection."
  type        = bool
  default     = false
}

variable "pgbouncer_log_disconnections" {
  description = "Whether to log each disconnection."
  type        = bool
  default     = false
}

variable "pgbouncer_log_pooler_errors" {
  description = "Whether to log errors the pooler sends to clients."
  type        = bool
  default     = true
}

variable "pgbouncer_max_client_conn" {
  description = "The maximum client connections allowed by pgbouncer"
  type        = number
  default     = 10000
  validation {
    condition     = var.pgbouncer_max_client_conn >= 100
    error_message = "max_client_connections must be at least 100"
  }
}

variable "pgbouncer_application_name_add_host" {
  description = "Add the client host address and port to the application name setting set on connection start."
  type        = bool
  default     = false
}

variable "pgbouncer_autodb_idle_timeout" {
  description = "If the automatically created (via “*”) database pools have been unused this many seconds, they are freed."
  type        = number
  default     = 3600
}

variable "pgbouncer_client_idle_timeout" {
  description = "Client connections idling longer than this many seconds are closed. This should be larger than the client-side connection lifetime settings, and only used for network problems."
  type        = number
  default     = 0 # Disabled
}

variable "pgbouncer_client_login_timeout" {
  description = "If a client connects but does not manage to log in in this amount of time, it will be disconnected. Mainly needed to avoid dead connections stalling SUSPEND and thus online restart."
  type        = number
  default     = 60
}

variable "pgbouncer_default_pool_size" {
  description = "How many server connections to allow per user/database pair."
  type        = number
  default     = 20
}

variable "pgbouncer_disable_pqexec" {
  description = "Disable the Simple Query protocol (PQexec). Unlike the Extended Query protocol, Simple Query allows multiple queries in one packet, which allows some classes of SQL-injection attacks."
  type        = bool
  default     = false
}

variable "pgbouncer_max_db_connections" {
  description = "Do not allow more than this many server connections per database (regardless of user). This considers the PgBouncer database that the client has connected to, not the PostgreSQL database of the outgoing connection."
  type        = number
  default     = 0 # unlimited
}

variable "pgbouncer_max_prepared_statements" {
  description = "When this is set to a non-zero value PgBouncer tracks protocol-level named prepared statements related commands sent by the client in transaction and statement pooling mode. PgBouncer makes sure that any statement prepared by a client is available on the backing server connection. Even when the statement was originally prepared on another server connection."
  type        = number
  default     = 0 # unlimited
}

variable "pgbouncer_max_user_connections" {
  description = "Do not allow more than this many server connections per user (regardless of database)."
  type        = number
  default     = 0 # unlimited
}

variable "pgbouncer_min_pool_size" {
  description = "Add more server connections to pool if below this number. Improves behavior when the normal load suddenly comes back after a period of total inactivity. The value is effectively capped at the pool size."
  type        = number
  default     = 0 # disabled
}

variable "pgbouncer_query_timeout" {
  description = "Queries running longer than this amount of seconds are canceled. This should be used only with a slightly smaller server-side statement_timeout, to apply only for network problems."
  type        = number
  default     = 0 # disabled
}

variable "pgbouncer_query_wait_timeout" {
  description = "Maximum time queries are allowed to spend waiting for execution. If the query is not assigned to a server during that time, the client is disconnected. 0 disables. If this is disabled, clients will be queued indefinitely."
  type        = number
  default     = 120
}

variable "pgbouncer_reserve_pool_size" {
  description = "How many additional connections to allow to a pool (see reserve_pool_timeout). 0 disables."
  type        = number
  default     = 0
}

variable "pgbouncer_reserve_pool_timeout" {
  description = "If a client has not been serviced in this amount of seconds, use additional connections from the reserve pool. 0 disables."
  type        = number
  default     = 5
}

variable "pgbouncer_server_check_delay" {
  description = "How long to keep released connections available for immediate re-use."
  type        = number
  default     = 30
}

variable "pgbouncer_server_connect_timeout" {
  description = "If connection and login don’t finish in this amount of seconds, the connection will be closed."
  type        = number
  default     = 15
}

variable "pgbouncer_server_fast_close" {
  description = "Disconnect a server in session pooling mode immediately or after the end of the current transaction if it is in “close_needed” mode (set by RECONNECT, RELOAD that changes connection settings, or DNS change), rather than waiting for the session end. In statement or transaction pooling mode, this has no effect since that is the default behavior there."
  type        = bool
  default     = false
}

variable "pgbouncer_server_idle_timeout" {
  description = "If a server connection has been idle more than this many seconds it will be closed. If 0 then this timeout is disabled."
  type        = number
  default     = 600
}

variable "pgbouncer_server_lifetime" {
  description = "The pooler will close an unused (not currently linked to any client connection) server connection that has been connected longer than this. Setting it to 0 means the connection is to be used only once, then closed."
  type        = number
  default     = 3600
}

variable "pgbouncer_server_login_retry" {
  description = "If login to the server failed, because of failure to connect or from authentication, the pooler waits this many seconds before retrying to connect. During the waiting interval, new clients trying to connect to the failing server will get an error immediately without another connection attempt."
  type        = number
  default     = 15
}

variable "pgbouncer_stats_period" {
  description = "Sets how often the averages shown in various SHOW commands are updated and how often aggregated statistics are written to the log."
  type        = number
  default     = 60
}

variable "pgbouncer_tcp_keepalive" {
  description = "Turns on basic keepalive with OS defaults."
  type        = bool
  default     = true
}

variable "pgbouncer_tcp_keepcnt" {
  description = "Sets tcp_keepcnt"
  type        = number
  default     = null
}

variable "pgbouncer_tcp_keepidle" {
  description = "Sets tcp_keepidle"
  type        = number
  default     = null
}

variable "pgbouncer_tcp_keepintvl" {
  description = "Sets tcp_keepintvl"
  type        = number
  default     = null
}

variable "pgbouncer_tcp_user_timeout" {
  description = "Sets the TCP_USER_TIMEOUT socket option. This specifies the maximum amount of time in milliseconds that transmitted data may remain unacknowledged before the TCP connection is forcibly closed. If set to 0, then operating system’s default is used."
  type        = bool
  default     = false
}

variable "pgbouncer_verbose" {
  description = "Increase verbosity. Mirrors the “-v” switch on the command line. For example, using “-v -v” on the command line is the same as verbose=2."
  type        = number
  default     = 0
}

variable "pgbouncer_version" {
  description = "The version of the cloudnative-pg/pgbouncer image to use"
  type        = string
  default     = "1.22.1"
}

variable "pgbouncer_pool_mode" {
  description = "What pool_mode to run pgbouncer in"
  type        = string
  default     = "session"
  validation {
    condition     = contains(["session", "transaction", "statement"], var.pgbouncer_pool_mode)
    error_message = "pool_mode must be one of: session, transaction, or statement"
  }
}

variable "pgbouncer_read_only_enabled" {
  description = "Whether to enable a pgbouncer deployment in read-only mode"
  type        = bool
  default     = false
}

variable "pgbouncer_read_write_enabled" {
  description = "Whether to enable a pgbouncer deployment in read-write mode"
  type        = bool
  default     = true
}

variable "monitoring_enabled" {
  description = "Whether to add active monitoring to the deployed systems"
  type        = bool
  default     = false
}

variable "panfactum_scheduler_enabled" {
  description = "Whether to use the Panfactum pod scheduler with enhanced bin-packing"
  type        = bool
  default     = false
}

variable "enhanced_ha_enabled" {
  description = "Whether to add extra high-availability scheduling constraints at the trade-off of increased cost"
  type        = bool
  default     = true
}
