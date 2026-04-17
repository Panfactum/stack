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
	_ function.Function = CIDRCountHosts{}
)

func NewCIDRCountHosts() function.Function {
	return CIDRCountHosts{}
}

type CIDRCountHosts struct{}

func (f CIDRCountHosts) Metadata(_ context.Context, req function.MetadataRequest, resp *function.MetadataResponse) {
	resp.Name = "cidr_count_hosts"
}

func (f CIDRCountHosts) Definition(_ context.Context, _ function.DefinitionRequest, resp *function.DefinitionResponse) {
	resp.Definition = function.Definition{
		Summary: "Returns the number of hosts / ip addresses in a given CIDR range.",
		Parameters: []function.Parameter{
			function.StringParameter{
				AllowNullValue:     false,
				AllowUnknownValues: false,
				Description:        "The CIDR block to count",
				Name:               "cidr_block",
			},
		},
		Return: function.Int64Return{},
	}
}

func (f CIDRCountHosts) Run(ctx context.Context, req function.RunRequest, resp *function.RunResponse) {
	var cidrStr string

	resp.Error = function.ConcatFuncErrors(resp.Error, req.Arguments.Get(ctx, &cidrStr))
	if resp.Error != nil {
		return

	}

	_, cidrNet, err := net.ParseCIDR(cidrStr)
	if err != nil {
		resp.Error = function.ConcatFuncErrors(resp.Error, function.NewFuncError(fmt.Sprintf("Invalid CIDR block: %s\n", cidrStr)))
		return
	}

	resp.Error = function.ConcatFuncErrors(resp.Error, resp.Result.Set(ctx, countHosts(cidrNet)))
}

func countHosts(cidrNet *net.IPNet) int64 {
	maskOnes, _ := cidrNet.Mask.Size()
	hostBits := 32 - maskOnes
	total := int64(1) << hostBits // total addresses in the subnet

	// Edge cases:
	// /31: 2 usable addresses (RFC 3021)
	// /32: 1 address, considered usable
	// Otherwise: total - 2 for the network and broadcast addresses
	switch maskOnes {
	case 31:
		return 2
	case 32:
		return 1
	default:
		if total > 2 {
			return total - 2
		}
		// If the subnet is somehow smaller or invalid, just return 0
		return 0
	}
}
