{ pkgs }:

pkgs.stdenv.mkDerivation rec {
  pname = "pf-scripts";
  version = "1.0";

  src = ./.;

  dontBuild = true;

  installPhase = ''
    mkdir -p $out/bin

    # Find all .sh files in the source directory
    for script in $(find ${src} -name "*.sh"); do
      script_name=$(basename $script .sh)
      cp $script $out/bin/$script_name
      chmod +x $out/bin/$script_name
    done
  '';
}
