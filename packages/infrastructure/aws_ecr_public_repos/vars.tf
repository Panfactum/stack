variable "ecr_repositories" {
  description = "Mapping of names to the repositories to create."
  type = map(object({
    about_text        = optional(string, null)       # A detailed description of the contents of the repository. It is publicly visible in the Amazon ECR Public Gallery. The text must be in markdown format.
    architectures     = optional(list(string), null) #  On the Amazon ECR Public Gallery, the following supported architectures will appear as badges on the repository and are used as search filters: ARM, ARM 64, x86, x86-64
    description       = optional(string, null)       # A short description of the contents of the repository. This text appears in both the image details and also when searching for repositories on the Amazon ECR Public Gallery.
    logo_image_blob   = optional(string, null)       # The base64-encoded repository logo payload. (Only visible for verified accounts) Note that drift detection is disabled for this attribute.
    operating_systems = optional(list(string), null) # On the Amazon ECR Public Gallery, the following supported operating systems will appear as badges on the repository and are used as search filters: Linux, Windows
    usage_text        = optional(string, null)       # Detailed information on how to use the contents of the repository. It is publicly visible in the Amazon ECR Public Gallery. The usage text provides context, support information, and additional usage details for users of the repository. The text must be in markdown format.
  }))
}

variable "trusted_account_ids" {
  description = "The ids of the accounts that have completed access to each repository."
  type        = list(string)
  default     = []
}
