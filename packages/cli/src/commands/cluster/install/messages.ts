import { CLIError } from "@/util/error/error";
import type { PanfactumContext } from "@/context/context";

const TOTAL_STEPS = 13

export function informStepComplete(
    context: PanfactumContext,
    stepLabel: string,
    stepNum: number,
    subStepNum?: number,
) {
    if(subStepNum){
        context.logger.log(`${stepNum}.${numberToLetter(subStepNum)} ${stepLabel} already complete. Skipping.`, {indentLevel: 1})
    } else {
        context.logger.log(`${stepNum}/${TOTAL_STEPS} ${stepLabel} already deployed. Skipping.`)
    }
}

export function informStepStart(
    context: PanfactumContext,
    stepLabel: string,
    stepNum: number,
    subStepNum?: number
) {
    if(subStepNum){
        context.logger.log(`${stepNum}.${numberToLetter(subStepNum)} ${stepLabel}`, {indentLevel: 1})

    } else {
        context.logger.log(`${stepNum}/${TOTAL_STEPS} Deploying the ${stepLabel}`)
    }
}

export function numberToLetter(num: number): string {
  // Ensure the number is within valid range (1-26)
  if (num < 1 || num > 26) {
    throw new CLIError(`Number ${num} is out of range for letter conversion (must be 1-26)`);
  }
  
  // Convert to 0-based index for calculation, then get corresponding ASCII character
  return String.fromCharCode(96 + num);
}