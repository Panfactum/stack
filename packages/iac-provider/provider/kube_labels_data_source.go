// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: Apache-2.0

package provider

import (
	"context"
	"fmt"
	"github.com/hashicorp/terraform-plugin-framework/attr"
	"github.com/hashicorp/terraform-plugin-framework/datasource"
	"github.com/hashicorp/terraform-plugin-framework/datasource/schema"
	"github.com/hashicorp/terraform-plugin-framework/types"
)

/**************************************************************
  Provider Definition
 **************************************************************/

var _ datasource.DataSource = &kubeLabelsDataSource{}

func NewKubeLabelsDataSource() datasource.DataSource {
	return &kubeLabelsDataSource{}
}

type kubeLabelsDataSource struct {
	ProviderData *PanfactumProvider
}

type kubeLabelsDataSourceModel struct {
	Module types.String `tfsdk:"module"`
	Labels types.Map    `tfsdk:"labels"`
}

func (d *kubeLabelsDataSource) Metadata(ctx context.Context, req datasource.MetadataRequest, resp *datasource.MetadataResponse) {
	resp.TypeName = req.ProviderTypeName + "_kube_labels"
}

func (d *kubeLabelsDataSource) Schema(ctx context.Context, req datasource.SchemaRequest, resp *datasource.SchemaResponse) {
	resp.Schema = schema.Schema{
		Description:         "Provides the standard set of Panfactum resource labels for Kubernetes resources",
		MarkdownDescription: "Provides the standard set of Panfactum resource labels for Kubernetes resources",

		Attributes: map[string]schema.Attribute{
			"labels": schema.MapAttribute{
				Description:         "Labels to apply to Kubernetes resources",
				MarkdownDescription: "Labels to apply to Kubernetes resources",
				Computed:            true,
				ElementType:         types.StringType,
			},
			"module": schema.StringAttribute{
				Description:         "The module within which this data source is called",
				MarkdownDescription: "The module within which this data source is called",
				Required:            true,
			},
		},
	}
}

func (d *kubeLabelsDataSource) Configure(ctx context.Context, req datasource.ConfigureRequest, resp *datasource.ConfigureResponse) {
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

func (d *kubeLabelsDataSource) Read(ctx context.Context, req datasource.ReadRequest, resp *datasource.ReadResponse) {

	var data kubeLabelsDataSourceModel

	// Read Terraform configuration data into the model
	resp.Diagnostics.Append(req.Config.Get(ctx, &data)...)
	if resp.Diagnostics.HasError() {
		return
	}

	labels := map[string]attr.Value{
		"panfactum.com/local": types.StringValue(d.ProviderData.IsLocal.String()),
	}

	// Set the default labels from the provider
	setKubeLabel(labels, "panfactum.com/environment", d.ProviderData.Environment)
	setKubeLabel(labels, "panfactum.com/region", d.ProviderData.Region)
	setKubeLabel(labels, "panfactum.com/stack-version", d.ProviderData.StackVersion)
	setKubeLabel(labels, "panfactum.com/stack-commit", d.ProviderData.StackCommit)
	setKubeLabel(labels, "panfactum.com/root-module", d.ProviderData.RootModule)
	setKubeLabel(labels, "panfactum.com/module", data.Module)

	for key, value := range (d.ProviderData.ExtraTags).Elements() {
		strValue, ok := value.(types.String)
		if ok {
			labels[sanitizeKubeLabelKey(key)] = sanitizeKubeLabelValueWrapped(strValue)
		} else {
			resp.Diagnostics.AddError(
				"Invalid type found",
				fmt.Sprintf("Failed to convert value for key '%s' to string.", key),
			)
			return
		}
	}

	data.Labels, _ = types.MapValue(types.StringType, labels)

	// Save data into Terraform state
	resp.Diagnostics.Append(resp.State.Set(ctx, &data)...)
}

/**************************************************************
  Utility Functions
 **************************************************************/

func setKubeLabel(tags map[string]attr.Value, key string, value types.String) {
	if !value.IsNull() && !value.IsUnknown() {
		tags[sanitizeKubeLabelKey(key)] = sanitizeKubeLabelValueWrapped(value)
	}
}

func sanitizeKubeLabelValueWrapped(input types.String) types.String {
	return types.StringValue(sanitizeKubeLabelValue(input.ValueString()))
}
