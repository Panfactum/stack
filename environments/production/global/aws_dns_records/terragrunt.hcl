include "panfactum" {
  path   = find_in_parent_folders("panfactum.hcl")
  expose = true
}

terraform {
  source = include.panfactum.locals.pf_stack_source
}

inputs = {
  zones = {
    "panfactum.io" = {
      txt_records = [
        {
          subdomain = ""
          records = [
            "google-site-verification=tenvTVieM24GKkkL1rRMsv2ZcZK8iqYNxASZYH6deV4", // Google Site Verification
            "v=spf1 mx include:_spf.google.com ~all",                               // SPF record authorizing email senders
          ]
        },

        // DKIM (email - google)
        # {
        #   subdomain = "google._domainkey."
        #   records = [
        #     "v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAs2DiViVSWtU/jloGJ10bD7usBBcdBw9tVeVD1a8H5t9onb4vM7VvsbI3P+FF2p2+nIGjOfnTs0HbxNe2cZ+YPw7gNxsuDkFRnNxiwNaImeKS0SBQYQ4R5+q1tY2Xgm49xqdkWiPgPPMMtIQxrUSc3gZcpgfBaQHwX/Ca33FMLSOFnm7yGs6wvDhsbUsZvCd300//glJseGYyoYCj3bcVK7bpHdF91CcKEsUK/bd1GJc6FjfsZNGVgr1cRUpHO+It914c41XPCQRMuCZbb0jTy9Su4ahEQot3lyyoqKtrQB+XsytP7CDbgGuFnR7azbuivLvkDwtVPo3dia4vO/QT6QIDAQAB"
        #   ]
        # },

        // DMARC (email)
        {
          subdomain = "_dmarc."
          records = [
            "v=DMARC1; p=reject; rua=mailto:ipm6uhv@ar.glockapps.com; ruf=mailto:ipm6uhv@fr.glockapps.com; fo=1;"
          ]
        }
      ]
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
          subdomain = "emailtracking"
          record    = "open.sleadtrack.com"
        }
      ]
    }
    "trypanfactum.com" = {
      txt_records = [
        {
          subdomain = ""
          records = [
            "google-site-verification=FeQQV4StQNkbiNostgR4n_puseQdhrk1tAwOjpmV91E", // Google Site Verification
            "v=spf1 mx include:_spf.google.com ~all",                               // SPF record authorizing email senders
          ]
        },

        // DKIM (email - google)
        {
          subdomain = "google._domainkey."
          records = [
            "v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAs2DiViVSWtU/jloGJ10bD7usBBcdBw9tVeVD1a8H5t9onb4vM7VvsbI3P+FF2p2+nIGjOfnTs0HbxNe2cZ+YPw7gNxsuDkFRnNxiwNaImeKS0SBQYQ4R5+q1tY2Xgm49xqdkWiPgPPMMtIQxrUSc3gZcpgfBaQHwX/Ca33FMLSOFnm7yGs6wvDhsbUsZvCd300//glJseGYyoYCj3bcVK7bpHdF91CcKEsUK/bd1GJc6FjfsZNGVgr1cRUpHO+It914c41XPCQRMuCZbb0jTy9Su4ahEQot3lyyoqKtrQB+XsytP7CDbgGuFnR7azbuivLvkDwtVPo3dia4vO/QT6QIDAQAB"
          ]
        },

        // DMARC (email)
        {
          subdomain = "_dmarc."
          records = [
            "v=DMARC1; p=reject; rua=mailto:ipm6uhv@ar.glockapps.com; ruf=mailto:ipm6uhv@fr.glockapps.com; fo=1;"
          ]
        }
      ]
      mx_records = [
        {
          subdomain = ""
          records = [
            "1 smtp.google.com"
          ]
        }
      ]
    }
    "getpanfactum.com" = {
      txt_records = [
        {
          subdomain = ""
          records = [
            "google-site-verification=T7P6g2fvaBUZ2Xby1GcdHGbOYwTOr0CGWniC_MH_qIg", // Google Site Verification
            "v=spf1 mx include:_spf.google.com ~all",                               // SPF record authorizing email senders
          ]
        },

        // DKIM (email - google)
        {
          subdomain = "google._domainkey."
          records = [
            "v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA0H64obBtmcSiIMZ0YTNa/leOWqOJ+doK2d+jdsJ/VryNIM6r0JjcZv1XyAqefkRLkrmA6V6Co1XIUt74e1AIJAnyifcRzux/fLC4I74HqDkA5rEjGIIYaentSxYGnThlC83APfAMOPzQmIHcaPyFmgaLr4ZEEWPFzg0mhio9EgXlbwv1xAj2xJil1PTa+OWNNn8T4Z3eFoBDzeD1lGmno7jj0Hb9Dq9aMbnRPe0hv6zzev7QawSsfbRKz2AIzHcDdVCNts7+tV3ybuSM2aBJ0TGlGRorIzlS4PUaWnN/Cvi9GzVSB+qH78Ix7/F0gB6TTNmq5FLg5PiJxcvVdc/z1QIDAQAB"
          ]
        },


        // DMARC (email)
        {
          subdomain = "_dmarc."
          records = [
            "v=DMARC1; p=reject; rua=mailto:ipm6uhv@ar.glockapps.com; ruf=mailto:ipm6uhv@fr.glockapps.com; fo=1;"
          ]
        }
      ]
      mx_records = [
        {
          subdomain = ""
          records = [
            "1 smtp.google.com"
          ]
        }
      ]
    }
    "panfactum.com" = {
      a_records = [
        // Softr client portal
        {
          subdomain = ""
          records   = ["31.43.160.6", "31.43.161.6"]
        }
      ]
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
          subdomain = "www."
          record    = "sites.framer.app"
        },
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
        },
        // DKIM (Stripe)
        {
          subdomain = "swe5yoosjaxfr7lj4k3dxhg4ekdjjcue._domainkey."
          record    = "swe5yoosjaxfr7lj4k3dxhg4ekdjjcue.dkim.custom-email-domain.stripe.com."
        },
        {
          subdomain = "vssehpdavbhx5yt753kftjhktxco3ruk._domainkey."
          record    = "vssehpdavbhx5yt753kftjhktxco3ruk.dkim.custom-email-domain.stripe.com."
        },
        {
          subdomain = "jtchiwpet4rczncf5vnxo6noevlkoey5._domainkey."
          record    = "jtchiwpet4rczncf5vnxo6noevlkoey5.dkim.custom-email-domain.stripe.com."
        },
        {
          subdomain = "xuqjbph5aztrdrkflm7o6n2rntmn2rmd._domainkey."
          record    = "xuqjbph5aztrdrkflm7o6n2rntmn2rmd.dkim.custom-email-domain.stripe.com."
        },
        {
          subdomain = "rb6ll6tuxzcdaoefrsqcokogssts54rm._domainkey."
          record    = "rb6ll6tuxzcdaoefrsqcokogssts54rm.dkim.custom-email-domain.stripe.com."
        },
        {
          subdomain = "zxewgpehkjpnthawp5hchrsolg45ybh7._domainkey."
          record    = "zxewgpehkjpnthawp5hchrsolg45ybh7.dkim.custom-email-domain.stripe.com."
        },
        // Return Path (Stripe)
        {
          subdomain = "bounce."
          record    = "custom-email-domain.stripe.com."
        },

        // Beehiiv (Newsletters)
        {
          subdomain = "em8269.newsletters."
          record    = "u52680821.wl072.sendgrid.net."
        },
        {
          subdomain = "255._domainkey.newsletters"
          record    = "255.domainkey.u52680821.wl072.sendgrid.net."
        },
        {
          subdomain = "2552._domainkey.newsletters."
          record    = "2552.domainkey.u52680821.wl072.sendgrid.net."
        },
        {
          subdomain = "elink7cf.newsletters."
          record    = "branded-link.beehiiv.com."
        },
        {
          subdomain = "52680821.newsletters."
          record    = "sendgrid.net."
        },
        {
          subdomain = "investors."
          record    = "cname.beehiiv.com."
        }
      ]
      txt_records = [
        // Beehiiv (Newsletters)
        {
          subdomain = "newsletters."
          records = [
            "_beehiiv-authentication-c4797=5c0e73f2278b35bffdb0468f44830fbe0640830a"
          ]
        },
        // DMARC (email)
        {
          subdomain = "_dmarc."
          records   = ["v=DMARC1; p=reject; rua=mailto:ipm6uhv@ar.glockapps.com; ruf=mailto:ipm6uhv@fr.glockapps.com; fo=1;"]
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
        // DKIM (Softr)
        {
          subdomain = "20241008124742pm._domainkey."
          records = [
            "k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDX/YXKtm+Yl3YS3TuyyeG4TBaNxm+Bear1TWitjKDU79VaYekcO+VjzHVsjD5PWz51coAH24o/4c89QE8EFYC/S/WSxU0BSG1P2y0rfoz3xP/9GVDCvZJn5KNUIH/LqPfFiW7oHcSAl2UQsSw2Gs5e79qSuRcZyOxZGLCvZvsZWQIDAQAB"
          ]
        },
        // SPF and Verifications
        {
          subdomain = ""
          records = [
            "MS=ms89071327",                                                                                        // AAD Domain Ownership
            "v=spf1 mx include:_spf.google.com include:47029925.spf06.hubspotemail.net include:amazonses.com ~all", // SPF record authorizing email senders
            "zoho-verification=zb69684923.zmverify.zoho.com",                                                       // Zoho Domain Ownership
            "google-site-verification=wqLBavRglKYaCzJSVSswEgSagHgrul-N4lgAyMxG_YQ",                                 // Panfactum.com Google Search Console
            "mongodb-site-verification=xKjI6laWuGX2iX9pOyXnVqJt7BxrgvVt",                                           // Panfactum.com MongoDB Atlas SSO
            "stripe-verification=e974df024c29569f82cceeacf4f0bbe7f6abace14bc538961a2076d26513afa9",                 // Stripe domain verification (email sending)
            "asv=8aac24d1b02697630a27d2337948e5e8"                                                                  // Asana domain verification
          ]
        },
        // GitHub Verification
        {
          subdomain = "_gh-Panfactum-e"
          records   = ["66a27fe1ec"]
        }
      ]
    }
  }
}
