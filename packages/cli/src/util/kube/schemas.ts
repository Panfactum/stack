// Kubernetes configuration schemas
// Provides Zod schemas for validating Kubernetes configuration files

import { z } from "zod";

/**
 * Schema for Kubernetes configuration file (~/.kube/config format)
 * 
 * @remarks
 * This schema validates the standard Kubernetes configuration file format
 * as defined by the Kubernetes client specification. It supports:
 * - Multiple clusters with certificate data and server URLs
 * - Multiple users with exec-based authentication
 * - Multiple contexts linking clusters and users
 * - Current context selection
 * 
 * The schema uses passthrough() to preserve additional fields that may be
 * present in the configuration but are not explicitly defined here.
 * 
 * @example
 * ```typescript
 * const config = KUBE_CONFIG_SCHEMA.parse({
 *   apiVersion: "v1",
 *   kind: "Config",
 *   "current-context": "my-cluster",
 *   clusters: [{
 *     name: "my-cluster",
 *     cluster: {
 *       server: "https://k8s.example.com",
 *       "certificate-authority-data": "base64-encoded-ca"
 *     }
 *   }],
 *   users: [{
 *     name: "my-user",
 *     user: {
 *       exec: {
 *         apiVersion: "client.authentication.k8s.io/v1beta1",
 *         command: "kubectl",
 *         args: ["get-token"]
 *       }
 *     }
 *   }],
 *   contexts: [{
 *     name: "my-context",
 *     context: {
 *       cluster: "my-cluster",
 *       user: "my-user"
 *     }
 *   }]
 * });
 * ```
 * 
 * @see {@link https://kubernetes.io/docs/concepts/configuration/organize-cluster-access-kubeconfig/}
 */
export const KUBE_CONFIG_SCHEMA = z.object({
    /** Kubernetes API version - always "v1" for kubeconfig */
    apiVersion: z.literal("v1"),
    
    /** Resource kind - always "Config" for kubeconfig */
    kind: z.literal("Config"),
    
    /** Currently active context name */
    "current-context": z.string().optional(),
    
    /** User preferences (usually empty) */
    preferences: z.object({}).passthrough().optional(),
    
    /** List of Kubernetes clusters */
    clusters: z.array(z.object({
        /** Cluster identifier name */
        name: z.string(),
        /** Cluster connection details */
        cluster: z.object({
            /** Base64-encoded certificate authority data */
            "certificate-authority-data": z.string().optional(),
            /** Kubernetes API server URL */
            server: z.string().optional()
        }).passthrough()
    }).passthrough()).default([]),
    
    /** List of user authentication configurations */
    users: z.array(z.object({
        /** User identifier name */
        name: z.string(),
        /** User authentication details */
        user: z.object({
            /** Exec-based authentication configuration */
            exec: z.object({
                /** Client authentication API version */
                apiVersion: z.string(),
                /** Arguments to pass to the command */
                args: z.array(z.string()).optional(),
                /** Command to execute for authentication */
                command: z.string(),
                /** Environment variables for the command */
                env: z.union([z.null(), z.array(z.object({ 
                    /** Environment variable name */
                    name: z.string(), 
                    /** Environment variable value */
                    value: z.string() 
                }))]).default(null),
                /** How to handle interactive authentication */
                interactiveMode: z.string().default("IfAvailable"),
                /** Whether to provide cluster info to exec plugin */
                provideClusterInfo: z.boolean().default(false)
            }).passthrough()
        }).passthrough()
    }).passthrough()).default([]),
    
    /** List of contexts linking users to clusters */
    contexts: z.array(z.object({
        /** Context identifier name */
        name: z.string(),
        /** Context configuration */
        context: z.object({
            /** Cluster name reference */
            cluster: z.string(),
            /** User name reference */
            user: z.string()
        }).passthrough()
    }).passthrough()).default([]),
}).passthrough();

/**
 * Inferred TypeScript type from KUBE_CONFIG_SCHEMA
 * 
 * @remarks
 * Use this type when you need to work with parsed Kubernetes configuration
 * objects in TypeScript code.
 */
export type KubeConfig = z.infer<typeof KUBE_CONFIG_SCHEMA>;

/**
 * Schema for Panfactum clusters.yaml file
 * 
 * @remarks
 * This schema validates the clusters.yaml file used by Panfactum to track
 * Kubernetes clusters across different environments and regions. Each entry
 * maps a cluster name to its configuration details.
 * 
 * @example
 * ```typescript
 * const clusters = CLUSTERS_FILE_SCHEMA.parse({
 *   "prod-cluster": {
 *     url: "https://k8s-prod.example.com",
 *     envDir: "production",
 *     regionDir: "us-east-1",
 *     caData: "base64-encoded-certificate"
 *   },
 *   "staging-cluster": {
 *     url: "https://k8s-staging.example.com",
 *     envDir: "staging",
 *     regionDir: "us-west-2",
 *     caData: "base64-encoded-certificate"
 *   }
 * });
 * ```
 */
export const CLUSTERS_FILE_SCHEMA = z.record(z.string(), z.object({
    /** Kubernetes API server URL */
    url: z.string(),
    /** Environment directory name (e.g., "production", "staging") */
    envDir: z.string(),
    /** AWS region directory name (e.g., "us-east-1") */
    regionDir: z.string(),
    /** Base64-encoded certificate authority data */
    caData: z.string()
}));

/**
 * Inferred TypeScript type from CLUSTERS_FILE_SCHEMA
 * 
 * @remarks
 * Use this type when working with parsed clusters.yaml data.
 */
export type ClustersConfig = z.infer<typeof CLUSTERS_FILE_SCHEMA>;