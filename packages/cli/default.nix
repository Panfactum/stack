{
  pkgs,
  bun2nix,
  smol ? false,
  ...
}:
let
  bunDeps = bun2nix.fetchBunDeps { bunNix = ./bun.nix; };
  packageJson = builtins.fromJSON (builtins.readFile ./package.json);

  # Transform the workspace root lockfile into a standalone lockfile for the CLI.
  # The root bun.lock uses JSONC (trailing commas) and references workspace packages
  # that don't exist in the isolated build. We strip trailing commas, promote the
  # CLI workspace entry to root, and remove workspace package references.
  standaloneLockfile = pkgs.runCommand "cli-bun-lock" { nativeBuildInputs = [ pkgs.jq ]; } ''
    # Strip trailing commas to produce valid JSON, then transform the workspace
    # lockfile into a standalone lockfile with only the CLI's dependencies
    sed -zE 's/,\n(\s*[])}])/\n\1/g' ${../../bun.lock} \
      | jq '{
          lockfileVersion: .lockfileVersion,
          workspaces: {"": .workspaces["packages/cli"]},
          packages: (.packages | with_entries(select(.value[0] | test("@workspace:") | not)))
        }' > $out
  '';
in
pkgs.stdenv.mkDerivation {
  inherit (packageJson) name version;
  src = pkgs.nix-gitignore.gitignoreSource [ ] ./.;

  nativeBuildInputs = with pkgs; [
    jq
    bun2nix.hook
  ];

  inherit bunDeps;

  # Copy the transformed standalone lockfile into the build
  postUnpack = ''
    cp ${standaloneLockfile} $sourceRoot/bun.lock
  '';

  # Disable lifecycle scripts (postinstall runs bun2nix which isn't needed in the build)
  dontRunLifecycleScripts = true;

  # Use custom build/check/install phases instead of the hook defaults
  dontUseBunBuild = true;
  dontUseBunCheck = true;
  dontUseBunInstall = true;

  buildPhase = ''
    runHook preBuild
    bun ${if smol then "build:binary:smol" else "build:binary"}
    runHook postBuild
  '';

  installPhase = ''
    runHook preInstall
    mkdir -p $out/bin
    cp ./bin/pf $out/bin/pf
    runHook postInstall
  '';

  # Bun binaries are broken by fixup phase
  dontFixup = true;
}
