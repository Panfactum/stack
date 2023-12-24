variable "matching_labels" {
  description = "kubernetes labels to use in selectors to match the workload"
  type        = map(string)
  default     = {}
}
