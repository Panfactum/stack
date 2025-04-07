#!/usr/bin/env bun
import { Builtins, Cli } from "clipanion";
import { InstallClusterCommand } from "./commands/cluster/install/command";
import { CheckRepoSetupCommand } from "./util/scripts/check-repo-setup-command";
import { EksResetCommand } from "./util/scripts/eks-reset-command";
import { GetAWSStateHashCommand } from "./util/scripts/get-aws-state-hash-command";
import { GetBuildkitStateHashCommand } from "./util/scripts/get-buildkit-state-hash-command";
import { GetBuildkitUserStateHashCommand } from "./util/scripts/get-buildkit-user-state-hash-command";
import { GetKubeStateHashCommand } from "./util/scripts/get-kube-state-hash-command";
import { GetKubeTokenCommand } from "./util/scripts/get-kube-token-command";
import { GetKubeUserStateHashCommand } from "./util/scripts/get-kube-user-state-hash-command";
import { GetRepoVariablesCommand } from "./util/scripts/get-repo-variables-command";
import { GetSSHStateHashCommand } from "./util/scripts/get-ssh-state-hash-command";
import { GetTerragruntVariablesCommand } from "./util/scripts/get-terragrunt-variables-command";
import { TerragruntInitCommand } from "./util/scripts/tf-init-command";
import { UpdateAWSCommand } from "./util/scripts/update-aws-command";
import { UpdateBuildkitCommand } from "./util/scripts/update-buildkit-command";
import { UpdateKubeCommand } from "./util/scripts/update-kube-command";
import { UpdateSSHCommand } from "./util/scripts/update-ssh-command";
import { VpcNetworkTestCommand } from "./util/scripts/vpc-network-test-command";

// @ts-ignore Bun needs the explicit non-index syntax to overwrite this at build time with the --define flag
const VERSION = process.env.VERSION ?? "unknown";

// Create a CLI instance
const cli = new Cli({
  binaryName: "pf",
  binaryLabel: "Panfactum CLI",
  binaryVersion: VERSION,
});

// Register commands
// Builtins
cli.register(Builtins.HelpCommand);
cli.register(Builtins.VersionCommand);

// Commands
cli.register(InstallClusterCommand);

// Migrated Scripts
cli.register(CheckRepoSetupCommand);
cli.register(EksResetCommand);
cli.register(GetAWSStateHashCommand);
cli.register(GetBuildkitStateHashCommand);
cli.register(GetBuildkitUserStateHashCommand);
cli.register(GetKubeStateHashCommand);
cli.register(GetKubeTokenCommand);
cli.register(GetKubeUserStateHashCommand);
cli.register(GetRepoVariablesCommand);
cli.register(GetSSHStateHashCommand);
cli.register(GetTerragruntVariablesCommand);
cli.register(TerragruntInitCommand);
cli.register(UpdateAWSCommand);
cli.register(UpdateBuildkitCommand);
cli.register(UpdateKubeCommand);
cli.register(UpdateSSHCommand);
cli.register(VpcNetworkTestCommand);

// Parse and run
cli.runExit(process.argv.slice(2), {
  ...Cli.defaultContext,
});
