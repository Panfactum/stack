# We pin terragrunt since changes in versions could cause destructive impact to the
# the infrastrcuture
{ pkgs }:
pkgs.buildGoModule rec {
  pname = "terragrunt";
  version = "0.53.0";

  src = pkgs.fetchFromGitHub {
    owner = "gruntwork-io";
    repo = pname;
    rev = "refs/tags/v${version}";
    hash = "sha256-Y3the1+p+ZAkPxKnScNIup7cfyTtE2LU3IdghA0mOY8=";
  };

  vendorHash = "sha256-5O3souGEosqLFxZpGbak4r57V39lR6X8mEPgfad3X5Q=";

  doCheck = false;

  ldflags = [
    "-s"
    "-w"
    "-X github.com/gruntwork-io/go-commons/version.Version=v${version}"
  ];

  doInstallCheck = true;

  installCheckPhase = ''
    runHook preInstallCheck
    $out/bin/terragrunt --help
    $out/bin/terragrunt --version | grep "v${version}"
    runHook postInstallCheck
  '';

  meta = with pkgs.lib; {
    homepage = "https://terragrunt.gruntwork.io";
    changelog =
      "https://github.com/gruntwork-io/terragrunt/releases/tag/v${version}";
    description =
      "A thin wrapper for Terraform that supports locking for Terraform state and enforces best practices";
    license = licenses.mit;
  };
}
