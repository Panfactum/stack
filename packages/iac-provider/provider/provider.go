// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: Apache-2.0

package provider

import (
	"context"
	"fmt"
	"github.com/hashicorp/terraform-plugin-framework-validators/int32validator"
	"github.com/hashicorp/terraform-plugin-framework/datasource"
	"github.com/hashicorp/terraform-plugin-framework/function"
	"github.com/hashicorp/terraform-plugin-framework/provider"
	"github.com/hashicorp/terraform-plugin-framework/provider/schema"
	"github.com/hashicorp/terraform-plugin-framework/resource"
	"github.com/hashicorp/terraform-plugin-framework/schema/validator"
	"github.com/hashicorp/terraform-plugin-framework/types"
	"gopkg.in/yaml.v3"
	"os"
	"path/filepath"
)

type PanfactumProvider struct {
	*PanfactumProviderModel
	KubeConfigPath string
}

type PanfactumProviderModel struct {
	Environment       types.String `tfsdk:"environment"`
	Region            types.String `tfsdk:"region"`
	RootModule        types.String `tfsdk:"root_module"`
	StackVersion      types.String `tfsdk:"stack_version"`
	StackCommit       types.String `tfsdk:"stack_commit"`
	IsLocal           types.Bool   `tfsdk:"is_local"`
	ExtraTags         types.Map    `tfsdk:"extra_tags"`
	KubeConfigContext types.String `tfsdk:"kube_config_context"`
	KubeAPIServer     types.String `tfsdk:"kube_api_server"`
	KubeClusterName   types.String `tfsdk:"kube_cluster_name"`
	SLATarget         types.Int32  `tfsdk:"sla_target"`
}

func New() provider.Provider {
	return &PanfactumProvider{}
}

func (p *PanfactumProvider) Metadata(ctx context.Context, req provider.MetadataRequest, resp *provider.MetadataResponse) {
	resp.TypeName = "pf"
}

func (p *PanfactumProvider) Schema(ctx context.Context, req provider.SchemaRequest, resp *provider.SchemaResponse) {
	resp.Schema = schema.Schema{
		Attributes: map[string]schema.Attribute{
			"environment": schema.StringAttribute{
				Optional:            true,
				Description:         "The name of the environment that you are currently deploying infrastructure to",
				MarkdownDescription: "The name of the environment that you are currently deploying infrastructure to",
			},
			"region": schema.StringAttribute{
				Optional:            true,
				Description:         "The name of the region that you are currently deploying infrastructure to",
				MarkdownDescription: "The name of the region that you are currently deploying infrastructure to",
			},
			"root_module": schema.StringAttribute{
				Optional:            true,
				Description:         "The name of the root / top-level module that you are currently deploying infrastructure with",
				MarkdownDescription: "The name of the root / top-level module that you are currently deploying infrastructure with",
			},
			"stack_version": schema.StringAttribute{
				Optional:            true,
				Description:         "The version of the Panfactum Stack that you are currently using",
				MarkdownDescription: "The version of the Panfactum Stack that you are currently using",
			},
			"stack_commit": schema.StringAttribute{
				Optional:            true,
				Description:         "The commit hash of the Panfactum Stack that you are currently using",
				MarkdownDescription: "The commit hash of the Panfactum Stack that you are currently using",
			},
			"is_local": schema.BoolAttribute{
				Optional:            true,
				Description:         "Whether the provider is being used a part of a local development deployment",
				MarkdownDescription: "Whether the provider is being used a part of a local development deployment",
			},
			"extra_tags": schema.MapAttribute{
				Optional:            true,
				Description:         "Extra tags to apply to all resources",
				MarkdownDescription: "Extra tags to apply to all resources",
				ElementType:         types.StringType,
			},
			"kube_config_context": schema.StringAttribute{
				Description:         "The name of the context from KUBE_CONFIG that is being used to deploy infrastructure",
				MarkdownDescription: "The name of the context from KUBE_CONFIG that is being used to deploy infrastructure",
				Optional:            true,
			},
			"kube_api_server": schema.StringAttribute{
				Description:         "The HTTPS address of the Kubernetes API server to which infrastructure is being deployed",
				MarkdownDescription: "The HTTPS address of the Kubernetes API server to which infrastructure is being deployed",
				Optional:            true,
			},
			"kube_cluster_name": schema.StringAttribute{
				Description:         "The name of the Kubernetes cluster that you are currently deploying infrastructure to",
				MarkdownDescription: "The name of the Kubernetes cluster that you are currently deploying infrastructure to",
				Optional:            true,
			},
			"sla_target": schema.Int32Attribute{
				Description:         "The Panfactum SLA target for Panfactum modules",
				MarkdownDescription: "The Panfactum SLA target for Panfactum modules",
				Optional:            true,
				Validators: []validator.Int32{
					int32validator.AtLeast(1),
					int32validator.AtMost(3),
				},
			},
		},
	}
}

