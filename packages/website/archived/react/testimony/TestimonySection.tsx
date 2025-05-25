import { useEffect, useState } from "react";

const TESTIMONIES = [
  {
    image: "./testimony-image.png",
    quote: `Love the simplicity of the service and the prompt customer
                support. We can’t imagine working without it.`,
    name: "Mathilide Lewis",
    title: "Head of Engineering, Layers",
    saving: "$10,000",
    savingPeriod: "Saved/month",
  },
  {
    image: "./testimony-image.png",
    quote: `I hate every ape I see. From Chimpan A to Chimpanze.`,
    name: "Harry Mann",
    title: "Head of Marketing",
    saving: "$30,000",
    savingPeriod: "Saved/month",
  },
  {
    image: "./testimony-image.png",
    quote: `That's a problem for future Homer.  I don't ever want to be THAT guy.`,
    name: "Homer Simpson",
    title: "CEO",
    saving: "$20,000",
    savingPeriod: "Saved/month",
  },
];

export default function TestimonySection() {
  const [current, setCurrent] = useState(0);

  // Automatically change the current testimony every 3 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % TESTIMONIES.length);
    }, 7000);

    // Cleanup on unmount
    return () => clearInterval(timer);
  }, []);

  return (
    <section className="py-4xl  w-full relative">
      {/* 
        Wrapping the slides in a relative container so each slide can be absolutely
        positioned and overlap each other for the fade effect.
      */}
      <div className="relative w-full min-h-[500px] lg:min-h-[250px] h-full">
        {TESTIMONIES.map((item, index) => (
          <div
            key={index}
            // Position all slides absolutely on top of each other
            // and transition the opacity for the fade effect
            className={`absolute inset-0 transition-opacity duration-1000 
              ${index === current ? "opacity-100 z-10" : "opacity-0 z-0"}
            `}
          >
            <div className="container max-w-[1344px] mx-auto px-8 md:px-[64px] lg:px-[104px] flex items-center">
              <div className="flex flex-col lg:flex-row items-start lg:items-center gap-x-7xl">
                <div className="flex-none image-block w-[200px] lg:w-[224px] h-[200px] lg:h-[224px]">
                  <img src={item.image} alt="testimony-image" />
                </div>
                <div className="flex-1 w-full flex flex-col items-start gap-y-2xl">
                  <p className="font-machina text-display-xs lg:text-display-md leading-tight tracking-tight">
                    {item.quote}
                  </p>
                  <div className="flex flex-col lg:flex-row items-start lg:items-center justify-start lg:justify-between w-full gap-4">
                    <div className="testimony-name">
                      <p className="text-lg font-semibold">
                        {item.name}
                      </p>
                      <p className="text-md font-regular text-brand-700 dark:text-tertiary_on-brand">
                        {item.title}
                      </p>
                    </div>
                    <div className="flex items-end gap-4">
                      <p className="font-machina text-display-lg font-semibold leading-none">
                        {item.saving}
                      </p>
                      <span className="text-md text-tertiary_on-brand">
                        {item.savingPeriod}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Dots/Indicators */}
      <div className="px-8 md:px-[64px] lg:px-[104px] py-4xl flex items-center justify-start lg:justify-center gap-x-lg">
        {TESTIMONIES.map((_, testimonyIndex) => (
          <div
            key={testimonyIndex}
            className={`w-4 h-4 cursor-pointer ${
              testimonyIndex === current
                ? "bg-brand-accent dark:bg-white"
                : "bg-quaternary"
            } rounded-full`}
            onClick={() => setCurrent(testimonyIndex)}
          ></div>
        ))}
      </div>

      {/* <section className="hidden md:block py-4xl text-primary w-full">
      {TESTIMONIES.map((item, index) => index === current ? (
        <div className="container max-w-[1344px] mx-auto px-[104px]">
          <div className="flex items-center gap-x-7xl">
            <div className="flex-none image-block w-[224px] h-[224px]">
              <img src={item.image} alt="testimony-image" />
            </div>
            <div className="flex-1 w-full flex flex-col gap-y-2xl">
              <p className="font-machina text-display-md text-primary_on-brand leading-tight tracking-tight">
                {item.quote}
              </p>
              <div className="flex items-center justify-between">
                <div className="testimony-name">
                  <p className="text-lg font-semibold text-primary_on-brand">
                    {item.name}
                  </p>
                  <p className="text-md font-regular text-tertiary_on-brand">
                    {item.title}
                  </p>
                </div>
                <div className="flex items-end gap-4">
                  <p className="font-machina text-display-lg font-semibold text-primary_on-brand leading-none">
                    {item.saving}
                  </p>
                  <span className="text-md text-tertiary_on-brand">
                    {item.savingPeriod}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        null
      ))}
      <div className="py-4xl flex items-center justify-center gap-x-lg">
         {TESTIMONIES.map((item, testimonyIndex) => (
            <div key={testimonyIndex} className={`w-4 h-4 cursor-pointer ${testimonyIndex === current ? 'bg-primary' : 'bg-quaternary'} rounded-full`}
                onClick={() => setCurrent(testimonyIndex)}
            ></div>
         ))}
      </div>
    </section> */}
    </section>
  );
}
