import { input } from "@inquirer/prompts";

export async function kubernetesClusterPrompts({
  environment,
}: {
  environment: string;
}) {
  // https://panfactum.com/docs/edge/guides/bootstrapping/kubernetes-cluster#choose-a-cluster-name
  const clusterName = await input({
    message: "Enter a name for your Kubernetes cluster:",
    default: `panfactum-${environment}`,
    validate: (value) => {
      if (value.length > 100) {
        return "Cluster name must be less than 100 characters";
      }
      if (value.includes(" ")) {
        return "Cluster name cannot contain spaces";
      }
      return true;
    },
  });

  const clusterDescription = await input({
    message: "Enter a description for your Kubernetes cluster:",
    default: `Panfactum Kubernetes cluster for the ${environment} environment`,
  });

  return { clusterDescription, clusterName };
}
