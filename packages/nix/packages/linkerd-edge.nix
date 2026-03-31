# Custom linkerd_edge derivation for versions not yet available in nixpkgs
{
  lib,
  stdenv,
  fetchFromGitHub,
  buildGoModule,
  installShellFiles,
}:

buildGoModule rec {
  pname = "linkerd-edge";
  version = "25.10.7";
  vendorHash = "sha256-zyvjgpWQl/SQdGqk1SlEn9TCsQCsfVSt6xiSMbw8qD8=";

  src = fetchFromGitHub {
    owner = "linkerd";
    repo = "linkerd2";
    rev = "edge-${version}";
    sha256 = "07la0aq26x7z4ds58kir8nm910f64rp4daph5dymljr2435g2bil";
  };

  subPackages = [ "cli" ];

  tags = [
    "prod"
  ];

  ldflags = [
    "-s"
    "-w"
    "-X github.com/linkerd/linkerd2/pkg/version.Version=${src.rev}"
  ];

  nativeBuildInputs = [ installShellFiles ];

  postInstall = ''
    mv $out/bin/cli $out/bin/linkerd
  ''
  + lib.optionalString (stdenv.buildPlatform.canExecute stdenv.hostPlatform) ''
    installShellCompletion --cmd linkerd \
      --bash <($out/bin/linkerd completion bash) \
      --zsh <($out/bin/linkerd completion zsh) \
      --fish <($out/bin/linkerd completion fish)
  '';

  doInstallCheck = true;
  installCheckPhase = ''
    $out/bin/linkerd version --client | grep ${src.rev} > /dev/null
  '';

  meta = {
    description = "Simple Kubernetes service mesh that improves security, observability and reliability";
    mainProgram = "linkerd";
    downloadPage = "https://github.com/linkerd/linkerd2/";
    homepage = "https://linkerd.io/";
    license = lib.licenses.asl20;
  };
}
