import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { fileExists } from "./fileExists";
import { CLIError } from "../error/error";
import type { PanfactumContext } from "@/context/context";

/**
 * Checks if a file contains any line that matches the provided regex pattern
 */
export const fileContains = async (inputs: {
  context?: PanfactumContext, 
  filePath: string, 
  regex: RegExp,
  throwIfMissing?: boolean
}): Promise<boolean> => {
  const {filePath, regex, throwIfMissing} = inputs;

  if(!await fileExists(filePath)){
    if(throwIfMissing){
      throw new CLIError(`Cannot run fileContains on nonexistent file ${filePath}`);
    } else {
      return false;
    }
  }
  
  try {
    // Create a readable stream for the file
    const fileStream = createReadStream(filePath);
    
    // Create a readline interface for processing line by line
    const rl = createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });
    
    // Process each line
    for await (const line of rl) {
      if (regex.test(line)) {
        rl.close();
        fileStream.close();
        return true;
      }
    }
    
    return false;
  } catch (e) {
    throw new CLIError(`Error checking if file ${filePath} contains pattern`, e);
  }
};
