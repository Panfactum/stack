// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: Apache-2.0

package provider

import (
	"context"
	"fmt"
	"github.com/hashicorp/terraform-plugin-framework/datasource"
	"github.com/hashicorp/terraform-plugin-framework/datasource/schema"
	"github.com/hashicorp/terraform-plugin-framework/types"
)

/**************************************************************
  Provider Definition
 **************************************************************/

var _ datasource.DataSource = &metadataDataSource{}

func NewMetadataDataSource() datasource.DataSource {
	return &metadataDataSource{}
}

type metadataDataSource struct {
	ProviderData *PanfactumProvider
}

type metadataDataSourceModel struct {
	Environment       types.String `tfsdk:"environment"`
	Region            types.String `tfsdk:"region"`
	RootModule        types.String `tfsdk:"root_module"`
	StackVersion      types.String `tfsdk:"stack_version"`
	StackCommit       types.String `tfsdk:"stack_commit"`
	IsLocal           types.Bool   `tfsdk:"is_local"`
	KubeConfigPath    types.String `tfsdk:"kube_config_path"`
	KubeConfigContext types.String `tfsdk:"kube_config_context"`
	KubeAPIServer     types.String `tfsdk:"kube_api_server"`
	KubeClusterName   types.String `tfsdk:"kube_cluster_name"`
	SLATarget         types.Int32  `tfsdk:"sla_target"`
}

func (d *metadataDataSource) Metadata(ctx context.Context, req datasource.MetadataRequest, resp *datasource.MetadataResponse) {
	resp.TypeName = req.ProviderTypeName + "_metadata"
}

func (d *metadataDataSource) Schema(ctx context.Context, req datasource.SchemaRequest, resp *datasource.SchemaResponse) {
	resp.Schema = schema.Schema{
		Description:         "Provides metadata about the IaC deployment context.",
		MarkdownDescription: "Provides metadata about the IaC deployment context.",

		Attributes: map[string]schema.Attribute{
			"environment": schema.StringAttribute{
				Description:         "The name of the environment that you are currently deploying infrastructure to",
				MarkdownDescription: "The name of the environment that you are currently deploying infrastructure to",
				Computed:            true,
			},
			"region": schema.StringAttribute{
				Description:         "The name of the region that you are currently deploying infrastructure to",
				MarkdownDescription: "The name of the region that you are currently deploying infrastructure to",
				Computed:            true,
			},
			"root_module": schema.StringAttribute{
				Computed:            true,
				Description:         "The name of the root / top-level module that you are currently deploying infrastructure with",
				MarkdownDescription: "The name of the root / top-level module that you are currently deploying infrastructure with",
			},
			"stack_version": schema.StringAttribute{
				Computed:            true,
				Description:         "The version of the Panfactum Stack that you are currently using",
				MarkdownDescription: "The version of the Panfactum Stack that you are currently using",
			},
			"stack_commit": schema.StringAttribute{
				Computed:            true,
				Description:         "The commit hash of the Panfactum Stack that you are currently using",
				MarkdownDescription: "The commit hash of the Panfactum Stack that you are currently using",
			},
			"is_local": schema.BoolAttribute{
				Computed:            true,
				Description:         "Whether the provider is being used a part of a local development deployment",
				MarkdownDescription: "Whether the provider is being used a part of a local development deployment",
			},
			"kube_config_path": schema.StringAttribute{
				Description:         "The path to the kubeconfig file that is being used to deploy infrastructure",
				MarkdownDescription: "The path to the kubeconfig file that is being used to deploy infrastructure",
				Computed:            true,
			},
			"kube_config_context": schema.StringAttribute{
				Description:         "The name of the context from the kubeconfig file that is being used to deploy infrastructure",
				MarkdownDescription: "The name of the context from kubeconfig file that is being used to deploy infrastructure",
				Computed:            true,
			},
			"kube_api_server": schema.StringAttribute{
				Description:         "The HTTPS address of the Kubernetes API server to which infrastructure is being deployed",
				MarkdownDescription: "The HTTPS address of the Kubernetes API server to which infrastructure is being deployed",
				Computed:            true,
			},
			"kube_cluster_name": schema.StringAttribute{
				Description:         "The name of the Kubernetes cluster that you are currently deploying infrastructure to",
				MarkdownDescription: "The name of the Kubernetes cluster that you are currently deploying infrastructure to",
				Computed:            true,
			},
			"sla_target": schema.Int32Attribute{
				Description:         "The Panfactum SLA target for Panfactum modules",
				MarkdownDescription: "The Panfactum SLA target for Panfactum modules",
				Computed:            true,
			},
		},
	}
}

func (d *metadataDataSource) Configure(ctx context.Context, req datasource.ConfigureRequest, resp *datasource.ConfigureResponse) {
	if req.ProviderData == nil {
		return
	}

	data, ok := req.ProviderData.(*PanfactumProvider)

	if !ok {
		resp.Diagnostics.AddError(
			"Unexpected Data Source Configure Type",
			fmt.Sprintf("Expected PanfactumProviderModel, got: %T. Please report this issue to the provider developers.", req.ProviderData),
		)

		return
	}

	d.ProviderData = data
}

func (d *metadataDataSource) Read(ctx context.Context, req datasource.ReadRequest, resp *datasource.ReadResponse) {

	var data metadataDataSourceModel

	// Read Terraform configuration data into the model
	resp.Diagnostics.Append(req.Config.Get(ctx, &data)...)
	if resp.Diagnostics.HasError() {
		return
	}

	data.Environment = d.ProviderData.Environment
	data.Region = d.ProviderData.Region
	data.RootModule = d.ProviderData.RootModule
	data.StackCommit = d.ProviderData.StackCommit
	data.StackVersion = d.ProviderData.StackVersion
	data.IsLocal = d.ProviderData.IsLocal
	data.KubeConfigPath = types.StringValue(d.ProviderData.KubeConfigPath)
	data.KubeConfigContext = d.ProviderData.KubeConfigContext
	data.KubeAPIServer = d.ProviderData.KubeAPIServer
	data.KubeClusterName = d.ProviderData.KubeClusterName
	data.SLATarget = d.ProviderData.SLATarget

	// Save data into Terraform state
	resp.Diagnostics.Append(resp.State.Set(ctx, &data)...)
}
