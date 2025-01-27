"use client";

import {Tooltip} from "react-tooltip";
import type {ReactNode} from "react";


interface TooltipProps {
  id: string;
  children: string | ReactNode | ReactNode[]
}
export default function CustomTooltip ({id, children}: TooltipProps ) {
  return (
    <Tooltip id={id} openOnClick={window.innerWidth < 600} className={"react-tooltip"}>
        {children}
    </Tooltip>
  )
}

