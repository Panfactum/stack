#!/bin/sh

# We should terminate the instance if any of the commands in this script fail
# unless explicitly retried
set -e

# These are template variables replaced by terraform
# shellcheck disable=SC2153
inbound_eni_id="${ENI_ID}"
# shellcheck disable=SC2153
eip_allocation_id="${EIP_ALLOCATION_ID}"

# If this script fails for some reason, we should terminate the instance
# to try again with a new instance
instance_id=""
handle_exit() {
  # shellcheck disable=SC2181
  if [ $? != 0 ]; then
    echo "Script exited with error."
    if [ "$instance_id" != "" ]; then
      echo "We have the instance ID, so terminating the instance..."
      aws ec2 terminate-instances --instance-ids "$instance_id"
    fi
    shutdown -h now
  else
    echo "NAT setup completed successfully!"
  fi
}
trap 'handle_exit' EXIT

token="$(curl -s -X PUT -H 'X-aws-ec2-metadata-token-ttl-seconds: 300' http://169.254.169.254/latest/api/token || { exit 1; })"
echo "Retrieved metadata token!"
instance_id="$(curl -s -H "X-aws-ec2-metadata-token: $token" http://169.254.169.254/latest/meta-data/instance-id || { exit 1; })"
echo "Found Instance ID: $instance_id"
aws_region="$(curl -s -H "X-aws-ec2-metadata-token: $token" http://169.254.169.254/latest/meta-data/placement/region || { exit 1; })"
echo "Found AWS region: $aws_region"
outbound_mac="$(curl -s -H "X-aws-ec2-metadata-token: $token" http://169.254.169.254/latest/meta-data/mac || { exit 1; })"
echo "Found MAC address for the outbound network interface: $outbound_mac"
outbound_eni_id="$(curl -s -H "X-aws-ec2-metadata-token: $token" "http://169.254.169.254/latest/meta-data/network/interfaces/macs/$outbound_mac/interface-id" || { exit 1; })"
echo "Found ENI ID for the outbound network interface: $outbound_eni_id."
nat_interface="$(ip link show dev "$outbound_eni_id" | head -n 1 | awk '{print $2}' | sed s/://g || { exit 1; })"
echo "Found linux network interface name for the outbound network interface: $nat_interface. Will use as the NAT interface."

# This is required for the NAT ENI to perform NAT
echo "Disabling source destination checks for NAT ENI $outbound_eni_id to allow NAT..."
aws ec2 modify-network-interface-attribute \
  --region "$aws_region" \
  --network-interface-id "$outbound_eni_id" \
  --no-source-dest-check
echo "Done!"

# Attach the static ENI (required to keep the routing tables static)
# All traffic from the private subnet in this AZ will be routed to this ENI
# via the VPC route tables
echo "Attaching inbound ENI $inbound_eni_id..."

# If the ASG is rolling, this new instance might launch before the ENI is detached from the old
# instance. So we should continue to attempt the attachment until it is available
max_wait_time=120
timer=0
while ! aws ec2 attach-network-interface --region "$aws_region" --instance-id "$instance_id" --device-index 1 --network-interface-id "$inbound_eni_id"; do
  echo "Failed to attach $inbound_eni_id! It might not be available yet. Will try again shortly... Time remaining: $((max_wait_time - timer)) seconds"
  timer=$((timer + 1))
  if [ $timer -ge $max_wait_time ]; then
    echo "Timed out trying to attach $inbound_eni_id!"
    exit 1
  fi
  sleep 1
done
echo "Attached $inbound_eni_id!"

# Wait for inbound eni to come up as it won't be immediately available even after attaching
# Occasionally, this does fail for some reason so we put a timeout
# on it to reboot if it isn't up in a couple minutes
max_wait_time=60
timer=0
while ! ip link show dev "$inbound_eni_id"; do
  timer=$((timer + 1))
  if [ $timer -ge $max_wait_time ]; then
    echo "Timed out waiting for $inbound_eni_id to come up!"
    exit 1
  fi
  echo "Waiting for $inbound_eni_id to come up... Time remaining: $((max_wait_time - timer)) seconds"
  sleep 1
done
echo "$inbound_eni_id is up!"

# Assign the static IP to the NAT interface so that we can have a static IP for ingress traffic
echo "Found static eip_allocation_id configuration, re-associating EIP with outbound ENI $outbound_eni_id..."
aws ec2 associate-address \
  --region "$aws_region" \
  --network-interface-id "$outbound_eni_id" \
  --allow-reassociation \
  --allocation-id "$eip_allocation_id"
echo "Done!"

echo "Setting up NAT..."

echo "Enabling ip_forward..."
sysctl -q -w net.ipv4.ip_forward=1

echo "Disabling reverse path protection..."
find /proc/sys/net/ipv4/conf/ -name rp_filter -exec bash -c 'echo 0 > "$1"' _ {} \;

echo "Flushing NAT table..."
iptables -t nat -F

echo "Adding NAT rule..."
iptables -t nat -A POSTROUTING -o "$nat_interface" -j MASQUERADE -m comment --comment "NAT routing rule"

echo "Done!"
