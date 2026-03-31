{ pkgs }:

pkgs.stdenv.mkDerivation rec {
  pname = "devShell-scripts";
  version = "1.0";

  src = ./.; # This includes the script and source_files directory

  dontBuild = true; # No build phase needed

  installPhase = ''
    mkdir -p $out/bin $out/lib

    # Find all .sh files in the source directory
    for script in $(find ${src} -name "*.sh"); do
      script_name=$(basename $script .sh)
      cp $script $out/bin/$script_name
      chmod +x $out/bin/$script_name
    done

    # Install .ts scripts with bun shebangs: copy to lib/ and generate
    # a bin/ wrapper that sets NODE_PATH for npm dependency resolution.
    for script in $(find ${src} -name "*.ts"); do
      script_name=$(basename $script .ts)
      cp $script $out/lib/$script_name.ts
      chmod +x $out/lib/$script_name.ts

      {
        echo '#!/usr/bin/env bash'
        echo 'export NODE_PATH="$REPO_ROOT/packages/website/node_modules"'
        echo 'cd "$REPO_ROOT"'
        echo "exec bun run $out/lib/$script_name.ts \"\$@\""
      } > $out/bin/$script_name
      chmod +x $out/bin/$script_name
    done
  '';
}
