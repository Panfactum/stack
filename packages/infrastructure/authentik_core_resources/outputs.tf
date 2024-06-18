output "groups" {
  value = merge(
    {
      rbac       = authentik_group.rbac.id
      superusers = authentik_group.superusers.id
    },
    { for group in authentik_group.default_groups : group.name => group.id },
    { for group in authentik_group.extra_groups_root : group.name => group.id },
    { for group in authentik_group.extra_groups_children : group.name => group.id },
    { for group in authentik_group.extra_groups_grandchildren : group.name => group.id },
    { for group in authentik_group.extra_groups_great_grandchildren : group.name => group.id }
  )
}

output "organization_name" {
  value = var.organization_name
}
