{
  pkgs,
  tfUtilsPkgs,
  precommit ? {
    enable = true;
    tf_fmt = true;
    hcl_fmt = true;
  },
}:
let
  yamlFormat = pkgs.formats.yaml { };
  enabled = precommit.enable or true;
  hooks =
    pkgs.lib.optionals (enabled && (precommit.tf_fmt or true)) [
      {
        id = "tf-fmt";
        name = "Tofu Format";
        entry = "${tfUtilsPkgs.opentofu}/bin/tofu fmt";
        language = "system";
        files = ''\\.tf$'';
        pass_filenames = true;
        description = "Runs tofu fmt on infrastructure code";
        priority = 0;
      }
    ]
    ++ pkgs.lib.optionals (enabled && (precommit.hcl_fmt or true)) [
      {
        id = "hcl-fmt";
        name = "HCL Format";
        entry = "${tfUtilsPkgs.terragrunt}/bin/terragrunt hcl fmt --file";
        language = "system";
        files = ''\\.hcl$'';
        pass_filenames = true;
        description = "Runs hclfmt on HCL files";
        priority = 0;
      }
    ];
in
yamlFormat.generate "pf-pre-commit-config.yaml" {
  repos =
    if hooks != [ ] then
      [
        {
          repo = "local";
          inherit hooks;
        }
      ]
    else
      [ ];
}
