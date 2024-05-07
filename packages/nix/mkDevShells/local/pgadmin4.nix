{ pkgs }:
pkgs.pgadmin4-desktopmode.overrideAttrs (finalAttrs: previousAttrs: {
  postPatch = previousAttrs.postPatch + ''
    substituteInPlace web/config.py --replace "MASTER_PASSWORD_REQUIRED = True" "MASTER_PASSWORD_REQUIRED = False"
  '';

  # These install checks take way too long on first install
  # and are very brittle (don't work on aaarch64)
  doCheck = false;
  doInstallCheck = false;
})
