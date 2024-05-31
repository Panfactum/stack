'use client'

import Slider from '@mui/material/Slider'
import Snackbar from '@mui/material/Snackbar'
import TextField from '@mui/material/TextField'
import type { Metadata } from 'next'
import Link from 'next/link'
import { parseAsInteger, useQueryState } from 'nuqs'
import type { ChangeEvent, ReactElement, KeyboardEvent } from 'react'
import { useCallback, useState } from 'react'

import DefaultTooltipLazy from '@/components/tooltip/DefaultTooltipLazy'

export const metadata: Metadata = {
  title: 'Savings Calculator',
  description: 'Calculate infrastructure cost savings when using the Panfactum Stack'
}

const CURRENCY_FORMAT = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const CURRENCY_FORMAT_PRECISE = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })
const CURRENCY_FORMAT_VERY_PRECISE = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 4 })
const NUMBER = /^[0-9]+$/

// Prevents non-integer inputs to form field
function allowOnlyIntegers (event: KeyboardEvent) {
  const value = event.key
  if (!event.shiftKey && !event.ctrlKey && !event.metaKey && value.length === 1 && !NUMBER.test(value)) {
    event.preventDefault()
  }
}

function setIntFromString (value: string, setter: (value: number) => unknown, max = 100000) {
  if (value.length === 0) {
    void setter(0)
  } else if (NUMBER.test(value)) {
    const intValue = parseInt(value)
    if (intValue >= 0 && intValue <= max) { void setter(intValue) }
  }
}

// These are rough estimates taken by building a regression
// across various instance types in the M6A, C6A, and R6A instance classes
const BASE_WORKLOAD_CPU_PRICE = 21
const BASE_WORKLOAD_MEM_PRICE = 3.5

// Assumes a 70% discount for running spot instances which appears
// to be the average from the reference stack
const STACK_WORKLOAD_CPU_PRICE = BASE_WORKLOAD_CPU_PRICE * 0.3
const STACK_WORKLOAD_MEM_PRICE = BASE_WORKLOAD_MEM_PRICE * 0.3
const STACK_UTILIZATION_RATE = 66

const S3_PRICE_GB = 0.023
const EBS_PRICE_GB = 0.08
const EBS_SNAPSHOT_PRICE_GB = 0.05

// These are rough estimates taken by building a regression
// across various instance types in the db.r6i and db.m6i
const BASE_RDS_MEM_PRICE = 6.48
const BASE_RDS_CPU_PRICE = 38.16
const BASE_RDS_STORAGE_PRICE_GB = 0.115
const BASE_RDS_BACKUP_STORAGE_PRICE_GB = 0.095

// These are rough estimates taken by building a regression
// across various instance types in the cache.m7g.large and cache.r7g.large
const BASE_KV_MEM_PRICE = 6.57
const BASE_KV_CPU_PRICE = 35.94
const BASE_KV_BACKUP_STORAGE_PRICE_GB = 0.085

// Networking costs
const STACK_NAT_COST = 3.066
const BASE_NAT_COST = 32.4
const BASE_NAT_COST_GB = 0.045
const OUTBOUND_COST_GB = 0.09
const INTER_AZ_COST_GB = 0.02

// Observability costs
const DATADOG_METRICS_COST_PER_1000 = 4 * 1000 / 100
const STACK_METRICS_COST_PER_1000 = 0.3
const DATADOG_LOGS_INDEX_COST_PER_GB = 2.55 // Assuming average log size is 1KB
const DATADOG_LOGS_INGEST_COST_PER_GB = 0.1
const DATADOG_LOG_ARCHIVE_PER_GB = 0.25
const STACK_LOGS_COST_PER_GB = S3_PRICE_GB / 2 + EBS_PRICE_GB / 30 + DATADOG_LOGS_INGEST_COST_PER_GB // we assume our ingest costs are the same as datadog
const DATADOG_SPANS_INDEX_COST_PER_GB = 2.55
const DATADOG_SPANS_INGEST_COST_PER_GB = 0.1
const STACK_SPANS_COST_PER_GB = S3_PRICE_GB / 2 + EBS_PRICE_GB / 30 + DATADOG_LOGS_INGEST_COST_PER_GB // we assume our ingest costs are the same as datadog

// Identity Provider costs
const OKTA_PRICING_PER_EMPLOYEE = 2 + 3 + 2 + 4 + 2 + 4 + 3 + 9 // Standard web ui access
const OKTA_PRICING_PER_DEVELOPER = 14 + 15 // Integrated access to databases and ssh servers
const STACK_AC_PRICING_PER_EMPLOYEE = 0.1
const STACK_IDP_BASE_COST = 30

// Kubernetes costs
const EKS_PRICE = 75
const LB_COST = 25
const EXTRA_STACK_COST = 100

// CICD costs
const GHA_CICD_COST_PER_CPU_MINUTE = 0.008 / 2

