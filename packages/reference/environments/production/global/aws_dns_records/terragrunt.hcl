include "panfactum" {
  path   = find_in_parent_folders("panfactum.hcl")
  expose = true
}

terraform {
  source = include.panfactum.locals.pf_stack_source
}

inputs = {
  zones = {
    "panfactum.com" = {
      mx_records = [
        {
          subdomain = ""
          records = [
            "1 smtp.google.com"
          ]
        }
      ]
      cname_records = [
        {
          subdomain = "gmail."
          record    = "ghs.googlehosted.com"
        },
        {
          subdomain = "drive."
          record    = "ghs.googlehosted.com"
        },
        {
          subdomain = "calendar."
          record    = "ghs.googlehosted.com"
        },
        // Domain verification (Hubspot)
        {
          subdomain = "hs."
          record    = "47029925.group25.sites.hubspot.net"
        },

        // DKIM (Hubspot)
        {
          subdomain = "hs1-47029925._domainkey."
          record    = "panfactum-com.hs06a.dkim.hubspotemail.net."
        },
        {
          subdomain = "hs2-47029925._domainkey."
          record    = "panfactum-com.hs06b.dkim.hubspotemail.net."
        },

        // Customer Portal (Hubspot)
        {
          subdomain = "tickets."
          record    = "47029925.group25.sites.hubspot.net."
        },

        // Return Path (Postmark)
        {
          subdomain = "pm-bounces."
          record    = "pm.mtasv.net."
        }
      ]
      txt_records = [
        // DMARC (email)
        {
          subdomain = "_dmarc."
          records   = ["v=DMARC1; p=quarantine; rua=mailto:security@panfactum.com; ruf=mailto:security@panfactum.com;"]
        },
        // DKIM (email - zoho)
        {
          subdomain = "zmail._domainkey."
          records = [
            "v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCxby/gQFkDpFdPv/SeR80eFSoxZZp8e/hJ+50WP5bEONClM4U83oFbJLUuGeRvMBmKsrWd5vVJq6THjDlwPAw73T8rpDSvy4bNHeuaC3x/GxalGaVTTserDvUvGpgV07EYdWq+0IaddbNzzDkahPXnLbBhkmvJubbuTTwXKomARwIDAQAB"
          ]
        },
        // DKIM (email - google)
        {
          subdomain = "google._domainkey."
          records = [
            "v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAyxt/FeLUEOazF2WCv+nj78WxNqpsByyiSgl0u9pGkAmyuEVhhUEp8oYWBt2pHkycCugCkW7tmk3ZaO+TrZ/sw5B/VlyUgaZKLcSngalzUYOvsNU5FREm1KE+MkcX610+h0PTdBQZ32MBg8yMcxKmt+FYHX7tTa5jzbai+5pTr5lVsU9ZYOnURHL9K1+itUwxyJz8VqaiqhR8wMV8tpWpLuDy6RFkatJgo8U1EohlhLQzjJTN4HUF/rjxoLEs18kTRR2ZzA3Esvi8FmERfAaO2chIldP60vBU78VAVHwi+pMavKb8U0pAyTVS/GjOQMjIRycCY7iGrvOWF2Yv6qRb/QIDAQAB"
          ]
        },
        // DKIM (CRM)
        {
          subdomain = "1522905413783._domainkey."
          records = [
            "k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCr6KMgdxxgg7oT3ulMwPJs9RXgXDrI9UWU118pHEMohl3UbL3Jwp4oxp/9N3thh/3WCJnYV134zbEVolZwqaT3JsFEq/mQ/RpW/JnOZ3rnxqJPurb2bcfJol4SDxiWVObzHX31xnANzFcXnq1/5dMK5QvW4Jh7n0fm4+4ywqiy2QIDAQAB"
          ]
        },
        // DKIM (Postmark)
        {
          subdomain = "20241006160142pm._domainkey."
          records = [
            "k=rsa;p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCcDUm9LXBvbF0cC+jgjpiTBsAOZqitLJCAdmuHOOcMoDVmDMrLWzYAtOVUpAXoPnnflPHQxWDbXlpmI1UhEuiFCqZuyM04bVBmJSBbg2dzcqBgm5Colu0T0+Mt39w1ov54mtvIZJzqqA17T48BY0LGGd6FG2UhVCOX5FPTrjjLzQIDAQAB"
          ]
        },
        // SPF
        {
          subdomain = ""
          records = [
            "MS=ms89071327",                                                                                                         // AAD Domain Ownership
            "v=spf1 include:one.zoho.com include:zohomail.com include:_spf.google.com include:47029925.spf06.hubspotemail.net ~all", // SPF record authorizing email senders
            "zoho-verification=zb69684923.zmverify.zoho.com"                                                                         // Zoho Domain Ownership
          ]
        }
      ]
    }
  }
}
