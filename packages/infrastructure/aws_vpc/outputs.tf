output "subnet_info" {
  description = "Outputs a map of Subnet info."
  value       = { for id, tags_all in aws_subnet.subnets : id => ({ subnet_id = tags_all.id }) }
}

output "test_config" {
  description = "Configuration for the pf-vpc-network-test command"
  value = {
    region = data.aws_region.region.name,
    subnets = [for name, config in local.private_subnets : {
      subnet = name,
      asg    = aws_autoscaling_group.test[name].name
      nat_ip = aws_eip.nat_ips[var.nat_associations[name]].public_ip
    }]
  }
}

output "vpc_id" {
  value = aws_vpc.main.id
}

output "nat_ips" {
  value = [for eip in aws_eip.nat_ips : eip.public_ip]
}

output "vpc_cidr" {
  value = var.vpc_cidr
}
