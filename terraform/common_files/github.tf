variable "github_owner" {
  description = "The Github organization."
  type        = string
}

variable "github_token" {
  description = "The Github token to use for this provider."
  type        = string
}

provider "github" {
  owner = var.github_owner
  token = var.github_token
}
