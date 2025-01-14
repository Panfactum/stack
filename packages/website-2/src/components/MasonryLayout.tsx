import Isotope from "isotope-layout";
import { useEffect, useRef, useState } from "react";
import "./MasonryLayout.css";

function MasonryLayout(): React.ReactNode {
  const isotopeRef = useRef();

  const [gridList, setGridList] = useState<{ id: number }[]>(
    Array.from({ length: 100 }, (_, i) => ({
      id: i,
      active: false,
    })),
  );
  const [grid, setGrid] = useState<any>(null);

  const activateItem = (itemId: number) => {
    console.log("activateItem item", itemId);
    const payload = gridList.map((item) => {
      if (item.id === itemId) {
        return {
          ...item,
          active: true,
        };
      } else {
        return {
          ...item,
          active: false,
        };
      }
    });
    setGridList((pv) => payload);
  };

  useEffect(() => {
    if (isotopeRef.current) {
      const isotope = new Isotope(isotopeRef.current, {
        itemSelector: ".grid-item",
        layoutMode: "fitRows", // or other layout modes
      });

      return () => isotope.destroy();
    }
  }, []);

  return (
    <div className="main-masonry-container block h-[500px] max-w-[700px] w-full">
      <div className="masonry-container grid grid-cols-12">
        {gridList.map((item, i) => (
          <div
            className={`flex-none grid-item flex items-center justify-center text-black cursor-pointer ${item.active ? "is-expanded" : ""}`}
            key={`grid-item-${item.id}`}
            onClick={() => activateItem(item.id)}
          >
            {item.id}
          </div>
        ))}
      </div>
    </div>
  );
}

export default MasonryLayout;
