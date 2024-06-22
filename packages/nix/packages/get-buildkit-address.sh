#!/usr/bin/env bash

# This script returns the address of the running buildkit pod with the least cpu usage

set -eo pipefail

NAMESPACE=buildkit
