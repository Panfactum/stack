// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: Apache-2.0

package provider

import (
	"context"
	"github.com/hashicorp/terraform-plugin-framework/function"
	"github.com/hashicorp/terraform-plugin-framework/types"
	"regexp"
)

var (
	_ function.Function = SanitizeAWSTagsFunction{}
)

func NewSanitizeAWSTagsFunction() function.Function {
	return SanitizeAWSTagsFunction{}
}

type SanitizeAWSTagsFunction struct{}

func (f SanitizeAWSTagsFunction) Metadata(_ context.Context, req function.MetadataRequest, resp *function.MetadataResponse) {
	resp.Name = "sanitize_aws_tags"
}

func (f SanitizeAWSTagsFunction) Definition(_ context.Context, _ function.DefinitionRequest, resp *function.DefinitionResponse) {
	resp.Definition = function.Definition{
		Summary: "Returns the AWS tags that have been sanitized of invalid characters",
		Parameters: []function.Parameter{
			function.MapParameter{
				AllowNullValue:     false,
				AllowUnknownValues: false,
				Description:        "The AWS tags to sanitize",
				Name:               "tags",
				ElementType:        types.StringType,
			},
		},
		Return: function.MapReturn{
			ElementType: types.StringType,
		},
	}
}

func (f SanitizeAWSTagsFunction) Run(ctx context.Context, req function.RunRequest, resp *function.RunResponse) {
	var tags map[string]string

	resp.Error = function.ConcatFuncErrors(req.Arguments.Get(ctx, &tags))
	if resp.Error != nil {
		return

	}

	sanitizedTags := map[string]string{}

	for k, v := range tags {
		sanitizedTags[sanitizeAWSTagKey(k)] = sanitizeAWSTagValue(v)
	}

	resp.Error = function.ConcatFuncErrors(resp.Result.Set(ctx, sanitizedTags))
}

func sanitizeAWSTagKey(input string) string {
	re := regexp.MustCompile(`[^a-zA-Z0-9.:/_@+=-]`)
	return re.ReplaceAllString(input, ".")
}

func sanitizeAWSTagValue(input string) string {
	re := regexp.MustCompile(`[^a-zA-Z0-9.:/_@+=-]`)
	return re.ReplaceAllString(input, ".")
}
