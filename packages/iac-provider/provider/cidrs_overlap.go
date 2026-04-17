// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: Apache-2.0

package provider

import (
	"context"
	"encoding/binary"
	"fmt"
	"github.com/hashicorp/terraform-plugin-framework/function"
	"github.com/hashicorp/terraform-plugin-framework/types"
	"net"
	"sort"
)

var (
	_ function.Function = CIDRsOverlapFunction{}
)

func NewCIDRsOverlapFunction() function.Function {
	return CIDRsOverlapFunction{}
}

type CIDRsOverlapFunction struct{}

func (f CIDRsOverlapFunction) Metadata(_ context.Context, req function.MetadataRequest, resp *function.MetadataResponse) {
	resp.Name = "cidrs_overlap"
}

func (f CIDRsOverlapFunction) Definition(_ context.Context, _ function.DefinitionRequest, resp *function.DefinitionResponse) {
	resp.Definition = function.Definition{
		Summary: "Returns true if at least one of the listed CIDR ranges overlaps with another.",
		Parameters: []function.Parameter{
			function.ListParameter{
				AllowNullValue:     false,
				AllowUnknownValues: false,
				Description:        "The CIDR blocks to check against",
				Name:               "cidr_blocks",
				ElementType:        types.StringType,
			},
		},
		Return: function.BoolReturn{},
	}
}

func (f CIDRsOverlapFunction) Run(ctx context.Context, req function.RunRequest, resp *function.RunResponse) {
	var cidrStrs []string

	resp.Error = function.ConcatFuncErrors(resp.Error, req.Arguments.Get(ctx, &cidrStrs))
	if resp.Error != nil {
		return

	}

	var cidrs []*net.IPNet

	for _, s := range cidrStrs {
		_, cidrNet, err := net.ParseCIDR(s)
		if err != nil {
			resp.Error = function.ConcatFuncErrors(resp.Error, function.NewFuncError(fmt.Sprintf("Invalid CIDR block: %s\n", s)))
			return
		}
		cidrs = append(cidrs, cidrNet)
	}

	resp.Error = function.ConcatFuncErrors(resp.Error, resp.Result.Set(ctx, AnyCIDRsOverlap(cidrs)))
}

type ipRange struct {
	start uint32
	end   uint32
}

func AnyCIDRsOverlap(cidrs []*net.IPNet) bool {
	var ranges []ipRange

	for _, c := range cidrs {
		start, end := networkRange(c)
		ranges = append(ranges, ipRange{start, end})
	}

	// Sort ranges by their start address so that we can do a linear
	// search for overlaps
	sort.Slice(ranges, func(i, j int) bool {
		return ranges[i].start < ranges[j].start
	})

	// Check for overlap between adjacent ranges
	for i := 1; i < len(ranges); i++ {
		if ranges[i].start <= ranges[i-1].end {
			return true
		}
	}

	return false
}

// networkRange returns the start and end addresses of a CIDR as uint32
func networkRange(network *net.IPNet) (uint32, uint32) {
	ip := network.IP.To4()
	maskOnes, _ := network.Mask.Size()

	ipInt := binary.BigEndian.Uint32(ip)
	shift := uint32(32 - maskOnes)
	numAddrs := uint32(1 << shift)

	start := ipInt & (0xFFFFFFFF << shift)
	end := start + numAddrs - 1

	return start, end
}
