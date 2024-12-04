variable "images" {
  description = "Images to add to the node image cache"
  type = list(object({
    registry          = string
    repository        = string
    tag               = optional(string, "latest")
    prepull_enabled   = optional(bool, true) # True iff the image should be pulled immediately when a new node launches
    pin_enabled       = optional(bool, true) # True iff the image should be pinned to a node throughout its entire lifetime
    arm_nodes_enabled = optional(bool, true) # True iff the image should be cached on arm64 nodes
    amd_nodes_enabled = optional(bool, true) # True iff the image should be cached on amd64 nodes
  }))
}