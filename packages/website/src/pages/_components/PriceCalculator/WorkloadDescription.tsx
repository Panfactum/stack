const WorkloadDescription = () => {
  return (
    <div class="flex max-w-screen-md flex-col gap-4">
      <p>
        A{" "}<em>workload</em>{" "}is any containerized system deployed to a Panfactum
        cluster (not including the default utilities installed on every cluster).
      </p>
      <p>
        Every workload falls in{" "}<em>exactly one</em>{" "}of the following categories:
      </p>
      <ul class={"flex list-inside list-disc flex-col gap-4"}>
        <li>
          <span class="font-semibold">Standard Module:</span> Any off-the-shelf Panfactum infrastructure-as-code module
          that can be deployed
          directly to the cluster by just tuning the module inputs. If the standard module includes a database,
          that database is included at no additional charge.
        </li>
        <li>
          <span class="font-semibold">Database:</span> Any database system with an associated Panfactum module
          that you'd like to use for your custom workloads. We provide modules for PostgreSQL, Redis, NATS, and
          many more.
        </li>
        <li>
          <span class="font-semibold">Custom Workload:</span> Any workload that does not have a standard Panfactum module
          where we would be responsible for developing and deploying the necessary infrastructure-as-code. This
          can be first-party application code that your team builds or third-party code from an external source
          like DockerHub.
        </li>
      </ul>
    </div>
  )
}

export default WorkloadDescription;