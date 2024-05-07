let
  channel = "edge";
  version = "24.5.1";
  sha256 = "sha256-Q+EvW45pClmyCifO72nl2XwqByMfZcVW9PLCHetDZdA=";
  vendorHash = "sha256-sLLgTZN7Zvxkf9J1omh/YGMBUgAtvQD+nbhSuR7/PZg=";
  system = builtins.currentSystem;
  nixpkgsSrc = builtins.fetchGit {
    url = "https://github.com/NixOS/nixpkgs";
    rev = "a343533bccc62400e8a9560423486a3b6c11a23b";
    shallow = true;
  };
  pkgs = import nixpkgsSrc { inherit system; };
in pkgs.buildGo122Module rec {
  pname = "linkerd-${channel}";
  inherit version vendorHash;

  src = pkgs.fetchFromGitHub {
    owner = "linkerd";
    repo = "linkerd2";
    rev = "${channel}-${version}";
    inherit sha256;
  };

  subPackages = [ "cli" ];

  preBuild = ''
    env GOFLAGS="" go generate ./pkg/charts/static
    env GOFLAGS="" go generate ./jaeger/static
    env GOFLAGS="" go generate ./multicluster/static
    env GOFLAGS="" go generate ./viz/static

    # Necessary for building Musl
    if [[ $NIX_HARDENING_ENABLE =~ "pie" ]]; then
        export GOFLAGS="-buildmode=pie $GOFLAGS"
    fi
  '';

  tags = [ "prod" ];

  ldflags = [
    "-s"
    "-w"
    "-X github.com/linkerd/linkerd2/pkg/version.Version=${src.rev}"
  ];

  nativeBuildInputs = [ pkgs.installShellFiles ];

  postInstall = ''
    mv $out/bin/cli $out/bin/linkerd
    installShellCompletion --cmd linkerd \
      --bash <($out/bin/linkerd completion bash) \
      --zsh <($out/bin/linkerd completion zsh) \
      --fish <($out/bin/linkerd completion fish)
  '';

  doInstallCheck = true;
  installCheckPhase = ''
    $out/bin/linkerd version --client | grep ${src.rev} > /dev/null
  '';

  passthru.updateScript = (./. + "/update-${channel}.sh");

  meta = with pkgs.lib; {
    description =
      "A simple Kubernetes service mesh that improves security, observability and reliability";
    mainProgram = "linkerd";
    downloadPage = "https://github.com/linkerd/linkerd2/";
    homepage = "https://linkerd.io/";
    license = licenses.asl20;
    maintainers = with maintainers; [ bryanasdev000 Gonzih ];
  };
}
