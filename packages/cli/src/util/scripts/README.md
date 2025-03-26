# Scripts

As former shell scripts are refactored into TypeScript, they will be moved into this `scripts` directory.

This will allow for easy tracking of what has been converted and what has not.

For ease of identification these files will use equivalent names as the original shell scripts minus the `pf-` prefix.

For example, `pf-get-repo-variables.sh` would become `get-repo-variables.ts`.

Each script will also have a corresponding "command" file following the same naming convention and adding a `-command` suffix.

For example, `get-repo-variables-command.ts` would be the command file for `get-repo-variables.ts`.

## Folder Structure

- `helpers` - Helper functions for the scripts
