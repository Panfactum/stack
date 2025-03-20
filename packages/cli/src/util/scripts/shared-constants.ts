import { updateAWS } from "./update-aws";
import { updateBuildkit } from "./update-buildkit";
import { updateKube } from "./update-kube";
import { updateSSH } from "./update-ssh";

// This file is used to prevent circular dependencies

const hasher = new Bun.CryptoHasher("md5");
export const updateSSHHash = hasher.update(String(updateSSH)).digest("hex");
export const updateKubeHash = hasher.update(String(updateKube)).digest("hex");
export const updateAWSHash = hasher.update(String(updateAWS)).digest("hex");
export const updateBuildkitHash = hasher
  .update(String(updateBuildkit))
  .digest("hex");
