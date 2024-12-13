# Kubernetes Priority Classes

Sets up additional priority classes in addition to the default ones provided
by Kubernetes:

- `database` (`10000000`): Used for running stateful pods

- `default` (`0`): The global default priority class

- `cluster-important` (`100000000`): Used for controllers that provide ancillary
   (but not critical) cluster functionality

Additionally, you can set up arbitrary additional priority classes as needed via the `extra_priority_classes` input.