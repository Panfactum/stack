#!/bin/sh

# shellcheck disable=SC2153
eni_id="${ENI_ID}"
eip_allocation_id="${EIP_ALLOCATION_ID}"

echo "Found eni_id configuration, attaching $eni_id..."

aws_region="$(/opt/aws/bin/ec2-metadata -z | cut -f2 -d' ' | sed 's/.$//')"
instance_id="$(/opt/aws/bin/ec2-metadata -i | cut -f2 -d' ')"

eth0_mac="$(cat /sys/class/net/eth0/address)"

token="$(curl -X PUT -H 'X-aws-ec2-metadata-token-ttl-seconds: 300' http://169.254.169.254/latest/api/token)"
eth0_eni_id="$(curl -H "X-aws-ec2-metadata-token: $token" "http://169.254.169.254/latest/meta-data/network/interfaces/macs/$eth0_mac/interface-id")"

aws ec2 modify-network-interface-attribute \
  --region "$aws_region" \
  --network-interface-id "$eth0_eni_id" \
  --no-source-dest-check

aws ec2 attach-network-interface \
  --region "$aws_region" \
  --instance-id "$instance_id" \
  --device-index 1 \
  --network-interface-id "$eni_id"

aws ec2 associate-address \
  --region "$aws_region" \
  --network-interface-id "$eth0_eni_id" \
  --allow-reassociation \
  --allocation-id "$eip_allocation_id"

while ! ip link show dev eth1; do
  echo "Waiting for ENI to come up..."
  sleep 1
done

nat_interface="eth0"

echo "Enabling ip_forward..."
sysctl -q -w net.ipv4.ip_forward=1

echo "Disabling reverse path protection..."
find /proc/sys/net/ipv4/conf/ -name rp_filter -exec bash -c 'echo 0 > "$1"' _ {} \;

echo "Flushing NAT table..."
iptables -t nat -F

echo "Adding NAT rule..."
iptables -t nat -A POSTROUTING -o "$nat_interface" -j MASQUERADE -m comment --comment "NAT routing rule installed by fck-nat"

echo "Done!"
