'use client'

import type { ChangeEvent } from 'react'
import { useState } from 'react'
import { LineChart, Line, XAxis, YAxis, ReferenceLine } from 'recharts'
import { Slider } from '@/components/ui/slider'

function generateData(
  deviation: number,
  outlierPercent: number,
  outlierMultiplier: number,
) {
  return Array.from(Array(100)).map((_, i) => {
    const isBig = Math.random() < outlierPercent
    const scalar = isBig ? outlierMultiplier * 10 : 10
    return {
      y: scalar + Math.floor(Math.random() * (scalar * deviation)),
      x: i,
    }
  })
}

function calcP90(data: Array<{ y: number }>) {
  const values = data.map(({ y }) => y)
  return values.sort((a, b) => (a < b ? -1 : 1))[90] || 0
}

function calcAvg(data: Array<{ y: number }>) {
  const values = data.map(({ y }) => y)
  const sum = values.reduce((acc, val) => {
    return acc + val
  }, 0)
  return sum / values.length
}

export default function ConsumptionEfficiencyChart() {
  const [deviation, setDeviation] = useState(0.5)
  const [outlierMultiplier, setOutlierMultiplier] = useState(5)
  const [outlierChance, setOutlierChance] = useState(0.15)

  let efficiency = 1
  let data: Array<{ y: number; x: number }> = []
  let p90 = 0
  let p90Plus = 0
  let avg = 0
  let loop = 0

  // We juice the metrics a bit to ensure that randomness doesn't defeat the purpose of the example
  // eslint-disable-next-line no-unmodified-loop-condition
  while (
    avg === 0 ||
    (loop < 25 &&
      outlierMultiplier > 1 &&
      outlierChance > 0.1 &&
      efficiency > 60)
  ) {
    data = generateData(deviation, outlierChance, outlierMultiplier)
    p90 = calcP90(data)
    p90Plus = calcP90(data) * 1.15
    avg = calcAvg(data)
    efficiency = Math.floor((avg / p90Plus) * 100)
    loop += 1
  }

  return (
    <div className="flex flex-col gap-5 items-center px-10 py-10">
      <div className="flex gap-3 items-center w-full">
        <div className="min-w-[150px]">Base Jitter</div>
        <div>0</div>
        <Slider
          defaultValue={[deviation]}
          min={0}
          max={1}
          step={0.1}
          onValueChange={([ev]) => setDeviation(ev)}
          aria-label="Jitter"
        />
        <div>1</div>
      </div>

      <div className="flex gap-3 items-center w-full">
        <div className="min-w-[150px]">Outlier Chance</div>
        <div>10</div>
        <Slider
          defaultValue={[outlierChance]}
          step={0.01}
          min={0.1}
          max={0.3}
          onValueChange={([ev]) => setOutlierChance(ev)}
          aria-label="Outlier Chance"
        />
        <div>30%</div>
      </div>

      <div className="flex gap-3 items-center w-full">
        <div className="min-w-[150px]">Outlier Multiplier</div>
        <div>1</div>
        <Slider
          defaultValue={[outlierMultiplier]}
          step={0.5}
          min={1}
          max={10}
          onValueChange={([ev]) => setOutlierMultiplier(ev)}
          aria-label="Outlier Multiplier"
        />
        <div>10x</div>
      </div>
      <div className="text-xl">
        Consumption Efficiency: {Math.floor((avg / p90Plus) * 100)}%
      </div>
      <LineChart
        width={600}
        height={400}
        data={data}
        margin={{ top: 5, right: 20, bottom: 5, left: 0 }}
      >
        <XAxis dataKey={'x'} tick={false} />
        <YAxis
          label={{
            value: 'CPU (millicores)',
            angle: -90,
            position: 'insideLeft',
            fill: 'black',
          }}
          domain={[0, Math.floor(p90Plus * 1.1)]}
          allowDecimals={false}
        />
        <ReferenceLine
          y={p90Plus}
          label={{
            value: 'Resource Request',
            dy: 15,
            dx: 100,
            fill: 'black',
            stroke: '20',
          }}
          stroke="red"
          strokeWidth={3}
          ifOverflow={'visible'}
          isFront={true}
        />
        <ReferenceLine
          y={p90}
          label={{ value: 'P90', dy: 15, dx: -100, fill: 'black' }}
          stroke="red"
          strokeDasharray="3 3"
          isFront={true}
        />
        <ReferenceLine
          y={avg}
          label={{ value: 'Average', dy: 15, fill: 'black' }}
          stroke="green"
          isFront={true}
        />
        <Line type="monotone" dataKey="y" stroke={'#8884d8'} dot={false} />
      </LineChart>
    </div>
  )
}
