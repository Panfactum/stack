#!/bin/sh

# Function to handle script exit
handle_exit() {
  if [ $? -eq 1 ]; then
    echo "Script exited with error. Rebooting the system..."
    reboot
  fi
}
trap 'handle_exit' EXIT

# shellcheck disable=SC2153
eni_id="${ENI_ID}"
# shellcheck disable=SC2153
eip_allocation_id="${EIP_ALLOCATION_ID}"

aws_region="$(/opt/aws/bin/ec2-metadata -z | cut -f2 -d' ' | sed 's/.$//')"
echo "Found AWS region: $aws_region"

instance_id="$(/opt/aws/bin/ec2-metadata -i | cut -f2 -d' ')"
echo "Found Instance ID region: $instance_id"

eth0_mac="$(cat /sys/class/net/eth0/address)"
echo "Found eth0 MAC address: $eth0_mac"

token="$(curl -X PUT -H 'X-aws-ec2-metadata-token-ttl-seconds: 300' http://169.254.169.254/latest/api/token)"
eth0_eni_id="$(curl -H "X-aws-ec2-metadata-token: $token" "http://169.254.169.254/latest/meta-data/network/interfaces/macs/$eth0_mac/interface-id")"
nat_interface="eth0"
echo "Found eth0 ENI ID: $eth0_eni_id. Will use as the NAT interface."

# This is required for eth0 to perform NAT
echo "Disabling source destination checks for $eth0_eni_id to allow NAT..."
aws ec2 modify-network-interface-attribute \
  --region "$aws_region" \
  --network-interface-id "$eth0_eni_id" \
  --no-source-dest-check
echo "Done!"

# Attach the static ENI (required to keep the routing tables static)
# All traffic from the private subnet in this AZ will be routed to this ENI
# via the VPC route tables
echo "Found static eni_id configuration, attaching $eni_id..."

max_wait_time=60
timer=0
while [ "$(aws ec2 describe-network-interfaces --region "$aws_region" --network-interface-ids "$eni_id" --query 'NetworkInterfaces[0].Status' --output text)" != "available" ]; do
  echo "$eni_id not yet available. Waiting... Time remaining: $((max_wait_time - timer)) seconds"
  timer=$((timer + 1))
  if [ $timer -ge $max_wait_time ]; then
    echo "Timed out waiting for $eni_id to become available. Rebooting..."
    reboot
    exit 1
  fi
  sleep 1
done

aws ec2 attach-network-interface \
  --region "$aws_region" \
  --instance-id "$instance_id" \
  --device-index 1 \
  --network-interface-id "$eni_id"
echo "Attached $eni_id as eth1!"

# Wait for eth1 to come up
# Occasionally, this does fail for some reason so we put a timeout
# on it to reboot if it isn't up in a couple minutes
max_wait_time=60
timer=0
while ! ip link show dev eth1; do
  timer=$((timer + 1))
  if [ $timer -ge $max_wait_time ]; then
    echo "Timed out waiting for eth1 to come up. Rebooting..."
    reboot
    exit 1
  fi
  echo "Waiting for eth1 to come up... Time remaining: $((max_wait_time - timer)) seconds"
  sleep 1
done
echo "eth1 is up!"

# Assign the static IP to the NAT interface so that we can have a static IP for ingress traffic
echo "Found static eip_allocation_id configuration, re-associating EIP with eth0..."
aws ec2 associate-address \
  --region "$aws_region" \
  --network-interface-id "$eth0_eni_id" \
  --allow-reassociation \
  --allocation-id "$eip_allocation_id"
sleep 3
echo "Done!"

echo "Setting up NAT..."

echo "Enabling ip_forward..."
sysctl -q -w net.ipv4.ip_forward=1

echo "Disabling reverse path protection..."
find /proc/sys/net/ipv4/conf/ -name rp_filter -exec bash -c 'echo 0 > "$1"' _ {} \;

echo "Flushing NAT table..."
iptables -t nat -F

echo "Adding NAT rule..."
iptables -t nat -A POSTROUTING -o "$nat_interface" -j MASQUERADE -m comment --comment "NAT routing rule installed by Panfactum"

echo "Done!"
