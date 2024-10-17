{ pkgs }:

pkgs.stdenv.mkDerivation rec {
  pname = "devShell-scripts";
  version = "1.0";

  src = ./.; # This includes the script and source_files directory

  dontBuild = true; # No build phase needed

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