func (p *PanfactumProvider) Configure(ctx context.Context, req provider.ConfigureRequest, resp *provider.ConfigureResponse) {
	var model PanfactumProviderModel
	var newProvider = PanfactumProvider{PanfactumProviderModel: &model}

	// Step 1: Load the explicitly set data
	resp.Diagnostics.Append(req.Config.Get(ctx, &model)...)

	// Step 2: Load config from environment variables
	kubeCfgPath := os.Getenv("KUBE_CONFIG_PATH")
	if kubeCfgPath != "" {
		newProvider.KubeConfigPath = filepath.Clean(kubeCfgPath)
	} else {
		homePath, err := os.UserHomeDir()
		if err != nil {
			resp.Diagnostics.AddError("Unable to load user home directory", fmt.Sprintf("%v", err))
		}
		newProvider.KubeConfigPath = filepath.Join(homePath, ".kube/config")
	}

	// Step 3: Load the cluster name based on the current context
	kubeCfgContext := newProvider.KubeConfigContext.ValueString()
	if kubeCfgContext != "" {
		if clusterName, err := getKubeClusterName(newProvider.KubeConfigPath, kubeCfgContext); err != nil {
			resp.Diagnostics.AddError("Unable to load cluster name", fmt.Sprintf("%v", err))
		} else {
			newProvider.KubeClusterName = types.StringValue(clusterName)
		}
	}

	// Step 4: Apply Defaults
	if newProvider.SLATarget.IsNull() || newProvider.SLATarget.IsUnknown() {
		newProvider.SLATarget = types.Int32Value(3)
	}

	resp.DataSourceData = &newProvider
	resp.ResourceData = &newProvider
}

func (p *PanfactumProvider) Resources(ctx context.Context) []func() resource.Resource {
	return []func() resource.Resource{}
}

func (p *PanfactumProvider) DataSources(ctx context.Context) []func() datasource.DataSource {
	return []func() datasource.DataSource{
		NewKubeLabelsDataSource,
		NewAWSTagsDataSource,
		NewMetadataDataSource,
	}
}

func (p *PanfactumProvider) Functions(ctx context.Context) []func() function.Function {
	return []func() function.Function{
		NewSanitizeAWSTagsFunction,
		NewSanitizeKubeLabelsFunction,
		NewCIDRContainsFunction,
		NewCIDRsOverlapFunction,
		NewCIDRCountHosts,
	}
}

/**************************************************************
  Utility Functions
 **************************************************************/

type KubeConfig struct {
	Contexts []struct {
		Name    string `yaml:"name"`
		Context struct {
			Cluster string `yaml:"cluster"`
		} `yaml:"context"`
	} `yaml:"contexts"`
}

func getKubeClusterName(kubeConfigPath string, context string) (string, error) {
	file, err := os.Open(kubeConfigPath)
	if err != nil {
		return "", fmt.Errorf("error opening YAML file: %v", err)
	}
	defer file.Close()

	var cfg KubeConfig
	decoder := yaml.NewDecoder(file)
	if err := decoder.Decode(&cfg); err != nil {
		return "", fmt.Errorf("error decoding YAML: %v", err)
	}

	for _, contextConfig := range cfg.Contexts {
		if contextConfig.Name == context {
			return contextConfig.Context.Cluster, nil
		}
	}

	return "", fmt.Errorf("no context name %s found in kubeconfig file at %s", context, kubeConfigPath)
}
