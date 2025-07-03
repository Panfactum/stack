// Tests for configuration validation schemas
// Verifies Zod schema validation for domains and configuration files

import { describe, test, expect } from "bun:test";
import { z } from "zod";
import { DOMAIN, SUBDOMAIN, PANFACTUM_CONFIG_SCHEMA } from "./schemas";

describe("DOMAIN schema", () => {
  test("validates correct domain names", () => {
    const validDomains = [
      "example.com",
      "sub.example.com",
      "deep.sub.example.com",
      "test-site.example.org",
      "a.b.c.d.e.f.g.h.i.j.k.l.m.n.o.p.q.r.s.t.u.v.w.x.y.z.example.com",
      "123.example.com",
      "test123.example.com",
      "x.example.com"
    ];

    for (const domain of validDomains) {
      expect(() => DOMAIN.parse(domain)).not.toThrow();
    }
  });

  test("rejects invalid domain names", () => {
    const invalidDomains = [
      "EXAMPLE.COM", // uppercase
      "Example.Com", // mixed case
      "example..com", // empty label
      ".example.com", // starts with dot
      "example.com.", // ends with dot
      "example", // single label
      "example.c", // TLD too short
      "-example.com", // starts with hyphen
      "example-.com", // ends with hyphen
      "example.com-", // TLD ends with hyphen
      "", // empty string
      "192.168.1.1", // IP address
      "example com", // contains space
      "example_test.com" // contains underscore
    ];

    for (const domain of invalidDomains) {
      expect(() => DOMAIN.parse(domain)).toThrow();
    }
  });

  test("rejects domains with labels longer than 63 characters", () => {
    const longLabel = "a".repeat(64);
    const invalidDomain = `${longLabel}.example.com`;
    
    expect(() => DOMAIN.parse(invalidDomain)).toThrow();
  });

  test("accepts domains with labels exactly 63 characters", () => {
    const maxLabel = "a".repeat(63);
    const validDomain = `${maxLabel}.example.com`;
    
    expect(() => DOMAIN.parse(validDomain)).not.toThrow();
  });

  test("rejects domains longer than 253 characters", () => {
    // Create a domain longer than 253 characters
    const longDomain = "a".repeat(60) + "." + "b".repeat(60) + "." + "c".repeat(60) + "." + "d".repeat(60) + "." + "e".repeat(20) + ".com";
    
    expect(longDomain.length).toBeGreaterThan(253);
    expect(() => DOMAIN.parse(longDomain)).toThrow();
  });

  test("accepts domains exactly 253 characters", () => {
    // Create a domain exactly 253 characters with valid labels
    // 63 + 1 + 63 + 1 + 63 + 1 + 58 + 1 + 2 = 253
    const exactDomain = "a".repeat(63) + "." + "b".repeat(63) + "." + "c".repeat(63) + "." + "d".repeat(58) + ".co";
    
    expect(exactDomain.length).toBe(253);
    expect(() => DOMAIN.parse(exactDomain)).not.toThrow();
  });
});

describe("SUBDOMAIN schema", () => {
  test("validates correct subdomain segments", () => {
    const validSubdomains = [
      "staging",
      "prod",
      "dev",
      "test-env",
      "prod-v2",
      "env123",
      "a",
      "a1",
      "1a",
      "test-123-env"
    ];

    for (const subdomain of validSubdomains) {
      expect(() => SUBDOMAIN.parse(subdomain)).not.toThrow();
    }
  });

  test("rejects invalid subdomain segments", () => {
    const invalidSubdomains = [
      "STAGING", // uppercase
      "Staging", // mixed case
      "test.env", // contains dot
      "-staging", // starts with hyphen
      "staging-", // ends with hyphen
      "", // empty string
      "test env", // contains space
      "test_env", // contains underscore
      "staging.example.com" // full domain instead of segment
    ];

    for (const subdomain of invalidSubdomains) {
      expect(() => SUBDOMAIN.parse(subdomain)).toThrow();
    }
  });

  test("rejects subdomains longer than 63 characters", () => {
    const longSubdomain = "a".repeat(64);
    
    expect(() => SUBDOMAIN.parse(longSubdomain)).toThrow();
  });

  test("accepts subdomains exactly 63 characters", () => {
    const maxSubdomain = "a".repeat(63);
    
    expect(() => SUBDOMAIN.parse(maxSubdomain)).not.toThrow();
  });
});

