output "match_labels" {
  description = "The labels unique to this cronjob that can be used to select the pods in this cronjob"
  value       = module.pod_template.match_labels
}
