variable "docker_hub_username" {
  description = "The username of the Docker Hub user that will be used to pull images from Docker Hub"
  type        = string
}

variable "docker_hub_access_token" {
  description = "The access token of the Docker Hub user that will be used to pull images from Docker Hub"
  type        = string
  sensitive   = true
}

variable "github_username" {
  description = "The username of the GitHub user that will be used to pull images from GitHub"
  type        = string
}

variable "github_access_token" {
  description = "The access token of the GitHub user that will be used to pull images from GitHub"
  type        = string
  sensitive   = true
}