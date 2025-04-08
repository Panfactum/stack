{ pkgs, bun2nix, ... }:
let
  bunDeps = pkgs.callPackage ./bun.nix { };
  packageJson = (builtins.fromJSON (builtins.readFile ./package.json));
in
pkgs.stdenv.mkDerivation {
  name = packageJson.name;
  version = packageJson.version;

  src = pkgs.nix-gitignore.gitignoreSource [ ] ./.;

  nativeBuildInputs = with pkgs; [
    rsync
    bun
    jq
  ];

  phases = [
    "unpackPhase"
    "loadModulesPhase"
    "buildPhase"
    "installPhase"
  ];

  # Load node_modules based on the expression generated from the lockfile
  loadModulesPhase = ''
    runHook preLoadModules

    # Preserve symlinks in .bin
    rsync -a --copy-links --chmod=ugo+w --exclude=".bin" ${bunDeps.nodeModules}/node_modules/ ./node_modules/

    if [ -d "${bunDeps.nodeModules}/node_modules/.bin" ]; then
      rsync -a --links ${bunDeps.nodeModules}/node_modules/.bin/ ./node_modules/.bin/
    fi

    mkdir tmp
    export HOME=$TMPDIR

    runHook postLoadModules
  '';

  buildPhase = ''
    runHook preBuild

    bun build:binary

    runHook postBuild
  '';

  # Install the binary to the output folder
  installPhase = ''
    runHook preInstall

    mkdir -p $out/bin

    cp ./bin/pf $out/bin/pf

    runHook postInstall
  '';

  # Bun binaries are broken by fixup phase
  dontFixup = true;
}
