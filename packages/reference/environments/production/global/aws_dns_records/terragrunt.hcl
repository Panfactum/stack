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
            "10 mx.zoho.com",
            "20 mx2.zoho.com",
            "50 mx3.zoho.com"
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
          subdomain = "zmail._domainkey."
          records = [
            "v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCxby/gQFkDpFdPv/SeR80eFSoxZZp8e/hJ+50WP5bEONClM4U83oFbJLUuGeRvMBmKsrWd5vVJq6THjDlwPAw73T8rpDSvy4bNHeuaC3x/GxalGaVTTserDvUvGpgV07EYdWq+0IaddbNzzDkahPXnLbBhkmvJubbuTTwXKomARwIDAQAB"
          ]
        },
        // DKIM (CRM)
        {
          subdomain = "1522905413783._domainkey."
          records = [
            "k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCr6KMgdxxgg7oT3ulMwPJs9RXgXDrI9UWU118pHEMohl3UbL3Jwp4oxp/9N3thh/3WCJnYV134zbEVolZwqaT3JsFEq/mQ/RpW/JnOZ3rnxqJPurb2bcfJol4SDxiWVObzHX31xnANzFcXnq1/5dMK5QvW4Jh7n0fm4+4ywqiy2QIDAQAB"
          ]
        },
        {
          subdomain = ""
          records = [
            "MS=ms89071327",                                                                 // AAD Domain Ownership
            "v=spf1 include:one.zoho.com include:zohomail.com include:_spf.google.com ~all", // SPF record authorizing email senders
            "zoho-verification=zb69684923.zmverify.zoho.com"                                 // Zoho Domain Ownership
          ]
        }
      ]
    }
  }
}
