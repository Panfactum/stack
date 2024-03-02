# We pin terraform since changes in versions could cause destructive impact to the
# the infrastrcuture
# See https://github.com/NixOS/nixpkgs/blob/nixos-unstable/pkgs/applications/networking/cluster/terraform/default.nix#L54
# for the build config
{ pkgs }:
pkgs.mkTerraform {
  version = "1.6.2";
  hash = "sha256-24B8YlorL00OqmYYVM1xg5dM9hZ4enDWJ1XIGmeEAiM=";
  vendorHash = "sha256-fIirGWt4Os2uZHo4ui7wmZEp+DRUHu/0p+cQCbUbzjc=";
}
