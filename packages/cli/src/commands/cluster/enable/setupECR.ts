import path from "node:path";
import {Listr} from "listr2";
import {z} from "zod";
import awsEcrPullThroughCacheTerragruntHcl from "@/templates/aws_ecr_pull_through_cache_terragrunt.hcl" with { type: "file" };
import {upsertConfigValues} from "@/util/config/upsertConfigValues.ts";
import { sopsDecrypt } from "@/util/sops/sopsDecrypt";
import { sopsUpsert } from "@/util/sops/sopsUpsert";
import { MODULES } from "@/util/terragrunt/constants";
import { buildDeployModuleTask, defineInputUpdate } from "@/util/terragrunt/tasks/deployModuleTask";
import { terragruntApplyAll } from "@/util/terragrunt/terragruntApplyAll";
import { readYAMLFile } from "@/util/yaml/readYAMLFile";
import type { FeatureEnableOptions } from "./command";

const DOCKERHUB_USERNAME = z
  .string()
  .min(3, "DockerHub username must be at least 3 characters long")
  .max(63, "DockerHub username must be less than 63 characters long")
  .regex(
    /^[a-zA-Z0-9_-]+$/,
    "Must only contain the letters a-z (case-insensitive), numbers 0-9, hyphens (-), and underscores (_)"
  )
  .regex(/^(?!aws:).*$/i, "Cannot start with 'AWS:' (case insensitive)");

const GITHUB_USERNAME = z
  .string()
  .min(3, "GitHub username must be at least 3 characters long")
  .max(63, "GitHub username must be less than 63 characters long")
  .regex(
    /^[a-zA-Z0-9_-]+$/,
    "Must only contain the letters a-z (case-insensitive), numbers 0-9, hyphens (-), and underscores (_)"
  );