describe("PANFACTUM_CONFIG_SCHEMA", () => {
  test("validates minimal valid configuration", () => {
    const minimalConfig = {
      tf_state_region: "us-east-1",
      aws_region: "us-east-1",
      aws_secondary_region: "us-west-2"
    };

    expect(() => PANFACTUM_CONFIG_SCHEMA.parse(minimalConfig)).not.toThrow();
  });

  test("validates complete configuration", () => {
    const completeConfig = {
      domains: {
        "example.com": {
          zone_id: "Z1234567890ABC",
          record_manager_role_arn: "arn:aws:iam::123456789012:role/DNSManager"
        },
        "api.example.com": {
          zone_id: "Z9876543210XYZ",
          record_manager_role_arn: "arn:aws:iam::123456789012:role/APIDNSManager"
        }
      },
      sla_target: 2,
      extra_tags: {
        "Environment": "production",
        "Team": "platform"
      },
      environment: "production",
      environment_subdomain: "prod",
      region: "primary",
      extra_inputs: {
        "custom_setting": "value",
        "replica_count": 3
      },
      version: "v1.2.3",
      pf_stack_version: "24.05.1",
      pf_stack_local_path: "/opt/panfactum",
      pf_stack_local_use_relative: true,
      module: "kube_cluster",
      tf_state_account_id: "123456789012",
      tf_state_profile: "production",
      tf_state_region: "us-east-1",
      tf_state_bucket: "tf-production-state-bucket",
      tf_state_lock_table: "tf-production-locks",
      aws_account_id: "123456789012",
      aws_profile: "production",
      aws_region: "us-east-1",
      aws_secondary_account_id: "987654321098",
      aws_secondary_profile: "production-secondary",
      aws_secondary_region: "us-west-2",
      kube_api_server: "https://api.cluster.example.com",
      kube_name: "production-cluster",
      kube_domain: "cluster.example.com",
      kube_config_context: "production-context",
      vault_addr: "https://vault.example.com",
      vault_token: "hvs.CAESIJ...",
      authentik_url: "https://auth.example.com",
      authentik_token: "ak_123456789"
    };

    const result = PANFACTUM_CONFIG_SCHEMA.parse(completeConfig);
    expect(result).toMatchInlineSnapshot(`
      {
        "authentik_token": "ak_123456789",
        "authentik_url": "https://auth.example.com",
        "aws_account_id": "123456789012",
        "aws_profile": "production",
        "aws_region": "us-east-1",
        "aws_secondary_account_id": "987654321098",
        "aws_secondary_profile": "production-secondary",
        "aws_secondary_region": "us-west-2",
        "domains": {
          "api.example.com": {
            "record_manager_role_arn": "arn:aws:iam::123456789012:role/APIDNSManager",
            "zone_id": "Z9876543210XYZ",
          },
          "example.com": {
            "record_manager_role_arn": "arn:aws:iam::123456789012:role/DNSManager",
            "zone_id": "Z1234567890ABC",
          },
        },
        "environment": "production",
        "environment_subdomain": "prod",
        "extra_inputs": {
          "custom_setting": "value",
          "replica_count": 3,
        },
        "extra_tags": {
          "Environment": "production",
          "Team": "platform",
        },
        "kube_api_server": "https://api.cluster.example.com",
        "kube_config_context": "production-context",
        "kube_domain": "cluster.example.com",
        "kube_name": "production-cluster",
        "module": "kube_cluster",
        "pf_stack_local_path": "/opt/panfactum",
        "pf_stack_local_use_relative": true,
        "pf_stack_version": "24.05.1",
        "region": "primary",
        "sla_target": 2,
        "tf_state_account_id": "123456789012",
        "tf_state_bucket": "tf-production-state-bucket",
        "tf_state_lock_table": "tf-production-locks",
        "tf_state_profile": "production",
        "tf_state_region": "us-east-1",
        "vault_addr": "https://vault.example.com",
        "vault_token": "hvs.CAESIJ...",
        "version": "v1.2.3",
      }
    `);
  });

  test("validates domain configuration", () => {
    const configWithDomains = {
      tf_state_region: "us-east-1",
      aws_region: "us-east-1",
      aws_secondary_region: "us-west-2",
      domains: {
        "example.com": {
          zone_id: "Z1234567890ABC",
          record_manager_role_arn: "arn:aws:iam::123456789012:role/DNSManager"
        }
      }
    };

    expect(() => PANFACTUM_CONFIG_SCHEMA.parse(configWithDomains)).not.toThrow();
  });

  test("rejects invalid domain keys in domains configuration", () => {
    const configWithInvalidDomain = {
      tf_state_region: "us-east-1",
      aws_region: "us-east-1",
      aws_secondary_region: "us-west-2",
      domains: {
        "INVALID.DOMAIN": { // uppercase domain
          zone_id: "Z1234567890ABC",
          record_manager_role_arn: "arn:aws:iam::123456789012:role/DNSManager"
        }
      }
    };

    expect(() => PANFACTUM_CONFIG_SCHEMA.parse(configWithInvalidDomain)).toThrow();
  });

  test("rejects invalid environment_subdomain", () => {
    const configWithInvalidSubdomain = {
      tf_state_region: "us-east-1",
      aws_region: "us-east-1",
      aws_secondary_region: "us-west-2",
      environment_subdomain: "Invalid.Subdomain" // contains dot and uppercase
    };

    expect(() => PANFACTUM_CONFIG_SCHEMA.parse(configWithInvalidSubdomain)).toThrow();
  });

  test("validates SLA target values", () => {
    const validSLATargets = [1, 2, 3];
    
    for (const slaTarget of validSLATargets) {
      const config = {
        tf_state_region: "us-east-1",
        aws_region: "us-east-1",
        aws_secondary_region: "us-west-2",
        sla_target: slaTarget
      };
      
      expect(() => PANFACTUM_CONFIG_SCHEMA.parse(config)).not.toThrow();
    }
  });

  test("rejects invalid SLA target values", () => {
    const invalidSLATargets = [0, 4, 5, "high", null];
    
    for (const slaTarget of invalidSLATargets) {
      const config = {
        tf_state_region: "us-east-1",
        aws_region: "us-east-1",
        aws_secondary_region: "us-west-2",
        sla_target: slaTarget
      };
      
      expect(() => PANFACTUM_CONFIG_SCHEMA.parse(config)).toThrow();
    }
  });

  test("validates AWS regions using AWS_REGION_SCHEMA", () => {
    const validConfig = {
      tf_state_region: "us-east-1",
      aws_region: "eu-west-1",
      aws_secondary_region: "ap-southeast-2"
    };

    expect(() => PANFACTUM_CONFIG_SCHEMA.parse(validConfig)).not.toThrow();
  });

  test("rejects invalid AWS regions", () => {
    const configWithInvalidRegion = {
      tf_state_region: "invalid-region",
      aws_region: "us-east-1",
      aws_secondary_region: "us-west-2"
    };

    expect(() => PANFACTUM_CONFIG_SCHEMA.parse(configWithInvalidRegion)).toThrow();
  });

  test("validates S3 bucket names using BUCKET_NAME_SCHEMA", () => {
    const configWithBucket = {
      tf_state_region: "us-east-1",
      aws_region: "us-east-1",
      aws_secondary_region: "us-west-2",
      tf_state_bucket: "my-terraform-state-bucket"
    };

    expect(() => PANFACTUM_CONFIG_SCHEMA.parse(configWithBucket)).not.toThrow();
  });

  test("rejects invalid S3 bucket names", () => {
    const configWithInvalidBucket = {
      tf_state_region: "us-east-1",
      aws_region: "us-east-1",
      aws_secondary_region: "us-west-2",
      tf_state_bucket: "Invalid_Bucket_Name" // underscores not allowed
    };

    expect(() => PANFACTUM_CONFIG_SCHEMA.parse(configWithInvalidBucket)).toThrow();
  });

  test("accepts empty configuration (all fields optional except required regions)", () => {
    const emptyConfig = {
      tf_state_region: "us-east-1",
      aws_region: "us-east-1",
      aws_secondary_region: "us-west-2"
    };

    expect(() => PANFACTUM_CONFIG_SCHEMA.parse(emptyConfig)).not.toThrow();
  });

  test("rejects extra properties due to strict mode", () => {
    const configWithExtraProps = {
      tf_state_region: "us-east-1",
      aws_region: "us-east-1",
      aws_secondary_region: "us-west-2",
      unknown_field: "should not be allowed"
    };

    expect(() => PANFACTUM_CONFIG_SCHEMA.parse(configWithExtraProps)).toThrow();
  });

  test("validates extra_inputs as arbitrary key-value pairs", () => {
    const configWithExtraInputs = {
      tf_state_region: "us-east-1",
      aws_region: "us-east-1",
      aws_secondary_region: "us-west-2",
      extra_inputs: {
        "string_value": "test",
        "number_value": 42,
        "boolean_value": true,
        "object_value": { nested: "value" },
        "array_value": [1, 2, 3]
      }
    };

    expect(() => PANFACTUM_CONFIG_SCHEMA.parse(configWithExtraInputs)).not.toThrow();
  });

  test("validates extra_tags as string key-value pairs", () => {
    const configWithExtraTags = {
      tf_state_region: "us-east-1",
      aws_region: "us-east-1",
      aws_secondary_region: "us-west-2",
      extra_tags: {
        "Environment": "production",
        "Team": "platform",
        "CostCenter": "engineering"
      }
    };

    expect(() => PANFACTUM_CONFIG_SCHEMA.parse(configWithExtraTags)).not.toThrow();
  });

  test("exports proper TypeScript type", () => {
    // This test ensures the type export works correctly
    const config = {
      tf_state_region: "us-east-1" as const,
      aws_region: "us-east-1" as const,
      aws_secondary_region: "us-west-2" as const,
      environment: "test"
    };

    const parsed = PANFACTUM_CONFIG_SCHEMA.parse(config);
    
    // TypeScript compile-time check that the type is correctly inferred
    const typedConfig: z.infer<typeof PANFACTUM_CONFIG_SCHEMA> = parsed;
    expect(typedConfig.environment).toBe("test");
  });
});