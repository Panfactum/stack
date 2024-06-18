#!/usr/bin/env bash

# Purpose: Perform code generation for the TF modules

#######################################################
## Step 1: Add common variables to every terraform module
#######################################################

pf-iac-update

#######################################################
## Step 2: Generate the terraform documentation using terraform-docs
#######################################################

generate-tf-docs
