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

var _ datasource.DataSource = &awsTagsDataSource{}

func NewAWSTagsDataSource() datasource.DataSource {
	return &awsTagsDataSource{}
}

type awsTagsDataSource struct {
	ProviderData *PanfactumProvider
}

type awsLabelsDataSourceModel struct {
	Module         types.String `tfsdk:"module"`
	Tags           types.Map    `tfsdk:"tags"`
	RegionOverride types.String `tfsdk:"region_override"`
}

func (d *awsTagsDataSource) Metadata(ctx context.Context, req datasource.MetadataRequest, resp *datasource.MetadataResponse) {
	resp.TypeName = req.ProviderTypeName + "_aws_tags"
}

func (d *awsTagsDataSource) Schema(ctx context.Context, req datasource.SchemaRequest, resp *datasource.SchemaResponse) {
	resp.Schema = schema.Schema{
		Description:         "Provides the standard set of Panfactum resource tags for AWS resources",
		MarkdownDescription: "Provides the standard set of Panfactum resource tags for AWS resources",

		Attributes: map[string]schema.Attribute{
			"tags": schema.MapAttribute{
				Description:         "Tags to apply to AWS resources",
				MarkdownDescription: "Tags to apply to AWS resources",
				Computed:            true,
				ElementType:         types.StringType,
			},
			"module": schema.StringAttribute{
				Description:         "The module within which this data source is called",
				MarkdownDescription: "The module within which this data source is called",
				Required:            true,
			},
			"region_override": schema.StringAttribute{
				Description:         "Overrides the default region tag of the provider",
				MarkdownDescription: "Overrides the default region tag of the provider",
				Optional:            true,
			},
		},
	}
}

func (d *awsTagsDataSource) Configure(ctx context.Context, req datasource.ConfigureRequest, resp *datasource.ConfigureResponse) {
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

func (d *awsTagsDataSource) Read(ctx context.Context, req datasource.ReadRequest, resp *datasource.ReadResponse) {

	var data awsLabelsDataSourceModel

	// Read Terraform configuration data into the model
	resp.Diagnostics.Append(req.Config.Get(ctx, &data)...)
	if resp.Diagnostics.HasError() {
		return
	}

	tags := map[string]attr.Value{
		"panfactum.com/local": types.StringValue(d.ProviderData.IsLocal.String()),
	}

	// Set the default tags from the provider
	setAWSTag(tags, "panfactum.com/environment", d.ProviderData.Environment)
	setAWSTag(tags, "panfactum.com/stack-version", d.ProviderData.StackVersion)
	setAWSTag(tags, "panfactum.com/stack-commit", d.ProviderData.StackCommit)
	setAWSTag(tags, "panfactum.com/root-module", d.ProviderData.RootModule)
	setAWSTag(tags, "panfactum.com/module", data.Module)

	// Allow the region to be overridden
	var region = d.ProviderData.Region
	if !data.RegionOverride.IsNull() && !data.RegionOverride.IsUnknown() {
		region = data.RegionOverride
	}
	setAWSTag(tags, "panfactum.com/region", region)

	// Iterate over the extra tags and set them one-by-one
	for key, value := range (d.ProviderData.ExtraTags).Elements() {
		strValue, ok := value.(types.String)
		if ok {
			setAWSTag(tags, key, strValue)
		} else {
			resp.Diagnostics.AddError(
				"Invalid type found",
				fmt.Sprintf("Failed to convert value for key '%s' to string.", key),
			)
			return
		}
	}

	data.Tags, _ = types.MapValue(types.StringType, tags)

	// Save data into Terraform state
	resp.Diagnostics.Append(resp.State.Set(ctx, &data)...)
}

/**************************************************************
  Utility Functions
 **************************************************************/

func setAWSTag(tags map[string]attr.Value, key string, value types.String) {
	if !value.IsNull() && !value.IsUnknown() {
		tags[sanitizeAWSTagKey(key)] = sanitizeAWSTagValueWrapped(value)
	}
}

func sanitizeAWSTagValueWrapped(input types.String) types.String {
	return types.StringValue(sanitizeAWSTagValue(input.ValueString()))
}
