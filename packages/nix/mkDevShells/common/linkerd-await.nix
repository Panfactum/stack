# No standard nix package for this so we use our own
{ pkgs }:
let
  # Mapping of Nix systems to the GOOS/GOARCH pairs.
  systemMap = {
    x86_64-linux = "amd64";
    aarch64-darwin = "arm64";
    x86_64-darwin = "amd64";
    aarch64-linux = "arm64";
  };
  shas = {
    amd64 = "sha256-AfCv/eg+REEFAYqj4+0m9hbtc53Gbg1VYOWMN1VgJSU=";
    arm64 = "sha256-TlYSPMjM2DbZQv+NNXSZtI+HjZ/RX9wyPxDe0kHF6fw=";
  };

  type = systemMap.${pkgs.stdenv.system};
  url =
    "https://github.com/linkerd/linkerd-await/releases/download/release%2Fv0.2.7/linkerd-await-v0.2.7-${type}";
  sha256 = shas.${type};
in pkgs.stdenv.mkDerivation {
  pname = "linkerd-await";
  version = "0.2.7";
  src = pkgs.fetchurl { inherit url sha256; };
  dontUnpack = true;
  installPhase = ''
    mkdir -p $out/bin
    cp $src $out/bin/linkerd-await
    chmod +x $out/bin/linkerd-await
  '';
}
