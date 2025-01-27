// Monthly prices based on AWS on-demand pricing (linear regression)
// These are rough estimates taken by building a regression
// across various instance types in the M6A, C6A, and R6A instance classes
export const BASE_WORKLOAD_CPU_PRICE = 21;
export const BASE_WORKLOAD_MEM_PRICE = 3.5;

// Assumes a 70% discount for running spot instances and arm which appears
// to be the average from the reference stack
export const STACK_WORKLOAD_CPU_PRICE = BASE_WORKLOAD_CPU_PRICE * 0.3;
export const STACK_WORKLOAD_MEM_PRICE = BASE_WORKLOAD_MEM_PRICE * 0.3;
export const STACK_UTILIZATION_RATE = 66;

export const S3_PRICE_GB = 0.023;
export const EBS_PRICE_GB = 0.08;
export const EBS_SNAPSHOT_PRICE_GB = 0.05;

// These are rough estimates taken by building a regression
// across various instance types in the db.r6i and db.m6i
export const BASE_RDS_MEM_PRICE = 6.48;
export const BASE_RDS_CPU_PRICE = 38.16;
export const BASE_RDS_STORAGE_PRICE_GB = 0.115;
export const BASE_RDS_BACKUP_STORAGE_PRICE_GB = 0.095;

// These are rough estimates taken by building a regression
// across various instance types in the cache.m7g.large and cache.r7g.large
export const BASE_KV_MEM_PRICE = 6.57;
export const BASE_KV_CPU_PRICE = 35.94;
export const BASE_KV_BACKUP_STORAGE_PRICE_GB = 0.085;

// Networking costs
export const STACK_NAT_COST = 3.066;
export const BASE_NAT_COST = 32.4;
export const BASE_NAT_COST_GB = 0.045;
export const OUTBOUND_COST_GB = 0.09;
export const INTER_AZ_COST_GB = 0.02;

// Observability costs
export const DATADOG_METRICS_COST_PER_1000 = (4 * 1000) / 100;
export const STACK_METRICS_COST_PER_1000 = 0.3;
export const DATADOG_LOGS_INDEX_COST_PER_GB = 2.55; // Assuming average log size is 1KB
export const DATADOG_LOGS_INGEST_COST_PER_GB = 0.1;
export const DATADOG_LOG_ARCHIVE_PER_GB = 0.25;
export const STACK_LOGS_COST_PER_GB =
  S3_PRICE_GB / 2 + EBS_PRICE_GB / 30 + DATADOG_LOGS_INGEST_COST_PER_GB; // we assume our ingest costs are the same as datadog
export const DATADOG_SPANS_INDEX_COST_PER_GB = 2.55;
export const DATADOG_SPANS_INGEST_COST_PER_GB = 0.1;
export const STACK_SPANS_COST_PER_GB =
  S3_PRICE_GB / 2 + EBS_PRICE_GB / 30 + DATADOG_LOGS_INGEST_COST_PER_GB; // we assume our ingest costs are the same as datadog
export const STACK_OBSERVABILITY_FIXED_COST_PER_CLUSTER = 40;

// Identity Provider costs
export const OKTA_PRICING_PER_EMPLOYEE = 2 + 3 + 2 + 4 + 2 + 4 + 3 + 9; // Standard web ui access
export const OKTA_PRICING_PER_DEVELOPER = 14 + 15; // Integrated access to databases and ssh servers
export const STACK_AC_PRICING_PER_EMPLOYEE = 0.1;
export const STACK_IDP_BASE_COST = 30;

// Kubernetes costs
export const EKS_PRICE = 75;
export const LB_COST = 25;
export const EXTRA_STACK_COST = 75;

// CICD costs
export const GHA_CICD_COST_PER_CPU_MINUTE = 0.008 / 2;

// Labor costs
export const LABOR_COSTS_AS_PERCENT_OF_INFRA = 0.39; // gartner
export const STACK_PRODUCTIVITY_BOOST = 0.11;

// Support plan pricing
export const CLOUD_COST = 500;
export const CLUSTER_COST = 750;
export const WORKLOAD_DEPLOYMENT_COST = 250;

export const PRIORITY_SUPPORT_MULTIPLIER = 0.2;

export const SUPPORT_HOURS_OPTIONS = [
  {
    id: "basic",
    name: "Basic",
    multiplier: 0,
    description: "8am-5pm ET, Monday-Friday",
    excludeHolidays: true,
  },
  {
    id: "extended",
    name: "Extended",
    multiplier: 0.2,
    description: "8am-8pm ET, Every Day",
    excludeHolidays: true,
  },
  {
    id: "24-7",
    name: "24/7/365",
    multiplier: 0.5,
    description: "Universal coverage",
    excludeHolidays: false,
  },
];

export const ANNUAL_SPEND_DISCOUNT_MULTIPLIER = -0.2;
export const STARTUP_DISCOUNT_MULTIPLIER = -0.3;
