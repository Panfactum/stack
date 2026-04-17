// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: Apache-2.0

package provider

import (
	"context"
	"github.com/hashicorp/terraform-plugin-framework/function"
	"github.com/hashicorp/terraform-plugin-framework/types"
	"regexp"
	"strings"
	"unicode"
)

var (
	_ function.Function = SanitizeKubeLabelsFunction{}
)

func NewSanitizeKubeLabelsFunction() function.Function {
	return SanitizeKubeLabelsFunction{}
}

type SanitizeKubeLabelsFunction struct{}

func (f SanitizeKubeLabelsFunction) Metadata(_ context.Context, req function.MetadataRequest, resp *function.MetadataResponse) {
	resp.Name = "sanitize_kube_labels"
}

func (f SanitizeKubeLabelsFunction) Definition(_ context.Context, _ function.DefinitionRequest, resp *function.DefinitionResponse) {
	resp.Definition = function.Definition{
		Summary: "Returns the Kubernetes labels that have been sanitized of invalid characters",
		Parameters: []function.Parameter{
			function.MapParameter{
				AllowNullValue:     false,
				AllowUnknownValues: false,
				Description:        "The Kubernetes labels to sanitize",
				Name:               "labels",
				ElementType:        types.StringType,
			},
		},
		Return: function.MapReturn{
			ElementType: types.StringType,
		},
	}
}

func (f SanitizeKubeLabelsFunction) Run(ctx context.Context, req function.RunRequest, resp *function.RunResponse) {
	var labels map[string]string

	resp.Error = function.ConcatFuncErrors(req.Arguments.Get(ctx, &labels))
	if resp.Error != nil {
		return

	}

	sanitizedLabels := map[string]string{}

	for k, v := range labels {
		sanitizedLabels[sanitizeKubeLabelKey(k)] = sanitizeKubeLabelValue(v)
	}

	resp.Error = function.ConcatFuncErrors(resp.Result.Set(ctx, sanitizedLabels))
}

// sanitizeKubeLabelValue performs the required sanitization steps:
// 1. Replaces any non-alphanumeric, '.', '_', or '-' characters with '.'
// 2. Ensures the string starts and ends with an alphanumeric character
func sanitizeKubeLabelValue(input string) string {
	// Replace any non-alphanumeric, '.', '_', or '-' characters with '.'
	re := regexp.MustCompile(`[^a-zA-Z0-9._-]`)
	sanitized := re.ReplaceAllString(input, ".")

	// Trim any leading or trailing non-alphanumeric characters
	sanitized = strings.TrimFunc(sanitized, func(r rune) bool {
		return !unicode.IsLetter(r) && !unicode.IsNumber(r)
	})

	return sanitized
}

// sanitizeKubeLabelKey performs the required sanitization steps:
// 1. Replaces any non-alphanumeric, '.', '_', '-', or '/' characters with '.'
// 2. Ensures the string starts and ends with an alphanumeric character
func sanitizeKubeLabelKey(input string) string {
	// Replace any non-alphanumeric, '.', '_', '-', or '/' characters with '.'
	re := regexp.MustCompile(`[^a-zA-Z0-9._/-]`)
	sanitized := re.ReplaceAllString(input, ".")

	// Trim any leading or trailing non-alphanumeric characters
	sanitized = strings.TrimFunc(sanitized, func(r rune) bool {
		return !unicode.IsLetter(r) && !unicode.IsNumber(r)
	})

	return sanitized
}
