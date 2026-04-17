# NOTE: This file is for HashiCorp specific licensing automation and can be deleted after creating a new repo with this template.
schema_version = 1

project {
  license        = "Apache-2.0"
  copyright_year = 2024

  header_ignore = [
    "go/**",
    
    # examples used within documentation (prose)
    "examples/**",

    # golangci-lint tooling configuration
    ".golangci.yml",

    # GoReleaser tooling configuration
    ".goreleaser.yml",
  ]
}