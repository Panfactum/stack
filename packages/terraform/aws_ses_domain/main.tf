// Live

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "5.39.1"
    }
    random = {
      source  = "hashicorp/random"
      version = "3.6.0"
    }
    time = {
      source  = "hashicorp/time"
      version = "0.10.0"
    }
  }
}

module "tags" {
  source = "../aws_tags"

  pf_stack_type    = var.pf_stack_type
  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  region           = var.region
  pf_root_module   = var.pf_root_module
  pf_module        = var.pf_module
  extra_tags       = var.extra_tags
  is_local         = var.is_local
}

data "aws_region" "current" {}


data "aws_route53_zone" "zone" {
  name = var.domain
}

##########################################################################
## Domain Setup
##########################################################################

resource "aws_ses_domain_identity" "identity" {
  domain = var.domain
}

resource "aws_route53_record" "ses" {
  zone_id = data.aws_route53_zone.zone.zone_id
  name    = "_amazonses.${aws_ses_domain_identity.identity.id}"
  type    = "TXT"
  ttl     = "600"
  records = [aws_ses_domain_identity.identity.verification_token]
}

resource "aws_ses_domain_identity_verification" "verification" {
  domain = aws_ses_domain_identity.identity.id
  depends_on = [
    aws_route53_record.ses
  ]
}

resource "aws_ses_domain_dkim" "dkim" {
  domain     = aws_ses_domain_identity.identity.domain
  depends_on = [aws_ses_domain_identity_verification.verification]
}

resource "aws_route53_record" "dkim" {
  count   = 3
  zone_id = data.aws_route53_zone.zone.zone_id
  name    = "${aws_ses_domain_dkim.dkim.dkim_tokens[count.index]}._domainkey"
  type    = "CNAME"
  ttl     = "600"
  records = ["${aws_ses_domain_dkim.dkim.dkim_tokens[count.index]}.dkim.amazonses.com"]
}

##########################################################################
## Alternative Send-From
##########################################################################

resource "aws_ses_domain_mail_from" "example" {
  domain           = aws_ses_domain_identity.identity.domain
  mail_from_domain = "${var.send_from_subdomain}.${aws_ses_domain_identity.identity.domain}"
  depends_on       = [aws_ses_domain_identity_verification.verification]
}

resource "aws_route53_record" "example_ses_domain_mail_from_mx" {
  zone_id = data.aws_route53_zone.zone.zone_id
  name    = aws_ses_domain_mail_from.example.mail_from_domain
  type    = "MX"
  ttl     = "600"
  records = ["10 feedback-smtp.${data.aws_region.current.name}.amazonses.com"]
}

resource "aws_route53_record" "example_ses_domain_mail_from_txt" {
  zone_id = data.aws_route53_zone.zone.zone_id
  name    = aws_ses_domain_mail_from.example.mail_from_domain
  type    = "TXT"
  ttl     = "600"
  records = ["v=spf1 include:amazonses.com -all"]
}

##########################################################################
## User Setup
##########################################################################

resource "time_rotating" "smtp_credential_rotation" {
  rotation_days = 90
}

resource "random_id" "sender_id" {
  prefix      = "smtp-sender-"
  byte_length = 8
}

resource "aws_iam_user" "mail_sender" {
  name = random_id.sender_id.hex
  tags = merge(module.tags.tags, {
    description = "Used for SMTP authentication for sending email via SES for ${var.domain}"
  })
}

data "aws_iam_policy_document" "send_email" {
  statement {
    effect    = "Allow"
    actions   = ["ses:SendRawEmail"]
    resources = ["*"]
    #    condition {
    #      test     = "StringLike"
    #      values   = ["*@${var.domain}"]
    #      variable = "ses:FromAddress"
    #    }
  }
}

resource "aws_iam_policy" "send_email" {
  name_prefix = "send-email"
  policy      = data.aws_iam_policy_document.send_email.json
}

resource "aws_iam_user_policy_attachment" "send_email" {
  policy_arn = aws_iam_policy.send_email.arn
  user       = aws_iam_user.mail_sender.name
}

resource "aws_iam_access_key" "smtp" {
  user = aws_iam_user.mail_sender.name
  lifecycle {
    create_before_destroy = true
  }
  depends_on = [time_rotating.smtp_credential_rotation]
}