interface CalcuateSavingsInput {
  workloadCores: number
  workloadMemory: number
  pgCores: number
  pgMemory: number
  pgStorage: number
  kvCores: number
  kvMemory: number
  kvStorage: number
  utilization: number
  egressTraffic: number
  vpcCount: number
  interAZTraffic: number
  logs: number,
  spans: number,
  metrics: number
  employeeCount: number
  developerCount: number
  cicdMinutes: number
}
function calculateSavings (input :CalcuateSavingsInput) {
  const {
    utilization,
    workloadMemory,
    workloadCores,
    pgMemory,
    pgCores,
    pgStorage,
    kvMemory,
    kvCores,
    kvStorage,
    egressTraffic,
    vpcCount,
    interAZTraffic,
    spans,
    logs,
    metrics,
    employeeCount,
    developerCount,
    cicdMinutes
  } = input

  const workloadStackCost = (((workloadCores * STACK_WORKLOAD_CPU_PRICE) + (workloadMemory * STACK_WORKLOAD_MEM_PRICE)) / (STACK_UTILIZATION_RATE / 100))
  const workloadBaseCost = (((workloadCores * BASE_WORKLOAD_CPU_PRICE) + (workloadMemory * BASE_WORKLOAD_MEM_PRICE)) / (utilization / 100))
  const relationalStackCost = ((2 * ((pgCores * STACK_WORKLOAD_CPU_PRICE) + (pgMemory * STACK_WORKLOAD_MEM_PRICE) + (pgStorage * (EBS_PRICE_GB + EBS_SNAPSHOT_PRICE_GB)))) / (STACK_UTILIZATION_RATE / 100)) + (2 * S3_PRICE_GB * pgStorage)
  const relationalBaseCost = ((2 * ((pgCores * BASE_RDS_CPU_PRICE) + (pgMemory * BASE_RDS_MEM_PRICE) + (pgStorage * (BASE_RDS_STORAGE_PRICE_GB + BASE_RDS_BACKUP_STORAGE_PRICE_GB)))) / (utilization / 100))
  const kvStackCost = (3 * ((kvCores * STACK_WORKLOAD_CPU_PRICE) + (kvMemory * STACK_WORKLOAD_MEM_PRICE) + (kvStorage * (EBS_PRICE_GB + EBS_SNAPSHOT_PRICE_GB)))) / (STACK_UTILIZATION_RATE / 100)
  const kvBaseCost = (2 * ((kvCores * BASE_KV_CPU_PRICE) + (kvMemory * BASE_KV_MEM_PRICE) + (kvStorage * BASE_KV_BACKUP_STORAGE_PRICE_GB))) / (utilization / 100)
  const networkStackCost = (3 * STACK_NAT_COST * vpcCount) + (OUTBOUND_COST_GB * egressTraffic) + (INTER_AZ_COST_GB * interAZTraffic * 0.5)
  const networkBaseCost = (3 * BASE_NAT_COST * vpcCount) + ((OUTBOUND_COST_GB + BASE_NAT_COST_GB) * egressTraffic) + (INTER_AZ_COST_GB * interAZTraffic)
  const observabilityStackCost = (spans * STACK_SPANS_COST_PER_GB) + (logs * STACK_LOGS_COST_PER_GB) + (metrics * STACK_METRICS_COST_PER_1000)
  const observabilityBaseCost = (spans * (DATADOG_SPANS_INDEX_COST_PER_GB + DATADOG_SPANS_INGEST_COST_PER_GB)) + (logs * (DATADOG_LOGS_INGEST_COST_PER_GB + DATADOG_LOGS_INDEX_COST_PER_GB + DATADOG_LOG_ARCHIVE_PER_GB)) + (metrics * DATADOG_METRICS_COST_PER_1000)
  const accessControlStackCost = STACK_IDP_BASE_COST + (employeeCount * STACK_AC_PRICING_PER_EMPLOYEE)
  const accessControlBaseCost = (employeeCount * OKTA_PRICING_PER_EMPLOYEE) + (developerCount * OKTA_PRICING_PER_DEVELOPER)
  const kubernetesStackCost = vpcCount * (EKS_PRICE + LB_COST + EXTRA_STACK_COST)
  const kubernetesBaseCost = vpcCount * (EKS_PRICE + LB_COST)
  const cicdStackCost = cicdMinutes * ((STACK_WORKLOAD_CPU_PRICE + (2 * STACK_WORKLOAD_MEM_PRICE)) / 30 / 24 / 60)
  const cicdBaseCost = cicdMinutes * GHA_CICD_COST_PER_CPU_MINUTE

  return {
    cicd: {
      stackCost: cicdStackCost,
      stackCostDescription: (
        <div className="flex flex-col w-fit">
          <div>
            &nbsp;&nbsp;
            {' '}
            {CURRENCY_FORMAT_PRECISE.format(cicdMinutes * ((STACK_WORKLOAD_CPU_PRICE + (2 * STACK_WORKLOAD_MEM_PRICE)) / 30 / 24 / 60))}
            {' '}
            (
            {cicdMinutes / 60}
            {' '}
            CPU-Hours
            x
            {' '}
            {CURRENCY_FORMAT_VERY_PRECISE.format((STACK_WORKLOAD_CPU_PRICE + (2 * STACK_WORKLOAD_MEM_PRICE)) / 30 / 24)}
            {' '}
            CPU-Hour Spot Instance Cost)
          </div>
          <hr className="bg-white h-0.5 w-full"/>
          <div>
            &nbsp;&nbsp;
            {' '}
            {CURRENCY_FORMAT_PRECISE.format(cicdStackCost)}
            {' '}
            Estimated Total Monthly Cost
          </div>
        </div>
      ),
      baseCost: cicdBaseCost,
      baseCostDescription: (
        <div className="flex flex-col w-fit">
          <div>
            Managed GitHub Actions Pricing
          </div>
          <div>
            &nbsp;&nbsp;
            {' '}
            {CURRENCY_FORMAT_PRECISE.format(cicdMinutes * GHA_CICD_COST_PER_CPU_MINUTE)}
            {' '}
            (
            {cicdMinutes / 60}
            {' '}
            CPU-Hours
            x
            {' '}
            {CURRENCY_FORMAT_VERY_PRECISE.format(GHA_CICD_COST_PER_CPU_MINUTE * 60)}
            {' '}
            CPU-Hour Cost)
          </div>
          <hr className="bg-white h-0.5 w-full"/>
          <div>
            &nbsp;&nbsp;
            {' '}
            {CURRENCY_FORMAT_PRECISE.format(cicdBaseCost)}
            {' '}
            Estimated Total Monthly Cost
          </div>
        </div>
      )
    },
    kubernetes: {
      stackCost: kubernetesStackCost,
      stackCostDescription: (
        <div className="flex flex-col w-fit">
          <div>
            &nbsp;&nbsp;
            {' '}
            {CURRENCY_FORMAT_PRECISE.format(EKS_PRICE * vpcCount)}
            {' '}
            (
            {vpcCount}
            {' '}
            Clusters
            x
            {' '}
            {CURRENCY_FORMAT_PRECISE.format(EKS_PRICE)}
            {' '}
            EKS Cost)
          </div>
          <div>
            +
            {' '}
            {CURRENCY_FORMAT_PRECISE.format(EKS_PRICE * LB_COST)}
            {' '}
            (
            {vpcCount}
            {' '}
            Clusters
            x
            {' '}
            {CURRENCY_FORMAT_PRECISE.format(LB_COST)}
            {' '}
            AWS Load Balancer Cost)
          </div>
          <div>
            +
            {' '}
            {CURRENCY_FORMAT_PRECISE.format(EKS_PRICE * EXTRA_STACK_COST)}
            {' '}
            (
            {vpcCount}
            {' '}
            Clusters
            x
            {' '}
            {CURRENCY_FORMAT_PRECISE.format(EXTRA_STACK_COST)}
            {' '}
            Fixed Stack Cost / Cluster)
          </div>
          <hr className="bg-white h-0.5 w-full"/>
          <div>
            &nbsp;&nbsp;
            {' '}
            {CURRENCY_FORMAT_PRECISE.format(kubernetesStackCost)}
            {' '}
            Estimated Total Monthly Cost
          </div>
        </div>
      ),
      baseCost: kubernetesBaseCost,
      baseCostDescription: (
        <div className="flex flex-col w-fit">
          <div>
            &nbsp;&nbsp;
            {' '}
            {CURRENCY_FORMAT_PRECISE.format(EKS_PRICE * vpcCount)}
            {' '}
            (
            {vpcCount}
            {' '}
            Clusters
            x
            {' '}
            {CURRENCY_FORMAT_PRECISE.format(EKS_PRICE)}
            {' '}
            EKS Cost)
          </div>
          <div>
            +
            {' '}
            {CURRENCY_FORMAT_PRECISE.format(EKS_PRICE * LB_COST)}
            {' '}
            (
            {vpcCount}
            {' '}
            Clusters
            x
            {' '}
            {CURRENCY_FORMAT_PRECISE.format(LB_COST)}
            {' '}
            AWS Load Balancer Cost)
          </div>
          <hr className="bg-white h-0.5 w-full"/>
          <div>
            &nbsp;&nbsp;
            {' '}
            {CURRENCY_FORMAT_PRECISE.format(kubernetesBaseCost)}
            {' '}
            Estimated Total Monthly Cost
          </div>
        </div>
      )
    },
    accessControl: {
      stackCost: accessControlStackCost,
      stackCostDescription: (
        <div className="flex flex-col w-fit">
          <div>
            &nbsp;&nbsp;
            {' '}
            {CURRENCY_FORMAT_PRECISE.format(STACK_IDP_BASE_COST)}
            {' '}
            (Fixed cost for self-hosted IdP)
          </div>
          <div>
            +
            {' '}
            {CURRENCY_FORMAT_PRECISE.format(employeeCount * STACK_AC_PRICING_PER_EMPLOYEE)}
            {' '}
            (
            {employeeCount}
            {' '}
            employees
            x
            {' '}
            {CURRENCY_FORMAT_PRECISE.format(STACK_AC_PRICING_PER_EMPLOYEE)}
            {' '}
            Amortized Cost per Additional Employee)
          </div>
          <hr className="bg-white h-0.5 w-full"/>
          <div>
            &nbsp;&nbsp;
            {' '}
            {CURRENCY_FORMAT_PRECISE.format(accessControlStackCost)}
            {' '}
            Estimated Total Monthly Cost
          </div>
        </div>
      ),
      baseCost: accessControlBaseCost,
      baseCostDescription: (
        <div className="flex flex-col w-fit">
          <div>
            Okta Pricing (for features comparable to the Stack)
          </div>
          <div>
            &nbsp;&nbsp;
            {' '}
            {CURRENCY_FORMAT_PRECISE.format(employeeCount * OKTA_PRICING_PER_EMPLOYEE)}
            {' '}
            (
            {employeeCount}
            {' '}
            employees
            x
            {' '}
            {CURRENCY_FORMAT_PRECISE.format(OKTA_PRICING_PER_EMPLOYEE)}
            {' '}
            Okta Price per Employee)
          </div>
          <div>
            +
            {' '}
            {CURRENCY_FORMAT_PRECISE.format(developerCount * OKTA_PRICING_PER_DEVELOPER)}
            {' '}
            (
            {developerCount}
            {' '}
            developers
            x
            {' '}
            {CURRENCY_FORMAT_PRECISE.format(OKTA_PRICING_PER_DEVELOPER)}
            {' '}
            Additional Cost for Developer Access Controls)
          </div>
          <hr className="bg-white h-0.5 w-full"/>
          <div>
            &nbsp;&nbsp;
            {' '}
            {CURRENCY_FORMAT_PRECISE.format(accessControlBaseCost)}
            {' '}
            Estimated Total Monthly Cost
          </div>
        </div>
      )
    },
    observability: {
      stackCost: observabilityStackCost,
      stackCostDescription: (
        <div className="flex flex-col w-fit">
          <div>
            &nbsp;&nbsp;
            {' '}
            {CURRENCY_FORMAT_PRECISE.format(logs * STACK_LOGS_COST_PER_GB)}
            {' '}
            (
            {logs}
            {' '}
            GB Logs
            x
            {' '}
            {CURRENCY_FORMAT_PRECISE.format(STACK_LOGS_COST_PER_GB)}
            {' '}
            Amortized Cost per GB)
          </div>
          <div>
            +
            {' '}
            {CURRENCY_FORMAT_PRECISE.format(metrics * STACK_METRICS_COST_PER_1000)}
            {' '}
            (
            {metrics}
            K Metrics
            x
            {' '}
            {CURRENCY_FORMAT_PRECISE.format(STACK_METRICS_COST_PER_1000)}
            {' '}
            Amortized Cost per 1K Metrics)
          </div>
          <div>
            +
            {' '}
            {CURRENCY_FORMAT_PRECISE.format(spans * STACK_SPANS_COST_PER_GB)}
            {' '}
            (
            {spans}
            M Spans
            x
            {' '}
            {CURRENCY_FORMAT_PRECISE.format(STACK_SPANS_COST_PER_GB)}
            {' '}
            Amortized Cost per 1M Metrics)
          </div>
          <hr className="bg-white h-0.5 w-full"/>
          <div>
            &nbsp;&nbsp;
            {' '}
            {CURRENCY_FORMAT_PRECISE.format(observabilityStackCost)}
            {' '}
            Estimated Total Monthly Cost
          </div>
        </div>
      ),
      baseCost: observabilityBaseCost,
      baseCostDescription: (
        <div className="flex flex-col w-fit">
          <div>
            Datadog Pricing (14-day Retention)
          </div>
          <div>
            &nbsp;&nbsp;
            {' '}
            {CURRENCY_FORMAT_PRECISE.format(logs * (DATADOG_LOGS_INGEST_COST_PER_GB + DATADOG_LOGS_INDEX_COST_PER_GB + DATADOG_LOG_ARCHIVE_PER_GB))}
            {' '}
            (
            {logs}
            {' '}
            GB
            Logs
            x (
            {CURRENCY_FORMAT_PRECISE.format(DATADOG_LOGS_INGEST_COST_PER_GB)}
            {' '}
            per GB Ingested
            +
            {' '}
            {CURRENCY_FORMAT_PRECISE.format(DATADOG_LOGS_INDEX_COST_PER_GB)}
            {' '}
            per GB Indexed
            +
            {' '}
            {CURRENCY_FORMAT_PRECISE.format(DATADOG_LOG_ARCHIVE_PER_GB)}
            {' '}
            per GB Archived))
          </div>
          <div>
            +
            {' '}
            {CURRENCY_FORMAT_PRECISE.format(metrics * DATADOG_METRICS_COST_PER_1000)}
            {' '}
            (
            {metrics}
            K Metrics
            x
            {' '}
            {CURRENCY_FORMAT_PRECISE.format(DATADOG_METRICS_COST_PER_1000)}
            {' '}
            Cost per 1K Metrics)
          </div>
          <div>
            +
            {' '}
            {CURRENCY_FORMAT_PRECISE.format(spans * (DATADOG_SPANS_INDEX_COST_PER_GB + DATADOG_SPANS_INGEST_COST_PER_GB))}
            {' '}
            (
            {spans}
            M Spans
            x (
            {CURRENCY_FORMAT_PRECISE.format(DATADOG_SPANS_INGEST_COST_PER_GB)}
            {' '}
            per 1M Spans Ingested +
            {' '}
            {CURRENCY_FORMAT_PRECISE.format(DATADOG_SPANS_INDEX_COST_PER_GB)}
            {' '}
            per 1M Spans Indexed ))
          </div>
          <hr className="bg-white h-0.5 w-full"/>
          <div>
            &nbsp;&nbsp;
            {' '}
            {CURRENCY_FORMAT_PRECISE.format(observabilityBaseCost)}
            {' '}
            Estimated Total Monthly Cost
          </div>
        </div>
      )
    },
    network: {
      stackCost: networkStackCost,
      stackCostDescription: (
        <div className="flex flex-col w-fit">
          <div>
            &nbsp;&nbsp;
            {' '}
            {CURRENCY_FORMAT_PRECISE.format(3 * STACK_NAT_COST * vpcCount)}
            {' '}
            (3 x
            {' '}
            {vpcCount}
            {' '}
            VPCs
            x
            {' '}
            {CURRENCY_FORMAT_PRECISE.format(STACK_NAT_COST)}
            {' '}
            NAT Instance Price)
          </div>
          <div>
            +
            {' '}
            {CURRENCY_FORMAT_PRECISE.format(OUTBOUND_COST_GB * egressTraffic)}
            {' '}
            (
            {egressTraffic}
            {' '}
            GB Outbound Traffic
            x
            {' '}
            {CURRENCY_FORMAT_PRECISE.format(OUTBOUND_COST_GB)}
            {' '}
            per GB)
          </div>
          <div>
            +
            {' '}
            {CURRENCY_FORMAT_PRECISE.format(INTER_AZ_COST_GB * interAZTraffic * 0.5)}
            {' '}
            (
            {interAZTraffic}
            {' '}
            GB Inter-AZ
            Traffic
            x
            {' '}
            {CURRENCY_FORMAT_PRECISE.format(INTER_AZ_COST_GB)}
            {' '}
            per GB x 50% Reduction due to Locality-aware Routing)
          </div>
          <hr className="bg-white h-0.5 w-full"/>
          <div>
            &nbsp;&nbsp;
            {' '}
            {CURRENCY_FORMAT_PRECISE.format(networkStackCost)}
            {' '}
            Estimated Total Monthly Cost
          </div>
        </div>
      ),
      baseCost: networkBaseCost,
      baseCostDescription: (
        <div className="flex flex-col w-fit">
          <div>
            &nbsp;&nbsp;
            {' '}
            {CURRENCY_FORMAT_PRECISE.format(3 * BASE_NAT_COST * vpcCount)}
            {' '}
            (3 x
            {' '}
            {vpcCount}
            {' '}
            VPCs
            x
            {' '}
            {CURRENCY_FORMAT_PRECISE.format(BASE_NAT_COST)}
            {' '}
            NAT Instance Price)
          </div>
          <div>
            +
            {' '}
            {CURRENCY_FORMAT_PRECISE.format((OUTBOUND_COST_GB + BASE_NAT_COST_GB) * egressTraffic)}
            {' '}
            (
            {egressTraffic}
            {' '}
            GB Outbound Traffic
            x
            {' '}
            {CURRENCY_FORMAT_PRECISE.format(OUTBOUND_COST_GB + BASE_NAT_COST_GB)}
            {' '}
            per GB)
          </div>
          <div>
            +
            {' '}
            {CURRENCY_FORMAT_PRECISE.format(INTER_AZ_COST_GB * interAZTraffic)}
            {' '}
            (
            {interAZTraffic}
            {' '}
            GB Inter-AZ
            Traffic
            x
            {' '}
            {CURRENCY_FORMAT_PRECISE.format(INTER_AZ_COST_GB)}
            {' '}
            per GB)
          </div>
          <hr className="bg-white h-0.5 w-full"/>
          <div>
            &nbsp;&nbsp;
            {' '}
            {CURRENCY_FORMAT_PRECISE.format(networkBaseCost)}
            {' '}
            Estimated Total Monthly Cost
          </div>
        </div>
      )
    },
    workload: {
      stackCost: workloadStackCost,
      stackCostDescription: (
        <div className="flex flex-col w-fit">
          <div>
            &nbsp;&nbsp;
            {' '}
            {CURRENCY_FORMAT_PRECISE.format(workloadCores * STACK_WORKLOAD_CPU_PRICE)}
            {' '}
            (
            {workloadCores}
            {' '}
            CPU
            *
            {' '}
            {CURRENCY_FORMAT_PRECISE.format(STACK_WORKLOAD_CPU_PRICE)}
            {' '}
            Spot CPU Instance Price)
          </div>
          <div>
            +
            {' '}
            {CURRENCY_FORMAT_PRECISE.format(workloadMemory * STACK_WORKLOAD_MEM_PRICE)}
            {' '}
            (
            {workloadMemory}
            {' '}
            GB Memory
            *
            {' '}
            {CURRENCY_FORMAT_PRECISE.format(STACK_WORKLOAD_MEM_PRICE)}
            {' '}
            Spot Memory Instance Price)
          </div>
          <hr className="bg-white h-0.5 w-full"/>
          <div>
            &nbsp;&nbsp;
            {' '}
            {CURRENCY_FORMAT_PRECISE.format((workloadCores * STACK_WORKLOAD_CPU_PRICE) + (workloadMemory * STACK_WORKLOAD_MEM_PRICE))}
            {' '}
            Raw
            Price
          </div>
          <div>
            ÷
            {' '}
            {(STACK_UTILIZATION_RATE / 100)}
            {' '}
            Optimized Utilization Rate
          </div>
          <hr className="bg-white h-0.5 w-full"/>
          <div>
            &nbsp;&nbsp;
            {' '}
            {CURRENCY_FORMAT_PRECISE.format(workloadStackCost)}
            {' '}
            Estimated Total Monthly Cost
          </div>
        </div>
      ),
      baseCost: workloadBaseCost,
      baseCostDescription: (
        <div className="flex flex-col w-fit">
          <div>
            &nbsp;&nbsp;
            {' '}
            {CURRENCY_FORMAT_PRECISE.format(workloadCores * BASE_WORKLOAD_CPU_PRICE)}
            {' '}
            (
            {workloadCores}
            {' '}
            CPU *
            {' '}
            {CURRENCY_FORMAT_PRECISE.format(BASE_WORKLOAD_CPU_PRICE)}
            {' '}
            On-Demand Instance CPU Price)
          </div>
          <div>
            +
            {' '}
            {CURRENCY_FORMAT_PRECISE.format(workloadMemory * BASE_WORKLOAD_MEM_PRICE)}
            {' '}
            (
            {workloadMemory}
            {' '}
            GB Memory *
            {' '}
            {CURRENCY_FORMAT_PRECISE.format(BASE_WORKLOAD_MEM_PRICE)}
            {' '}
            On-Demand Instance Memory Price)
          </div>
          <hr className="bg-white h-0.5 w-full"/>
          <div>
            &nbsp;&nbsp;
            {' '}
            {CURRENCY_FORMAT_PRECISE.format((workloadCores * BASE_WORKLOAD_CPU_PRICE) + (workloadMemory * BASE_WORKLOAD_MEM_PRICE))}
            {' '}
            Raw Price
          </div>
          <div>
            ÷
            {' '}
            {(utilization / 100)}
            {' '}
            Utilization Rate
          </div>
          <hr className="bg-white h-0.5 w-full"/>
          <div>
            &nbsp;&nbsp;
            {' '}
            {CURRENCY_FORMAT_PRECISE.format(workloadBaseCost)}
            {' '}
            Estimated Total Monthly Cost
          </div>
        </div>
      )
    },
    relationalDB: {
      stackCost: relationalStackCost,
      stackCostDescription: (
        <div className="flex flex-col w-fit">
          <div>
            &nbsp;&nbsp;
            {' '}
            {CURRENCY_FORMAT_PRECISE.format(pgCores * STACK_WORKLOAD_CPU_PRICE)}
            {' '}
            (
            {pgCores}
            {' '}
            CPU
            x
            {' '}
            {CURRENCY_FORMAT_PRECISE.format(STACK_WORKLOAD_CPU_PRICE)}
            {' '}
            Spot Instance CPU Price)
          </div>
          <div>
            +
            {' '}
            {CURRENCY_FORMAT_PRECISE.format(pgMemory * STACK_WORKLOAD_MEM_PRICE)}
            {' '}
            (
            {pgMemory}
            {' '}
            GB Memory
            x
            {' '}
            {CURRENCY_FORMAT_PRECISE.format(STACK_WORKLOAD_MEM_PRICE)}
            {' '}
            Spot Instance Memory Price)
          </div>
          <div>
            +
            {' '}
            {CURRENCY_FORMAT_PRECISE.format(pgStorage * (EBS_PRICE_GB + EBS_SNAPSHOT_PRICE_GB))}
            {' '}
            (
            {pgStorage}
            {' '}
            GB Disk
            x
            {' '}
            {CURRENCY_FORMAT_PRECISE.format(EBS_PRICE_GB + EBS_SNAPSHOT_PRICE_GB)}
            {' '}
            GP3 EBS Storage w/ Live Snapshot
            Price)
          </div>
          <hr className="bg-white h-0.5 w-full"/>
          <div>
            &nbsp;&nbsp;
            {' '}
            {CURRENCY_FORMAT_PRECISE.format(((pgCores * STACK_WORKLOAD_CPU_PRICE) + (pgMemory * STACK_WORKLOAD_MEM_PRICE) + (pgStorage * (EBS_PRICE_GB + EBS_SNAPSHOT_PRICE_GB))))}
            {' '}
            Raw
            Price
          </div>
          <div>
            x 2 (Hot Standby)
          </div>
          <div>
            ÷
            {' '}
            {(STACK_UTILIZATION_RATE / 100)}
            {' '}
            Optimized Utilization Rate
          </div>
          <hr className="bg-white h-0.5 w-full"/>
          <div>
            &nbsp;&nbsp;
            {' '}
            {CURRENCY_FORMAT_PRECISE.format(((2 * ((pgCores * STACK_WORKLOAD_CPU_PRICE) + (pgMemory * STACK_WORKLOAD_MEM_PRICE) + (pgStorage * (EBS_PRICE_GB + EBS_SNAPSHOT_PRICE_GB)))) / (STACK_UTILIZATION_RATE / 100)))}
            {' '}
            Total
            Compute Cost
          </div>
          <div>
            +
            {' '}
            {CURRENCY_FORMAT_PRECISE.format(2 * S3_PRICE_GB * pgStorage)}
            {' '}
            (S3 WAL Archives)
          </div>
          <hr className="bg-white h-0.5 w-full"/>
          <div>
            &nbsp;&nbsp;
            {' '}
            {CURRENCY_FORMAT_PRECISE.format(relationalStackCost)}
            {' '}
            Estimated Total Monthly Cost
          </div>
        </div>
      ),
      baseCost: relationalBaseCost,
      baseCostDescription: (
        <div className="flex flex-col w-fit">
          <div>
            &nbsp;&nbsp;
            {' '}
            {CURRENCY_FORMAT_PRECISE.format(pgCores * BASE_RDS_CPU_PRICE)}
            {' '}
            (
            {pgCores}
            {' '}
            CPU
            x
            {' '}
            {CURRENCY_FORMAT_PRECISE.format(BASE_RDS_CPU_PRICE)}
            {' '}
            RDS CPU Price)
          </div>
          <div>
            +
            {' '}
            {CURRENCY_FORMAT_PRECISE.format(pgMemory * BASE_RDS_MEM_PRICE)}
            {' '}
            (
            {pgMemory}
            {' '}
            GB Memory
            x
            {' '}
            {CURRENCY_FORMAT_PRECISE.format(BASE_RDS_MEM_PRICE)}
            {' '}
            RDS Memory Price)
          </div>
          <div>
            +
            {' '}
            {CURRENCY_FORMAT_PRECISE.format(pgStorage * (BASE_RDS_STORAGE_PRICE_GB + BASE_RDS_BACKUP_STORAGE_PRICE_GB))}
            {' '}
            (
            {pgStorage}
            {' '}
            GB Disk
            x
            {' '}
            {CURRENCY_FORMAT_PRECISE.format(BASE_RDS_STORAGE_PRICE_GB + BASE_RDS_BACKUP_STORAGE_PRICE_GB)}
            {' '}
            GP3 RDS Storage w/ Live Snapshot
            Price)
          </div>
          <hr className="bg-white h-0.5 w-full"/>
          <div>
            &nbsp;&nbsp;
            {' '}
            {CURRENCY_FORMAT_PRECISE.format((pgCores * BASE_RDS_CPU_PRICE) + (pgMemory * BASE_RDS_MEM_PRICE) + (pgStorage * (BASE_RDS_STORAGE_PRICE_GB + BASE_RDS_BACKUP_STORAGE_PRICE_GB)))}
            {' '}
            Raw
            Price
          </div>
          <div>
            x 2 (Hot Standby)
          </div>
          <div>
            ÷
            {' '}
            {(utilization / 100)}
            {' '}
            Utilization Rate
          </div>
          <hr className="bg-white h-0.5 w-full"/>
          <div>
            &nbsp;&nbsp;
            {' '}
            {CURRENCY_FORMAT_PRECISE.format(relationalBaseCost)}
            {' '}
            Estimated Total Monthly Cost
          </div>
        </div>
      )
    },
    kv: {
      stackCost: kvStackCost,
      stackCostDescription: (
        <div className="flex flex-col w-fit">
          <div>
            &nbsp;&nbsp;
            {' '}
            {CURRENCY_FORMAT_PRECISE.format(kvCores * STACK_WORKLOAD_CPU_PRICE)}
            {' '}
            (
            {kvCores}
            {' '}
            CPU
            x
            {' '}
            {CURRENCY_FORMAT_PRECISE.format(STACK_WORKLOAD_CPU_PRICE)}
            {' '}
            Spot Instance CPU Price)
          </div>
          <div>
            +
            {' '}
            {CURRENCY_FORMAT_PRECISE.format(kvMemory * STACK_WORKLOAD_MEM_PRICE)}
            {' '}
            (
            {kvMemory}
            {' '}
            GB Memory
            x
            {' '}
            {CURRENCY_FORMAT_PRECISE.format(STACK_WORKLOAD_MEM_PRICE)}
            {' '}
            Spot Instance Memory Price)
          </div>
          <div>
            +
            {' '}
            {CURRENCY_FORMAT_PRECISE.format(kvStorage * (EBS_PRICE_GB + EBS_SNAPSHOT_PRICE_GB))}
            {' '}
            (
            {kvStorage}
            {' '}
            GB Disk
            x
            {' '}
            {CURRENCY_FORMAT_PRECISE.format(EBS_PRICE_GB + EBS_SNAPSHOT_PRICE_GB)}
            {' '}
            GP3 EBS Storage w/ Live Snapshot
            Price)
          </div>
          <hr className="bg-white h-0.5 w-full"/>
          <div>
            &nbsp;&nbsp;
            {' '}
            {CURRENCY_FORMAT_PRECISE.format(((kvCores * STACK_WORKLOAD_CPU_PRICE) + (kvMemory * STACK_WORKLOAD_MEM_PRICE) + (kvStorage * (EBS_PRICE_GB + EBS_SNAPSHOT_PRICE_GB))))}
            {' '}
            Raw
            Price
          </div>
          <div>
            x 3 (Hot Standby w/ Redis Sentinel)
          </div>
          <div>
            ÷
            {' '}
            {(STACK_UTILIZATION_RATE / 100)}
            {' '}
            Optimized Utilization Rate
          </div>
          <hr className="bg-white h-0.5 w-full"/>
          <div>
            &nbsp;&nbsp;
            {' '}
            {CURRENCY_FORMAT_PRECISE.format(kvStackCost)}
            {' '}
            Estimated Total Monthly Cost
          </div>
        </div>
      ),
      baseCost: kvBaseCost,
      baseCostDescription: (
        <div className="flex flex-col w-fit">
          <div>
            &nbsp;&nbsp;
            {' '}
            {CURRENCY_FORMAT_PRECISE.format(kvCores * BASE_KV_CPU_PRICE)}
            {' '}
            (
            {kvCores}
            {' '}
            CPU
            x
            {' '}
            {CURRENCY_FORMAT_PRECISE.format(BASE_KV_CPU_PRICE)}
            {' '}
            ElastiCache CPU Price)
          </div>
          <div>
            +
            {' '}
            {CURRENCY_FORMAT_PRECISE.format(kvMemory * BASE_KV_MEM_PRICE)}
            {' '}
            (
            {kvMemory}
            {' '}
            GB Memory
            x
            {' '}
            {CURRENCY_FORMAT_PRECISE.format(BASE_KV_MEM_PRICE)}
            {' '}
            ElastiCache Memory Price)
          </div>
          <div>
            +
            {' '}
            {CURRENCY_FORMAT_PRECISE.format(kvStorage * BASE_KV_BACKUP_STORAGE_PRICE_GB)}
            {' '}
            (
            {kvStorage}
            {' '}
            GB Disk
            x
            {' '}
            {CURRENCY_FORMAT_PRECISE.format(BASE_KV_BACKUP_STORAGE_PRICE_GB)}
            {' '}
            Backup Price per GB
            Price)
          </div>
          <hr className="bg-white h-0.5 w-full"/>
          <div>
            &nbsp;&nbsp;
            {' '}
            {CURRENCY_FORMAT_PRECISE.format(((kvCores * BASE_KV_CPU_PRICE) + (kvMemory * BASE_KV_MEM_PRICE) + (kvStorage * BASE_KV_BACKUP_STORAGE_PRICE_GB)))}
            {' '}
            Raw
            Price
          </div>
          <div>
            x 2 (Hot Standby)
          </div>
          <div>
            ÷
            {' '}
            {(utilization / 100)}
            {' '}
            Utilization Rate
          </div>
          <hr className="bg-white h-0.5 w-full"/>
          <div>
            &nbsp;&nbsp;
            {' '}
            {CURRENCY_FORMAT_PRECISE.format(kvBaseCost)}
            {' '}
            Estimated Total Monthly Cost
          </div>
        </div>
      )
    },
    total: {
      stackCost: workloadStackCost + relationalStackCost + kvStackCost + networkStackCost + observabilityStackCost + accessControlStackCost + kubernetesStackCost + cicdStackCost,
      baseCost: workloadBaseCost + relationalBaseCost + kvBaseCost + networkBaseCost + observabilityBaseCost + accessControlBaseCost + kubernetesBaseCost + cicdBaseCost
    }
  }
}

