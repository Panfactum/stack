variable "extra_priority_classes" {
  description = "A mapping of extra priority class names to their values"
  type        = map(number)
  default     = {}
}