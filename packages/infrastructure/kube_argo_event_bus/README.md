# Argo Event Bus

Deploys an [EventBus](https://argoproj.github.io/argo-events/concepts/eventbus/) resource as a part of
the [Argo Events architecture](https://argoproj.github.io/argo-events/concepts/architecture/).

The EventBus is a set of [NATS](https://nats.io/) nodes that temporarily store inbound events
from [EventSources](https://argoproj.github.io/argo-events/concepts/event_source/) before
distributing them via [Sensors](https://argoproj.github.io/argo-events/concepts/sensor/).

## Usage

A few notes for the proper usage of an EventBus:

- An EventBus is a namespaced resource, and you can have **at most one** per namespace.

- For every namespace where you want to deploy EventSources and Sensors, you must have
an EventBus deployed.

- Updates to the EventBus configuration will cause the EventBus to be destroyed and recreated
due to [this issue](https://github.com/argoproj/argo-events/issues/3133). This will
cause downtime, so plan accordingly.


