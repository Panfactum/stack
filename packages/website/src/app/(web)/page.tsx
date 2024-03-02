import { SortUp, Fingerprint, PackageLock, HandCard, CandlestickChart, Globe } from 'iconoir-react'
import Link from 'next/link'

export default function Page () {
  return (
    <div className="flex flex-col">
      <div
        className="bg-neutral flex flex-row flex-wrap-reverse px-8 py-8 md:py-16"
      >
        <div className="mt-8 basis-full md:basis-1/2 flex flex-col gap-4 md:pr-8">
          <h2 className="text-primary text-2xl md:text-4xl font-semibold">
            Some overview statement
          </h2>
          <p className="text-lg md:text-xl">
            More info more info More info more info More info more info More info more info More info more info More info more info More info more info
            More info more info More info more info More info more info More info more info More info more info More info more info
          </p>
          <Link
            href="/stack"
            className="btn-primary text-xl md:text-2xl font-bold w-fit py-4 px-8 rounded-md bg-primary text-white"
          >
            Learn More
          </Link>
        </div>
        <div className="basis-full md:basis-1/2 px-8">
          <div className="h-48 bg-black md:h-full w-full block" />
        </div>
      </div>
      <div className="flex flex-col px-8 py-8 md:py-16">
        <h2 className="text-primary text-4xl text-center w-full">Some overview statement</h2>
        <div className="flex flex-row flex-wrap">
          <div className="basis-full md:basis-1/3 flex flex-col p-4 gap-2">
            <PackageLock
              width="50%"
              height="66%"
              className="mx-auto"
            />
            <p className="text-xl text-center">
              Blah blah blah
            </p>
          </div>
          <div className="basis-full md:basis-1/3 flex flex-col p-4 gap-2">
            <SortUp
              width="50%"
              height="66%"
              className="mx-auto"
            />
            <p className="text-xl text-center">
              Blah blah blah
            </p>
          </div>
          <div className="basis-full md:basis-1/3 flex flex-col p-4 gap-2">
            <Fingerprint
              width="40%"
              height="66%"
              className="mx-auto"
            />
            <p className="text-xl text-center">
              Blah blah blah
            </p>
          </div>
        </div>
      </div>
      <div className="bg-neutral flex flex-col px-8 py-8 md:py-16">
        <h2 className="text-primary text-4xl text-center w-full">
          Some overview statement
        </h2>
        <div className="flex flex-row w-full flex-wrap">
          <div className="basis-full md:basis-1/3 flex flex-col p-4 gap-2">
            <Globe
              width="40%"
              height="66%"
              className="mx-auto"
            />
            <p className="text-xl text-center">
              Blah blah blah blah blah
            </p>
          </div>
          <div className="basis-full md:basis-1/3 flex flex-col p-4 gap-2">
            <HandCard
              width="50%"
              height="66%"
              className="mx-auto"
            />
            <p className="text-xl text-center">
              Blah blah blah blah blah
            </p>
          </div>
          <div className="basis-full md:basis-1/3 flex flex-col p-4 gap-2">
            <CandlestickChart
              width="40%"
              height="66%"
              className="mx-auto"
            />
            <p className="text-xl text-center">
              Blah blah blah blah blah
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
