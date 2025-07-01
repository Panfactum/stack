/**
 * Standard subdomain for Single Sign-On (SSO) services
 * 
 * @remarks
 * This constant defines the subdomain used for Panfactum's SSO
 * infrastructure (typically Authentik). When a domain is added
 * to Panfactum, the SSO service will be available at:
 * `sso.{domain}`
 * 
 * @example
 * ```typescript
 * const ssoUrl = `https://${SSO_SUBDOMAIN}.${domain}`;
 * // Results in: https://sso.example.com
 * ```
 */
export const SSO_SUBDOMAIN = "sso";

/**
 * Standard subdomain for SSH bastion hosts
 * 
 * @remarks
 * This constant defines the subdomain used for Panfactum's bastion
 * host infrastructure. Bastion hosts provide secure SSH access to
 * private resources. When a domain is added, the bastion will be
 * available at: `bastion.{domain}`
 * 
 * @example
 * ```typescript
 * const bastionHost = `${BASTION_SUBDOMAIN}.${domain}`;
 * // Results in: bastion.example.com
 * ```
 */
export const BASTION_SUBDOMAIN = "bastion";