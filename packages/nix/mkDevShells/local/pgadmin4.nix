{ pkgs }:
pkgs.pgadmin4-desktopmode.overrideAttrs (finalAttrs: previousAttrs: {
  postPatch = previousAttrs.postPatch + ''
    substituteInPlace web/config.py --replace "MASTER_PASSWORD_REQUIRED = True" "MASTER_PASSWORD_REQUIRED = False"
  '';
})
