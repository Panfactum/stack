'use client'

import type { ChangeEvent, ReactElement, KeyboardEvent } from 'react'
import { useMemo, useState, useCallback } from 'react'
import { useLocalStorage } from 'usehooks-ts'
import SavingsTable from '@/components/pricing/savings-table'
import { Button } from '@/components/ui/button.tsx'
import { Input } from '@/components/ui/input.tsx'
import { Label } from '@/components/ui/label.tsx'
import { Slider } from '@/components/ui/slider.tsx'
import { Toaster } from '@/components/ui/toaster.tsx'
import Tooltip from '@/components/ui/tooltip.tsx'
import { useToast } from '@/hooks/use-toast.ts'

const NUMBER = /^[0-9]+$/

// Prevents non-integer inputs to form field
function allowOnlyIntegers(event: KeyboardEvent) {
  const value = event.key
  if (
    !event.shiftKey &&
    !event.ctrlKey &&
    !event.metaKey &&
    value.length === 1 &&
    !NUMBER.test(value)
  ) {
    event.preventDefault()
  }
}

function setIntFromString(
  value: string,
  setter: (value: number) => unknown,
  max = 100000,
) {
  if (value.length === 0) {
    void setter(0)
  } else if (NUMBER.test(value)) {
    const intValue = parseInt(value)
    if (intValue >= 0 && intValue <= max) {
      void setter(intValue)
    }
  }
}

function getQueryParams(name, url) {
  const params = new URLSearchParams(new URL(url).search)

  const value = params.get(name)

  return useState(value ? parseInt(value) : undefined)
}

// This function gets the value with the following precedence:
// - query string
// - local storage
// - default
// It will also update the query string and local storage when the value changes.
function useIntegerInput(
  name: string,
  defaultValue: number,
  maxValue?: number,
) {
  const [localValue, setLocalValue] = useLocalStorage<number>(
    `sc-${name}`,
    defaultValue,
    { initializeWithValue: false },
  )
  const [qsValue, setQSValue] = getQueryParams(name, window.location.href)
  const setValue = useCallback(
    (newValue: number) => {
      setLocalValue(newValue)
      setQSValue(newValue)
    },
    [setLocalValue, setQSValue],
  )
  const onValueChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value
      setIntFromString(value, setValue, maxValue)
    },
    [setValue, maxValue],
  )

  return [qsValue ?? localValue, setValue, onValueChange] as const
}

function InputRow({
  children,
  title,
}: {
  children: ReactElement
  title: string | ReactElement
}) {
  return (
    <tr className="w-full flex flex-col items-start lg:flex-row py-4">
      <td className="text-md font-semibold py-4 min-w-[300px] lg:text-left py-4">
        {title}
      </td>
      <td colSpan={4} className="w-full">
        {children}
      </td>
    </tr>
  )
}

function IntegerInput({
  id,
  label,
  value,
  onChange,
}: {
  id: string
  label: string
  value: number
  onChange: (e: ChangeEvent<HTMLInputElement>) => void
}) {
  return (
    <div className={`flex flex-1 flex-col self-stretch gap-y-sm`}>
      <Label className={`text-secondary text-sm font-inter whitespace-nowrap`}>{label}</Label>
      <Input
        id={id}
        type="number"
        className={'w-full'}
        value={JSON.stringify(value)}
        onKeyDown={allowOnlyIntegers}
        onChange={onChange}
      />
    </div>
  )
}

