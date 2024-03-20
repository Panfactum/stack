include "panfactum" {
  path   = find_in_parent_folders("panfactum.hcl")
  expose = true
}

terraform {
  source = "github.com/Panfactum/stack.git?ref=main/packages/terraform//aws_dns_records"
}

inputs = {
  zones = {
    "panfactum.com" = {
      mx_records = [
        {
          subdomain = ""
          records = [
            "1 smtp.google.com",
            "15 ykrmc2xumckkmgqlgjjfkkzqcicjvadyfo5f7dpclaamrtcg7wca.mx-verification.google.com."
          ]
        }
      ]
      txt_records = [
        // DMARC (email)
        {
          subdomain = "_dmarc."
          records   = ["v=DMARC1; p=quarantine; rua=mailto:security@panfactum.com; ruf=mailto:security@panfactum.com;"]
        },
        // DKIM (email)
        {
          subdomain = "google._domainkey."
          records = [
            "v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAyxt/FeLUEOazF2WCv+nj78WxNqpsByyiSgl0u9pGkAmyuEVhhUEp8oYWBt2pHkycCugCkW7tmk3ZaO+TrZ/sw5B/VlyUgaZKLcSngalzUYOvsNU5FREm1KE+MkcX610+h0PTdBQZ32MBg8yMcxKmt+FYHX7tTa5jzbai+5pTr5lVsU9ZYOnURHL9K1+itUwxyJz8VqaiqhR8wMV8tpWpLuDy6RFkatJgo8U1EohlhLQzjJTN4HUF/rjxoLEs18kTRR2ZzA3Esvi8FmERfAaO2chIldP60vBU78VAVHwi+pMavKb8U0pAyTVS/GjOQMjIRycCY7iGrvOWF2Yv6qRb/QIDAQAB"
          ]
        },
        {
          subdomain = ""
          records = [
            "MS=ms89071327",                      // AAD Domain Ownership
            "v=spf1 include:_spf.google.com ~all" // SPF record authorizing email senders
          ]
        }
      ]
    }
  }
}
