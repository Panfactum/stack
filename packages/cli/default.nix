{
  pkgs,
  bun2nix,
  smol ? false,
  ...
}:
let
  bunDeps = bun2nix.fetchBunDeps { bunNix = ./bun.nix; };
  packageJson = builtins.fromJSON (builtins.readFile ./package.json);
in
pkgs.stdenv.mkDerivation {
  inherit (packageJson) name version;
  # Exclude bunfig.toml from the Nix source — its [install.cache] dir = ".bun" setting
  # redirects bun's cache lookup away from BUN_INSTALL_CACHE_DIR (set by bun2nix.hook),
  # causing bun to download npm manifests which fails in the sandbox.
  src = pkgs.nix-gitignore.gitignoreSource [ "bunfig.toml" ] ./.;

  nativeBuildInputs = with pkgs; [
    bun2nix.hook
  ];

  inherit bunDeps;

  # Fix read-only permissions on cache files copied from /nix/store.
  # Without this, bun fails with EPERM when trying to hardlink packages.
  # See: https://github.com/nix-community/bun2nix/issues/73
  postBunSetInstallCacheDirPhase = ''
    chmod -R u+rwx "$BUN_INSTALL_CACHE_DIR"
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