export default function Calculator({
  pathName,
  ...props
}: {
  pathName: string
}) {
  console.log('pathname', pathName, props)
  const [utilization, setUtilization, onUtilizationChange] = useIntegerInput(
    'utilization',
    25,
    65,
  )
  const [workloadCores, setWorkloadCores, onWorkloadCoresChange] =
    useIntegerInput('workload-cores', 3)
  const [workloadMemory, setWorkloadMemory, onWorkloadMemoryChange] =
    useIntegerInput('workload-memory', 6)
  const [pgCores, setPGCores, onPGCoresChange] = useIntegerInput('pg-cores', 1)
  const [pgMemory, setPGMemory, onPGMemoryChange] = useIntegerInput(
    'pg-memory',
    2,
  )
  const [pgStorage, setPGStorage, onPGStorageChange] = useIntegerInput(
    'pg-storage',
    10,
  )
  const [kvCores, setKVCores, onKVCoresChange] = useIntegerInput('kv-cores', 1)
  const [kvMemory, setKVMemory, onKVMemoryChange] = useIntegerInput(
    'kv-memory',
    2,
  )
  const [kvStorage, setKVStorage, onKVStorageChange] = useIntegerInput(
    'kv-storage',
    0,
  )
  const [vpcCount, setVPCCount, onVPCCountChange] = useIntegerInput(
    'vpc-count',
    1,
  )
  const [egressTraffic, setEgressTraffic, onEgressTrafficChange] =
    useIntegerInput('egress-traffic', 100)
  const [interAZTraffic, setInterAZTraffic, onInterAZTrafficChange] =
    useIntegerInput('inter-az-traffic', 1000)
  const [logs, setLogs, onLogsChange] = useIntegerInput('logs', 1000)
  const [metrics, setMetrics, onMetricsChange] = useIntegerInput('metrics', 10)
  const [spans, setSpans, onSpansChange] = useIntegerInput('spans', 10)
  const [employeeCount, setEmployees, onEmployeesChange] = useIntegerInput(
    'employees',
    10,
  )
  const [developerCount, setDevelopers, onDevelopersChange] = useIntegerInput(
    'developers',
    10,
  )
  const [cicdMinutes, setCICDMinutes, onCICDMinutesChange] = useIntegerInput(
    'cicd-minutes',
    60 * 24 * 30,
  )
  const [lablorCostHourly, __, onLaborCostHourlyChange] = useIntegerInput(
    'labor-cost',
    100,
  )

  const { setSmallPreset, setMediumPreset, setLargePreset, setSoloPreset } =
    useMemo(
      () => ({
        setSoloPreset: () => {
          void setEmployees(1)
          void setDevelopers(1)
          void setVPCCount(1)
          void setEgressTraffic(10)
          void setInterAZTraffic(100)
          void setWorkloadCores(1)
          void setWorkloadMemory(2)
          void setPGCores(1)
          void setPGMemory(1)
          void setPGStorage(10)
          void setKVCores(0)
          void setKVMemory(0)
          void setKVStorage(0)
          void setMetrics(0)
          void setLogs(10)
          void setSpans(0)
          void setCICDMinutes(60 * 24 * 10)
        },
        setSmallPreset: () => {
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
        },
        setMediumPreset: () => {
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
        },
        setLargePreset: () => {
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
        },
      }),
      [
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
        setCICDMinutes,
      ],
    )
  const [snackbarOpen, setSnackbarOpen] = useState(false)

  const closeSnackbar = useCallback(() => {
    setSnackbarOpen(false)
  }, [setSnackbarOpen])

  const path = pathName

  const { toast } = useToast()

  const copyLinkToClipboard = useCallback(() => {
    const qs = new URLSearchParams([
      ['utilization', JSON.stringify(utilization)],
      ['workload-cores', JSON.stringify(workloadCores)],
      ['workload-memory', JSON.stringify(workloadMemory)],
      ['pg-cores', JSON.stringify(pgCores)],
      ['pg-memory', JSON.stringify(pgMemory)],
      ['pg-storage', JSON.stringify(pgStorage)],
      ['kv-cores', JSON.stringify(kvCores)],
      ['kv-memory', JSON.stringify(kvMemory)],
      ['kv-storage', JSON.stringify(kvStorage)],
      ['vpc-count', JSON.stringify(vpcCount)],
      ['egress-traffic', JSON.stringify(egressTraffic)],
      ['inter-az-traffic', JSON.stringify(interAZTraffic)],
      ['logs', JSON.stringify(logs)],
      ['metrics', JSON.stringify(metrics)],
      ['spans', JSON.stringify(spans)],
      ['employees', JSON.stringify(employeeCount)],
      ['developers', JSON.stringify(developerCount)],
      ['cicd-minutes', JSON.stringify(cicdMinutes)],
      ['labor-cost', JSON.stringify(lablorCostHourly)],
    ]).toString()
    void navigator.clipboard.writeText(`https://panfactum.com${path}?${qs}`)
    setSnackbarOpen(true)
    toast({
      title: 'Copied stateful link to clipboard',
    })
  }, [
    utilization,
    workloadCores,
    workloadMemory,
    pgCores,
    pgMemory,
    pgStorage,
    kvCores,
    kvMemory,
    kvStorage,
    vpcCount,
    egressTraffic,
    interAZTraffic,
    logs,
    metrics,
    spans,
    employeeCount,
    developerCount,
    cicdMinutes,
    path,
    setSnackbarOpen,
    lablorCostHourly,
  ])

  return (
    <>
      <table className="w-full">
        <tbody>
          <tr className="w-full flex flex-col items-start lg:flex-row">
            <td className="text-md font-semibold py-4 min-w-[300px] lg:text-left">
              Size Presets
            </td>
            <td colSpan={4}>
              <div className="flex items-center gap-4">
                <Button variant={'outline'} size={`sm`} onClick={setSoloPreset}>
                  Solo
                </Button>
                <Button variant={'outline'} size={`sm`} onClick={setSmallPreset}>
                  Small
                </Button>
                <Button variant={'outline'} size={`sm`} onClick={setMediumPreset}>
                  Medium
                </Button>
                <Button variant={'outline'} size={`sm`} onClick={setLargePreset}>
                  Large
                </Button>
              </div>
            </td>
          </tr>
          <InputRow title={'Organization'}>
          <div className="flex items-center flex-col lg:flex-row gap-4">
            <IntegerInput
              id="employee-count"
              label="Number of Employees"
              value={employeeCount}
              onChange={onEmployeesChange}
            />
            <IntegerInput
              id="developer-count"
              label="Number of Developers"
              value={developerCount}
              onChange={onDevelopersChange}
            />
            <IntegerInput
              id="labor-cost"
              label="Developer Cost (Hourly USD)"
              value={lablorCostHourly}
              onChange={onLaborCostHourlyChange}
            />
          </div>
        </InputRow>
        <InputRow title={'Network'}>
          <div className="flex items-center flex-col lg:flex-row gap-4">
            <IntegerInput
              id="vpc-count"
              label="Number of VPCs"
              value={vpcCount}
              onChange={onVPCCountChange}
            />
            <IntegerInput
              id="egress-traffic"
              label="Outbound Traffic GB / Month"
              value={egressTraffic}
              onChange={onEgressTrafficChange}
            />
            <IntegerInput
              id="inter-az-traffic"
              label="Inter-AZ Traffic GB / Month"
              value={interAZTraffic}
              onChange={onInterAZTrafficChange}
            />
          </div>
        </InputRow>
        <InputRow
          title={
            <Tooltip
              title={
                'The average percent of provisioned resource capacity actually being used by your workloads. A normal range is 20-30% and a ceiling is 65% as you should always have hot spare capacity.'
              }
              position={'right'}
            >
              <span className="underline decoration-dotted decoration-black decoration-2 underline-offset-4">
                Resource Utilization %
              </span>
            </Tooltip>
          }
        >
          <div className="w-full flex items-center h-[56px]">
            <div className="flex-none w-[32px]">5%</div>
            <Slider
              defaultValue={[utilization]}
              min={0}
              max={1}
              step={0.1}
              onValueChange={([a]) => {
                setUtilization(a)
              }}
              className="flex-1"
            />
            <div className="flex-none flex items-center justify-end w-[48px]">65%</div>
          </div>
        </InputRow>
        <InputRow title={'Application Servers'}>
          <div className="flex items-center gap-4">
            <IntegerInput
              id="workload-cpu-cores"
              label="vCPU Cores"
              value={workloadCores}
              onChange={onWorkloadCoresChange}
            />
            <IntegerInput
              id="workload-memory-gb"
              label="Memory GB"
              value={workloadMemory}
              onChange={onWorkloadMemoryChange}
            />
            <div className={`flex-1`}></div>
          </div>
        </InputRow>
        <InputRow
          title={
            <Tooltip
              title={'For example, PostgreSQL or MySQL'}
              position={'right'}
            >
              <span className="underline decoration-dotted decoration-black decoration-2 underline-offset-4">
                Relational Databases
              </span>
            </Tooltip>
          }
        >
          <div className="flex items-center flex-col lg:flex-row gap-4">
            <IntegerInput
              id="postgres-cpu-cores"
              label="vCPU Cores"
              value={pgCores}
              onChange={onPGCoresChange}
            />
            <IntegerInput
              id="postgres-memory-gb"
              label="Memory GB"
              value={pgMemory}
              onChange={onPGMemoryChange}
            />
            <IntegerInput
              id="postgres-storage-gb"
              label="Storage GB"
              value={pgStorage}
              onChange={onPGStorageChange}
            />
          </div>
        </InputRow>
        <InputRow
          title={
            <Tooltip
              title={'For example, Redis or memcached'}
              position={'right'}
            >
              <span className="underline decoration-dotted decoration-black decoration-2 underline-offset-4">
                Key-Value Databases
              </span>
            </Tooltip>
          }
        >
          <div className="flex items-center flex-col lg:flex-row gap-4">
            <IntegerInput
              id="kv-cpu-cores"
              label="vCPU Cores"
              value={kvCores}
              onChange={onKVCoresChange}
            />
            <IntegerInput
              id="kv-memory-gb"
              label="Memory GB"
              value={kvMemory}
              onChange={onKVMemoryChange}
            />
            <IntegerInput
              id="kv-storage-gb"
              label="Storage GB"
              value={kvStorage}
              onChange={onKVStorageChange}
            />
          </div>
        </InputRow>
        <InputRow title={'Observability'}>
          <div className="flex items-center flex-col lg:flex-row gap-4">
            <IntegerInput
              id="logs"
              label="GB Logs / Month"
              value={logs}
              onChange={onLogsChange}
            />
            <IntegerInput
              id="metrics"
              label="# of Metrics (Ks)"
              value={metrics}
              onChange={onMetricsChange}
            />
            <IntegerInput
              id="spans"
              label="# of Tracing Spans / Month (Ms)"
              value={spans}
              onChange={onSpansChange}
            />
          </div>
        </InputRow>
        <InputRow
          title={
            <Tooltip
              title={
                'CPU-minutes are the number of minutes a CI/CD pipeline is running multiplied by the number of provisioned vCPUs. For example, in standard GHA this would be 2 / minute.'
              }
              position={'right'}
            >
              <span className="underline decoration-dotted decoration-black decoration-2 underline-offset-4">
                CI / CD
              </span>
            </Tooltip>
          }
        >
          <IntegerInput
            id="cicd-minutes"
            label="CPU-Minutes / Month"
            value={cicdMinutes}
            onChange={onCICDMinutesChange}
          />
          <div className={`flex-1`}></div>
          <div className={`flex-1`}></div>
        </InputRow>
        </tbody>
      </table>
      <div className="flex flex-col items-center self-stretch gap-y-6xl">
        
      </div>
      <SavingsTable
        workloadCores={workloadCores}
        workloadMemory={workloadMemory}
        pgCores={pgCores}
        pgMemory={pgMemory}
        pgStorage={pgStorage}
        kvCores={kvCores}
        kvMemory={kvMemory}
        kvStorage={kvStorage}
        utilization={utilization}
        egressTraffic={egressTraffic}
        vpcCount={vpcCount}
        interAZTraffic={interAZTraffic}
        logs={logs}
        spans={spans}
        metrics={metrics}
        employeeCount={employeeCount}
        developerCount={developerCount}
        cicdMinutes={cicdMinutes}
        laborCostHourly={lablorCostHourly}
        copyLinkToClipboard={copyLinkToClipboard}
      />
      {/*<Snackbar
          open={snackbarOpen}
          autoHideDuration={3000}
          onClose={closeSnackbar}
          message="Copied stateful link to clipboard"
        />*/}
      <Toaster />
    </>
  )
}