export async function setupECR({context, clusterPath, region, environment}: FeatureEnableOptions) {

  interface Context {
    dockerHubUsername?: string;
    githubUsername?: string;
  }

  const tasks = new Listr<Context>([
    {
      title: "Get ECR configuration",
      task: async (ctx, task) => {
        const moduleName = "aws_ecr_pull_through_cache";
        const modulePath = path.join(clusterPath, moduleName);
        const secretsPath = path.join(modulePath, "secrets.yaml");

        let ghPAT, dhPAT;

        const savedSecets = await sopsDecrypt({
          filePath: secretsPath,
          context,
          validationSchema: z.object({
            github_access_token: z.string().optional(),
            docker_hub_access_token: z.string().optional(),
          }),
        })

        if (savedSecets) {
          ({ github_access_token: ghPAT, docker_hub_access_token: dhPAT } = savedSecets);
        }

        const originalInputs = await readYAMLFile({
          filePath: path.join(
            clusterPath,
            MODULES.AWS_ECR_PULL_THROUGH_CACHE,
            "module.yaml"
          ),
          context,
          validationSchema: z
            .object({
              extra_inputs: z
                .object({
                  docker_hub_username: z.string().optional(),
                  github_username: z.string().optional(),
                })
                .passthrough()
                .optional()
                .default({}),
            })
            .passthrough(),
        });

        ctx.dockerHubUsername = originalInputs?.extra_inputs.docker_hub_username;
        ctx.githubUsername = originalInputs?.extra_inputs.github_username;

        if (
          originalInputs?.extra_inputs?.docker_hub_username &&
          originalInputs?.extra_inputs?.github_username &&
          dhPAT &&
          ghPAT
        ) {
          ctx.dockerHubUsername =
            originalInputs.extra_inputs.docker_hub_username;
          ctx.githubUsername = originalInputs.extra_inputs.github_username;
          task.skip("Skip: Already have ECR configuration");
          return;
        }

        if (!ctx.dockerHubUsername) {
          ctx.dockerHubUsername = await context.logger.input({
            task,
            message: "Enter your Docker Hub username:",
            required: true,
            validate: async (value) => {
              const { error } = DOCKERHUB_USERNAME.safeParse(value);
              if (error) {
                return error.issues[0]?.message ?? "Invalid username";
              } else {
                return true;
              }
            },
          });
        }

        if (!dhPAT) {
          dhPAT = await context.logger.password({
            task,
            message:
              "Enter your Docker Hub Access Token with 'Public Repo Read-only' permissions\n" +
              "For more details on how to create one, see our documentation: https://panfactum.com/docs/edge/guides/bootstrapping/kubernetes-cluster#docker-hub-credentials\n" +
              "This will be encrypted and stored securely:",
            validate: async (value) => {
              try {
                const response = await globalThis.fetch(
                  "https://hub.docker.com/v2/repositories/library/nginx/tags",
                  {
                    headers: {
                      Authorization: `Bearer ${value}`,
                    },
                  }
                );
                if (response.status !== 200) {
                  return "This does not appear to be a valid Docker Hub Access Token or the permissions are not correct";
                }
                return true;
              } catch {
                return "Error validating Docker Hub Access Token, please try again.";
              }
            },
          });
          await sopsUpsert({
            values: { docker_hub_access_token: dhPAT },
            context,
            filePath: secretsPath,
          });
        }

        if (!ctx.githubUsername) {
          ctx.githubUsername = await context.logger.input({
            task,
            message: "Enter your GitHub username:",
            validate: async (value) => {
              const { error } = GITHUB_USERNAME.safeParse(value);
              if (error) {
                return error.issues[0]?.message ?? "Invalid username";
              } else {
                return true;
              }
            },
          });
        }

        if (!ghPAT) {
          ghPAT = await context.logger.password({
            task,
            message:
              "Enter your classic GitHub Personal Access Token with 'read:packages' scope\n" +
              "For more details on how to create one, see our documentation: https://panfactum.com/docs/edge/guides/bootstrapping/kubernetes-cluster#github-credentials\n" +
              "This will be encrypted and stored securely:",
            validate: async (value) => {
              try {
                const response = await globalThis.fetch(
                  "https://api.github.com/user/packages?package_type=container",
                  {
                    headers: {
                      Authorization: `Bearer ${value}`,
                    },
                  }
                );
                if (response.status !== 200) {
                  return "This does not appear to be a valid GitHub Personal Access Token or the permissions are not correct";
                }
                return true;
              } catch {
                return "Error validating GitHub Personal Access Token, please try again.";
              }
            },
          });
          await sopsUpsert({
            values: { github_access_token: ghPAT },
            context,
            filePath: secretsPath,
          });
        }
      }
    },
    await buildDeployModuleTask<Context>({
      taskTitle: "Deploy ECR Pull Through Cache",
      context,
      environment,
      region,
      skipIfAlreadyApplied: true,
      module: MODULES.AWS_ECR_PULL_THROUGH_CACHE,
      hclIfMissing: await Bun.file(
        awsEcrPullThroughCacheTerragruntHcl
      ).text(),
      // TODO: @seth - Interested in your opinion
      // I don't like `ctx.dockerHubUsername!` even though I've been using it
      // I think we may want to incorporate some sort of runtime validation here.
      // as I believe we should be doing EXTREMELY defensive coding
      // b/c of how annoying it would be for users if something messed up
      // with a vague error (e.g., dockerHubUsername being undefined accidentally)
      inputUpdates: {
        docker_hub_username: defineInputUpdate({
          schema: z.string(),
          update: (_, ctx) => ctx.dockerHubUsername!,
        }),
        github_username: defineInputUpdate({
          schema: z.string(),
          update: (_, ctx) => ctx.githubUsername!,
        }),
      },
    }),
    {
      title: "Enable ECR Pull Through Cache",
      task: async() => {
        await upsertConfigValues({
          context,
          environment,
          region,
          values: {
            extra_inputs: {
              pull_through_cache_enabled: true
            }
          }
        });
      }
    },
    {
      title: "Apply all",
      task: async (_, task) => {
        await terragruntApplyAll({
          context,
          environment,
          region,
          onLogLine: (line) => {
            task.output = context.logger.applyColors(line, {style: "subtle", highlighterDisabled: true});
          },
        })
      },
      rendererOptions: {
        outputBar: 5,
      }
    }

  ], { rendererOptions: { collapseErrors: false } });

  return tasks;
}