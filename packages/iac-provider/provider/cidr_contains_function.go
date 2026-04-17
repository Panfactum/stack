// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: Apache-2.0

package provider

import (
	"context"
	"fmt"
	"github.com/hashicorp/terraform-plugin-framework/function"
	"net"
)

var (
	_ function.Function = CIDRContainsFunction{}
)

func NewCIDRContainsFunction() function.Function {
	return CIDRContainsFunction{}
}

type CIDRContainsFunction struct{}

func (f CIDRContainsFunction) Metadata(_ context.Context, req function.MetadataRequest, resp *function.MetadataResponse) {
	resp.Name = "cidr_contains"
}

func (f CIDRContainsFunction) Definition(_ context.Context, _ function.DefinitionRequest, resp *function.DefinitionResponse) {
	resp.Definition = function.Definition{
		Summary: "Returns true if the provided IP address is in the indicated CIDR block.",
		Parameters: []function.Parameter{
			function.StringParameter{
				AllowNullValue:     false,
				AllowUnknownValues: false,
				Description:        "The CIDR block to check against",
				Name:               "ipv4_cidr_block",
			},
			function.StringParameter{
				AllowNullValue:     false,
				AllowUnknownValues: false,
				Description:        "The IP to use for the check",
				Name:               "ipv4_address",
			},
		},
		Return: function.BoolReturn{},
	}
}

func (f CIDRContainsFunction) Run(ctx context.Context, req function.RunRequest, resp *function.RunResponse) {
	var cidrStr, ipStr string

	resp.Error = function.ConcatFuncErrors(resp.Error, req.Arguments.Get(ctx, &cidrStr, &ipStr))
	if resp.Error != nil {
		return

	}

	ip := net.ParseIP(ipStr)
	if ip == nil {
		resp.Error = function.ConcatFuncErrors(resp.Error, function.NewFuncError(fmt.Sprintf("Invalid IP address: %s\n", ipStr)))
		return
	}

	_, cidrNet, err := net.ParseCIDR(cidrStr)
	if err != nil {
		resp.Error = function.ConcatFuncErrors(resp.Error, function.NewFuncError(fmt.Sprintf("Invalid CIDR block: %s\n", cidrStr)))
		return
	}

	resp.Error = function.ConcatFuncErrors(resp.Error, resp.Result.Set(ctx, cidrNet.Contains(ip)))
}
