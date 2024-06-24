# Argo Event Source

Deploys an [EventSource](https://argoproj.github.io/argo-events/concepts/event_source/) 
resource as a part of the 
[Argo Events architecture](https://argoproj.github.io/argo-events/concepts/architecture/).

The EventSource is a Deployment that consumes data 
from external sources (push and pull) and then publishes events on an
[EventBus.](https://argoproj.github.io/argo-events/concepts/eventbus/)