function SavingsTableColHeader ({ children }: { children: ReactElement | string}) {
  return (
    <th className="bg-primary text-white py-2 sm:py-3 tracking-wide w-[25%] font-medium">
      {children}
    </th>
  )
}

function SavingsTableElementContainer ({ children }: {children: ReactElement | string}) {
  return (
    <td className="py-2 sm:py-3">
      <div className="flex items-center justify-center whitespace-nowrap">
        {children}
      </div>
    </td>
  )
}

function SavingsTableElement ({ cost, description }: {cost: number, description?: string | ReactElement}) {
  const rendered = CURRENCY_FORMAT.format(cost)
  return (
    <SavingsTableElementContainer>
      {description === undefined
        ? rendered
        : (
          <DefaultTooltipLazy
            title={description}
            limitWidth={false}
          >
            <span className="underline decoration-dotted decoration-accent decoration-2 underline-offset-4">
              {rendered}
            </span>
          </DefaultTooltipLazy>
        )
      }
    </SavingsTableElementContainer>
  )
}

function CalculatedSavingsTableElement ({ baseCost, stackCost, description }: {baseCost: number, stackCost: number, description?: string}) {
  const savingsPercent = (1 - (Math.max(1, stackCost) / Math.max(1, baseCost))) * 100
  const savingsDollar = baseCost - stackCost

  const rendered = `${CURRENCY_FORMAT.format(Math.floor(savingsDollar + 0.5))} (${Math.floor(savingsPercent + 0.5)}%)`
  return (
    <SavingsTableElementContainer>
      {description === undefined
        ? rendered
        : (
          <DefaultTooltipLazy
            title={description}
            limitWidth={false}
          >
            <span className="underline decoration-dotted decoration-accent decoration-2 underline-offset-4">
              {rendered}
            </span>
          </DefaultTooltipLazy>
        )
      }
    </SavingsTableElementContainer>
  )
}

