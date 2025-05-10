import { MODULE_STATUS_FILE } from "../terragrunt/constants";

export const EXPECTED_GITIGNORE_CONTENTS = {
    aws: [
        "*",
        "!config",
        "!.gitignore"
    ],
    environments: [
        "*.user.yaml",
        MODULE_STATUS_FILE
    ],
    kube: [
        "*",
        "!clusters.yaml",
        "!.gitignore"
    ],
    ssh: [
        "*",
        "!.gitignore",
        "!connection_info",
        "!known_hosts"
    ],
    root: [
        ".devenv",
        ".terraform",
        ".env",
        ".terragrunt-cache",
        ".direnv",
        ".terraformrc",
        ".terraformrc.dev",
        ".nats"
    ]
}