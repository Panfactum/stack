variable "datadog_api_url" {
  description = "The url of the datadog API endpoints."
  type        = string
}

provider "datadog" {
  api_url  = var.datadog_api_url
  validate = true
}