terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "5.39.1"
    }
  }
}

/***************************************
* Set Up Log Group
***************************************/
resource "aws_cloudwatch_log_group" "main" {
  name              = var.name
  retention_in_days = 1                   // We don't need to retain these long-term as they should be stored somewhere cheaper long-term
  log_group_class   = "INFREQUENT_ACCESS" // Cuts costs by 50% and we don't query directly from cloudwatch
  tags = {
    description = var.description
  }
}

/***************************************
* Todo: Log exporter
***************************************/
