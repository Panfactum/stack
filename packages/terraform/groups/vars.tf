variable "role_group_config" {
  description = "Role groups are groups that define a user's role and access controls in the organization."
  type = map(object({
    description = string
    azure_roles = optional(list(string), [])
  }))
}

variable "dynamic_group_config" {
  description = "Users are assigned to these groups based on their role in the organization."
  type = map(object({
    description   = string
    role_groups   = list(string)
    mail_nickname = optional(string)
  }))
}

variable "ci_group_config" {
  description = "CI agents are assigned to these groups depending on their environment context"
  type = map(object({
    global_admin = optional(bool, false)
  }))
}
