#!/usr/bin/env bash
# Generates a list of Kubernetes API resources grouped by API group for RBAC policy generation.
# This script queries the Kubernetes API server for all available resources and formats them for use in rbac.tf.

# Get all API resources from the cluster, then process them in two stages:
# 1. Extract resource name and API group from each line
# 2. Group resources by API group into comma-separated lists

kubectl api-resources --no-headers | awk '{
  # Parse the output based on number of fields (handles optional shortname column)
  name = $1;
  if (NF == 4) {
    # No shortname present: NAME APIGROUP NAMESPACED KIND
    shortname = "none";
    apiGroup = $2
    namespaced = $3;
    kind = $4;
    t = "1";
  } else {
    # Shortname present: NAME SHORTNAME APIGROUP NAMESPACED KIND
    shortname = $2;
    apiGroup = $3
    namespaced = $4;
    kind = $5;
    t = "0";
  }
  # Remove version suffix from API group (e.g., apps/v1 -> apps, policy/v1beta1 -> policy)
  gsub(/\/v[0-9]+(alpha|beta)?[0-9]*$/, "", apiGroup);
  # Output: resource_name api_group
  print name " " apiGroup;
}' | awk '{ 
  # Group resources by API group using associative arrays to track unique resources
  # resources[apiGroup][resourceName] = 1 to track uniqueness
  resources[$2][$1] = 1
} END { 
  # Build comma-separated list of unique resources for each API group
  for (apiGroup in resources) {
    resourceList = ""
    for (resource in resources[apiGroup]) {
      resourceList = resourceList ? resourceList "," resource : resource
    }
    # Output format: resource1,resource2,resource3 api.group.name
    print resourceList, apiGroup
  }
}'