interface SavingsTableRowProps {
  bold?: boolean;
  header: string;
  headerDescription?: string | ReactElement;
  stackCost: number;
  stackCostDescription?: string | ReactElement;
  baseCost: number
  baseCostDescription?: string | ReactElement;
}
function PriceTableRow (props: SavingsTableRowProps) {
  const {
    header,
    headerDescription,
    stackCost,
    stackCostDescription,
    baseCost,
    baseCostDescription,
    bold = false
  } = props

  return (
    <tr className={`m-0 bg-neutral border-b-[1px] border-r-[1px] border-solid border-secondary ${bold ? 'font-semibold' : ''}`}>
      <th className="bg-primary text-white tracking-wide text-left pl-4 whitespace-nowrap font-medium">
        {headerDescription === undefined
          ? header
          : (
            <DefaultTooltipLazy title={headerDescription}>
              <span className="underline decoration-dotted decoration-white decoration-2 underline-offset-4">
                {header}
              </span>
            </DefaultTooltipLazy>
          )}
      </th>
      <SavingsTableElement
        cost={baseCost}
        description={baseCostDescription}
      />
      <SavingsTableElement
        cost={stackCost}
        description={stackCostDescription}
      />
      <CalculatedSavingsTableElement
        baseCost={baseCost}
        stackCost={stackCost}
      />
    </tr>
  )
}

