## Usage

### IP Whitelisting

By default, this module's IRSA authentication will only work when the service account token is presented from an IP address
inside the cluster (this also includes the cluster's public NAT IPs).

This limits the usefulness of tokens that are extracted from the cluster by an attacker.

The underlying discovery mechanism for the whitelist defaults works by searching for resource tags 
assigned in the [aws_vpc](../aws_vpc) and [aws_eks](../aws_eks) modules. If you need additional
IPs or don't use those modules, you must manually specify those IPs via the `ip_allow_list` variable.