function InputRow ({ children, title }: {children: ReactElement, title: string | ReactElement}) {
  return (
    <div className="w-full flex flex-row gap-x-6 gap-y-6 items-center flex-wrap justify-center lg:justify-start">
      <div className="w-full lg:w-48 text-center lg:text-left text-lg font-medium">
        {title}
      </div>
      {children}
    </div>
  )
}

export default function Calculator () {
  const [utilization, setUtilization] = useQueryState('utilization', parseAsInteger.withDefault(25))
  const onUtilizationChange = useCallback((event: Event) => {
    const value = (event as unknown as ChangeEvent<HTMLInputElement>).target.value || '25'
    setIntFromString(value, setUtilization, 65)
  }, [setUtilization])

  const [workloadCores, setWorkloadCores] = useQueryState('workload-cores', parseAsInteger.withDefault(3))
  const onWorkloadCoresChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value
    setIntFromString(value, setWorkloadCores)
  }, [setWorkloadCores])

  const [workloadMemory, setWorkloadMemory] = useQueryState('workload-memory', parseAsInteger.withDefault(6))
  const onWorkloadMemoryChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value
    setIntFromString(value, setWorkloadMemory)
  }, [setWorkloadMemory])

  const [pgCores, setPGCores] = useQueryState('pg-cores', parseAsInteger.withDefault(1))
  const onPGCoresChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value
    setIntFromString(value, setPGCores)
  }, [setPGCores])

  const [pgMemory, setPGMemory] = useQueryState('pg-memory', parseAsInteger.withDefault(2))
  const onPGMemoryChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value
    setIntFromString(value, setPGMemory)
  }, [setPGMemory])

  const [pgStorage, setPGStorage] = useQueryState('pg-storage', parseAsInteger.withDefault(10))
  const onPGStorageChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value
    setIntFromString(value, setPGStorage)
  }, [setPGStorage])

  const [kvCores, setKVCores] = useQueryState('kv-cores', parseAsInteger.withDefault(1))
  const onKVCoresChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value
    setIntFromString(value, setKVCores)
  }, [setKVCores])

  const [kvMemory, setKVMemory] = useQueryState('kv-memory', parseAsInteger.withDefault(2))
  const onKVMemoryChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value
    setIntFromString(value, setKVMemory)
  }, [setKVMemory])

  const [kvStorage, setKVStorage] = useQueryState('kv-storage', parseAsInteger.withDefault(0))
  const onKVStorageChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value
    setIntFromString(value, setKVStorage)
  }, [setKVStorage])

  const [vpcCount, setVPCCount] = useQueryState('vpc-count', parseAsInteger.withDefault(1))
  const onVPCCountChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value
    setIntFromString(value, setVPCCount)
  }, [setVPCCount])

  const [egressTraffic, setEgressTraffic] = useQueryState('egress-traffic', parseAsInteger.withDefault(100))
  const onEgressTrafficChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value
    setIntFromString(value, setEgressTraffic)
  }, [setEgressTraffic])

  const [interAZTraffic, setInterAZTraffic] = useQueryState('inter-az-traffic', parseAsInteger.withDefault(1000))
  const onInterAZTrafficChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value
    setIntFromString(value, setInterAZTraffic)
  }, [setInterAZTraffic])

  const [logs, setLogs] = useQueryState('logs', parseAsInteger.withDefault(10))
  const onLogsChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value
    setIntFromString(value, setLogs)
  }, [setLogs])

  const [metrics, setMetrics] = useQueryState('metrics', parseAsInteger.withDefault(10))
  const onMetricsChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value
    setIntFromString(value, setMetrics)
  }, [setMetrics])

  const [spans, setSpans] = useQueryState('spans', parseAsInteger.withDefault(10))
  const onSpansChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value
    setIntFromString(value, setSpans)
  }, [setSpans])

  const [employeeCount, setEmployees] = useQueryState('employees', parseAsInteger.withDefault(10))
  const onEmployeesChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value
    setIntFromString(value, setEmployees)
  }, [setEmployees])

  const [developerCount, setDevelopers] = useQueryState('developers', parseAsInteger.withDefault(10))
  const onDevelopersChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value
    setIntFromString(value, setDevelopers)
  }, [setDevelopers])

  const [cicdMinutes, setCICDMinutes] = useQueryState('cicd-minutes', parseAsInteger.withDefault(60 * 24 * 30))
  const onCICDMinutesChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value
    setIntFromString(value, setCICDMinutes)
  }, [setCICDMinutes])

  const [snackbarOpen, setSnackbarOpen] = useState(false)

  const shareClick = useCallback(() => {
    void navigator.clipboard.writeText(window.location.href)
    setSnackbarOpen(true)
  }, [setSnackbarOpen])

  const closeSnackbar = useCallback(() => {
    setSnackbarOpen(false)
  }, [setSnackbarOpen])

  const setSmallPreset = useCallback(() => {
    void setEmployees(5)
    void setDevelopers(2)
    void setVPCCount(1)
    void setEgressTraffic(100)
    void setInterAZTraffic(1000)
    void setWorkloadCores(3)
    void setWorkloadMemory(6)
    void setPGCores(1)
    void setPGMemory(2)
    void setPGStorage(10)
    void setKVCores(1)
    void setKVMemory(2)
    void setKVStorage(0)
    void setMetrics(10)
    void setLogs(10)
    void setSpans(10)
    void setCICDMinutes(60 * 24 * 30)
  }, [
    setEmployees,
    setDevelopers,
    setVPCCount,
    setEgressTraffic,
    setInterAZTraffic,
    setWorkloadCores,
    setWorkloadMemory,
    setPGCores,
    setPGMemory,
    setPGStorage,
    setKVCores,
    setKVMemory,
    setKVStorage,
    setSpans,
    setLogs,
    setMetrics,
    setCICDMinutes
  ])

  const setMediumPreset = useCallback(() => {
    void setEmployees(50)
    void setDevelopers(10)
    void setVPCCount(3)
    void setEgressTraffic(1000)
    void setInterAZTraffic(10000)
    void setWorkloadCores(15)
    void setWorkloadMemory(30)
    void setPGCores(10)
    void setPGMemory(20)
    void setPGStorage(100)
    void setKVCores(10)
    void setKVMemory(20)
    void setKVStorage(10)
    void setMetrics(100)
    void setLogs(100)
    void setSpans(100)
    void setCICDMinutes(60 * 24 * 30 * 10)
  }, [
    setEmployees,
    setDevelopers,
    setVPCCount,
    setEgressTraffic,
    setInterAZTraffic,
    setWorkloadCores,
    setWorkloadMemory,
    setPGCores,
    setPGMemory,
    setPGStorage,
    setKVCores,
    setKVMemory,
    setKVStorage,
    setSpans,
    setLogs,
    setMetrics,
    setCICDMinutes
  ])

  const setLargePreset = useCallback(() => {
    void setEmployees(250)
    void setDevelopers(50)
    void setVPCCount(6)
    void setEgressTraffic(10000)
    void setInterAZTraffic(100000)
    void setWorkloadCores(100)
    void setWorkloadMemory(300)
    void setPGCores(50)
    void setPGMemory(200)
    void setPGStorage(1000)
    void setKVCores(25)
    void setKVMemory(100)
    void setKVStorage(100)
    void setMetrics(250)
    void setLogs(1000)
    void setSpans(1000)
    void setCICDMinutes(60 * 24 * 30 * 50)
  }, [
    setEmployees,
    setDevelopers,
    setVPCCount,
    setEgressTraffic,
    setInterAZTraffic,
    setWorkloadCores,
    setWorkloadMemory,
    setPGCores,
    setPGMemory,
    setPGStorage,
    setKVCores,
    setKVMemory,
    setKVStorage,
    setSpans,
    setLogs,
    setMetrics,
    setCICDMinutes
  ])

  const savings = calculateSavings({
    utilization,
    workloadCores,
    workloadMemory,
    pgCores,
    pgMemory,
    pgStorage,
    kvMemory,
    kvCores,
    kvStorage,
    egressTraffic,
    vpcCount,
    interAZTraffic,
    spans,
    metrics,
    logs,
    employeeCount,
    developerCount,
    cicdMinutes
  })

  return (
    <div className="py-8 px-8">
      <div className="max-w-7xl mx-auto flex flex-col gap-6">
        <h1
          className="text-5xl text-center py-4"
        >
          Savings Calculator
        </h1>
        <div className="flex flex-col items-center max-w-7xl mx-auto gap-6">
          <InputRow title={'Size Presets'}>
            <>
              <button
                className="bg-primary text-white py-2 px-8 rounded font-semibold sm:text-base"
                onClick={setSmallPreset}
              >
                Small
              </button>
              <button
                className="bg-primary text-white py-2 px-8 rounded font-semibold sm:text-base"
                onClick={setMediumPreset}
              >
                Medium
              </button>
              <button
                className="bg-primary text-white py-2 px-8 rounded font-semibold sm:text-base"
                onClick={setLargePreset}
              >
                Large
              </button>
            </>
          </InputRow>
          <InputRow title={'Organization'}>
            <>
              <TextField
                id="employee-count"
                label="Number of Employees"
                type="number"
                className={'w-1/2 sm:w-fit'}
                inputProps={{
                  step: 1
                }}
                InputLabelProps={{
                  shrink: true
                }}
                value={JSON.stringify(employeeCount)}
                onKeyDown={allowOnlyIntegers}
                onChange={onEmployeesChange}
              />
              <TextField
                id="developer-count"
                label="Number of Developers"
                type="number"
                className={'w-1/2 sm:w-fit'}
                inputProps={{
                  step: 1
                }}
                InputLabelProps={{
                  shrink: true
                }}
                value={JSON.stringify(developerCount)}
                onKeyDown={allowOnlyIntegers}
                onChange={onDevelopersChange}
              />
            </>
          </InputRow>
          <InputRow title={'Network'}>
            <>
              <TextField
                id="vpc-count"
                label="Number of VPCs"
                type="number"
                inputProps={{
                  step: 1
                }}
                InputLabelProps={{
                  shrink: true
                }}
                value={JSON.stringify(vpcCount)}
                onKeyDown={allowOnlyIntegers}
                onChange={onVPCCountChange}
              />
              <TextField
                id="egress-traffic"
                label="Monthly Outbound Traffic GB"
                type="number"
                inputProps={{
                  step: 1
                }}
                InputLabelProps={{
                  shrink: true
                }}
                value={JSON.stringify(egressTraffic)}
                onKeyDown={allowOnlyIntegers}
                onChange={onEgressTrafficChange}
              />
              <TextField
                id="inter-az-traffic"
                label="Monthly Inter-AZ Traffic GB"
                type="number"
                inputProps={{
                  step: 1
                }}
                InputLabelProps={{
                  shrink: true
                }}
                value={JSON.stringify(interAZTraffic)}
                onKeyDown={allowOnlyIntegers}
                onChange={onInterAZTrafficChange}
              />
            </>
          </InputRow>
          <InputRow
            title={(
              <DefaultTooltipLazy
                title={'The average percent of provisioned resource capacity actually being used by your workloads. A normal range is 20-30% and a ceiling is 65% as you should always have hot spare capacity.'}
              >
                <span className="underline decoration-dotted decoration-black decoration-2 underline-offset-4">
                  Resource Utilization %
                </span>
              </DefaultTooltipLazy>
            )}
          >
            <div className="w-8/12">
              <Slider
                value={utilization}
                step={5}
                min={5}
                max={65}
                marks={true}
                valueLabelDisplay="auto"
                aria-label="Utilization"
                onChange={onUtilizationChange}
              />
            </div>
          </InputRow>
          <InputRow title={'Application Servers'}>
            <>
              <TextField
                id="workload-cpu-cores"
                label="vCPU Cores"
                type="number"
                inputProps={{
                  step: 1
                }}
                InputLabelProps={{
                  shrink: true
                }}
                value={JSON.stringify(workloadCores)}
                onKeyDown={allowOnlyIntegers}
                onChange={onWorkloadCoresChange}
              />

              <TextField
                id="workload-memory-gb"
                label="Memory GB"
                type="number"
                inputProps={{
                  step: 1
                }}
                InputLabelProps={{
                  shrink: true
                }}
                value={JSON.stringify(workloadMemory)}
                onKeyDown={allowOnlyIntegers}
                onChange={onWorkloadMemoryChange}
              />
            </>
          </InputRow>
          <InputRow
            title={(
              <DefaultTooltipLazy title={'For example, PostgreSQL or MySQL'}>
                <span className="underline decoration-dotted decoration-black decoration-2 underline-offset-4">
                  Relational Databases
                </span>
              </DefaultTooltipLazy>
            )}
          >
            <>
              <TextField
                id="postgres-cpu-cores"
                label="vCPU Cores"
                type="number"
                inputProps={{
                  step: 1
                }}
                InputLabelProps={{
                  shrink: true
                }}
                value={JSON.stringify(pgCores)}
                onKeyDown={allowOnlyIntegers}
                onChange={onPGCoresChange}
              />

              <TextField
                id="postgres-memory-gb"
                label="Memory GB"
                type="number"
                inputProps={{
                  step: 1
                }}
                InputLabelProps={{
                  shrink: true
                }}
                value={JSON.stringify(pgMemory)}
                onKeyDown={allowOnlyIntegers}
                onChange={onPGMemoryChange}
              />

              <TextField
                id="postgres-storage-gb"
                label="Storage GB"
                type="number"
                inputProps={{
                  step: 1
                }}
                InputLabelProps={{
                  shrink: true
                }}
                value={JSON.stringify(pgStorage)}
                onKeyDown={allowOnlyIntegers}
                onChange={onPGStorageChange}
              />
            </>
          </InputRow>
          <InputRow
            title={(
              <DefaultTooltipLazy title={'For example, Redis or memcached'}>
                <span className="underline decoration-dotted decoration-black decoration-2 underline-offset-4">
                  Key-Value Databases
                </span>
              </DefaultTooltipLazy>
            )}
          >
            <>
              <TextField
                id="kv-cpu-cores"
                label="vCPU Cores"
                type="number"
                inputProps={{
                  step: 1
                }}
                InputLabelProps={{
                  shrink: true
                }}
                value={JSON.stringify(kvCores)}
                onKeyDown={allowOnlyIntegers}
                onChange={onKVCoresChange}
              />

              <TextField
                id="kv-memory-gb"
                label="Memory GB"
                type="number"
                inputProps={{
                  step: 1
                }}
                InputLabelProps={{
                  shrink: true
                }}
                value={JSON.stringify(kvMemory)}
                onKeyDown={allowOnlyIntegers}
                onChange={onKVMemoryChange}
              />

              <TextField
                id="kv-storage-gb"
                label="Storage GB"
                type="number"
                inputProps={{
                  step: 1
                }}
                InputLabelProps={{
                  shrink: true
                }}
                value={JSON.stringify(kvStorage)}
                onKeyDown={allowOnlyIntegers}
                onChange={onKVStorageChange}
              />
            </>

          </InputRow>
          <InputRow title={'Observability'}>
            <>
              <TextField
                id="logs"
                label="GB Logs / Month"
                type="number"
                inputProps={{
                  step: 1
                }}
                InputLabelProps={{
                  shrink: true
                }}
                value={JSON.stringify(logs)}
                onKeyDown={allowOnlyIntegers}
                onChange={onLogsChange}
              />

              <TextField
                id="metrics"
                label="# of Metrics (Ks)"
                type="number"
                inputProps={{
                  step: 1
                }}
                InputLabelProps={{
                  shrink: true
                }}
                value={JSON.stringify(metrics)}
                onKeyDown={allowOnlyIntegers}
                onChange={onMetricsChange}
              />

              <TextField
                id="spans"
                label="# of Tracing Spans / Month (Ms)"
                type="number"
                inputProps={{
                  step: 1
                }}
                InputLabelProps={{
                  shrink: true
                }}
                value={JSON.stringify(spans)}
                onKeyDown={allowOnlyIntegers}
                onChange={onSpansChange}
              />
            </>

          </InputRow>
          <InputRow title={'CI / CD'}>
            <TextField
              id="cicd-minutes"
              label="CPU-Minutes / Month"
              type="number"
              inputProps={{
                step: 1
              }}
              InputLabelProps={{
                shrink: true
              }}
              value={JSON.stringify(cicdMinutes)}
              onKeyDown={allowOnlyIntegers}
              onChange={onCICDMinutesChange}
            />
          </InputRow>
        </div>
        <h3
          className="text-3xl text-center pt-4"
        >
          Infrastructure Cost Savings
        </h3>
        <div className="flex justify-center gap-4">
          <div
            className="bg-gray-dark text-black font-medium rounded px-4 py-2 text-2xl"
          >
            {CURRENCY_FORMAT.format(savings.total.baseCost - savings.total.stackCost)}
            {' '}
            / month
          </div>
          <button
            className="bg-primary text-white font-medium rounded px-4 py-2 text-xl"
            onClick={shareClick}
          >
            Share
          </button>
          <Snackbar
            open={snackbarOpen}
            autoHideDuration={3000}
            onClose={closeSnackbar}
            message="Copied stateful link to clipboard"
          />
        </div>

        <p
          className="max-w-5xl mx-auto text-lg"
        >
          These savings are based on comparable usage of popular managed services on AWS (On-Demand Pricing), Datadog,
          Okta, and GitHub
          actions
          that can be directly replaced by functionality included in the stack. These are
          course-grained
          {' '}
          <b>estimates</b>
          , and
          we can provide a more precise savings analysis if you
          {' '}
          <Link
            href="/stack/pricing/contact"
            className="text-primary underline hover:cursor-pointer"
          >
            contact
            us.
          </Link>
        </p>
        <div className="flex lg:justify-center overflow-x-auto py-2">
          <table className="border-collapse text-base lg:text-lg table-fixed min-w-[850px] lg:min-w-[990px]">
            <thead>
              <tr>
                <th className="invisible w-[25%]">Savings</th>
                <SavingsTableColHeader>Base Cost</SavingsTableColHeader>
                <SavingsTableColHeader>Stack Cost</SavingsTableColHeader>
                <SavingsTableColHeader>Monthly Savings</SavingsTableColHeader>
              </tr>

            </thead>
            <tbody>
              <PriceTableRow
                header={'Access Control'}
                stackCost={savings.accessControl.stackCost}
                stackCostDescription={savings.accessControl.stackCostDescription}
                baseCost={savings.accessControl.baseCost}
                baseCostDescription={savings.accessControl.baseCostDescription}
              />
              <PriceTableRow
                header={'Networking'}
                stackCost={savings.network.stackCost}
                stackCostDescription={savings.network.stackCostDescription}
                baseCost={savings.network.baseCost}
                baseCostDescription={savings.network.baseCostDescription}
              />
              <PriceTableRow
                header={'Kubernetes Clusters'}
                stackCost={savings.kubernetes.stackCost}
                stackCostDescription={savings.kubernetes.stackCostDescription}
                baseCost={savings.kubernetes.baseCost}
                baseCostDescription={savings.kubernetes.baseCostDescription}
              />
              <PriceTableRow
                header={'Stateless Workloads'}
                stackCost={savings.workload.stackCost}
                stackCostDescription={savings.workload.stackCostDescription}
                baseCost={savings.workload.baseCost}
                baseCostDescription={savings.workload.baseCostDescription}
              />
              <PriceTableRow
                header={'Relational Databases'}
                stackCost={savings.relationalDB.stackCost}
                stackCostDescription={savings.relationalDB.stackCostDescription}
                baseCost={savings.relationalDB.baseCost}
                baseCostDescription={savings.relationalDB.baseCostDescription}
              />
              <PriceTableRow
                header={'KV Databases'}
                stackCost={savings.kv.stackCost}
                stackCostDescription={savings.kv.stackCostDescription}
                baseCost={savings.kv.baseCost}
                baseCostDescription={savings.kv.baseCostDescription}
              />
              <PriceTableRow
                header={'Observability'}
                stackCost={savings.observability.stackCost}
                stackCostDescription={savings.observability.stackCostDescription}
                baseCost={savings.observability.baseCost}
                baseCostDescription={savings.observability.baseCostDescription}
              />
              <PriceTableRow
                header={'CICD'}
                stackCost={savings.cicd.stackCost}
                stackCostDescription={savings.cicd.stackCostDescription}
                baseCost={savings.cicd.baseCost}
                baseCostDescription={savings.cicd.baseCostDescription}
              />
              <PriceTableRow
                bold={true}
                header={'Total'}
                stackCost={savings.total.stackCost}
                baseCost={savings.total.baseCost}
              />
            </tbody>
          </table>
        </div>

      </div>

    </div>
  )
}
