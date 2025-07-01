# Style Guide

## General Typescript Rules

- Typescript interfaces MUST start with `I` for example `IExecuteInputs`.

- **ALWAYS create interfaces for input objects and returned objects.** This makes refactoring and AI-driven development much easier.

  <details>
  <summary>Good</summary>
    ```tsx
    interface IFooInput {
      baz: string;
    }

    interface IFooOutput {
      bar: string;
    }

    function foo(input: IFooInput): IFooOutput {
      return { bar: input.baz }
    }
    ```
  </details>

  <details>
  <summary>Bad: Do not define inline interfaces</summary>
  ```tsx
  function foo(input: {baz: string}): {bar: string} {
    return {bar: input.baz}
  }
  ```
  </details>

- In Bun, there are certain global methods and objects that only have typings available under the `globalThis` object and will not compile properly if you access them directly.
  For example, use `globalThis.fetch` instead of `fetch`. **The following global methods MUST use `globalThis`**:
  - `fetch`
  - `setTimeout`
  - `clearTimeout`
  - `setInterval`
  - `clearInterval`
  - `Request`
  - `ReadableStream`
  - `Blob`


## TSDoc Rules

- **ALWAYS update the TSDOC comments** when making updates to the relevant code.

- TSDOC comments should have the following content:

  <details>
  <summary>Good: Exported Function</summary>
  ```tsx
  /**
  * Interface for input parameters to the example function
  */
  interface IExampleFunctionInput {
    /** The name to process */
    name: string;
    /** Optional age parameter */
    age?: number;
    /** Configuration options */
    options: {
      /** Whether to enable verbose mode */
      verbose: boolean;
      /** Maximum retry attempts */
      maxRetries: number;
    };
  }

  /**
  * Interface for the output of the example function
  */
  interface IExampleFunctionOutput {
    /** The processed result */
    result: string;
    /** Whether the operation was successful */
    success: boolean;
    /** Optional error message if operation failed */
    error?: string;
  }

  /**
  * Example function demonstrating proper TSDoc formatting according to Panfactum standards
  * 
  * @remarks
  * This function is part of the utility subsystem and demonstrates best practices
  * for documenting TypeScript functions in the Panfactum CLI.
  * 
  * @param input - The input parameters for the function. See {@link IExampleFunctionInput}
  * @returns The processed output with success status. See {@link IExampleFunctionOutput}
  * 
  * @example
  * ```typescript
  * const result = await exampleFunction({
  *   name: "John Doe",
  *   age: 30,
  *   options: {
  *     verbose: true,
  *     maxRetries: 3
  *   }
  * });
  * console.log(result.result); // "Processed: John Doe"
  * ```
  * 
  * @throws {@link CLIError}
  * Throws when the name is empty or invalid
  * 
  * @throws {@link CLISubprocessError}
  * Throws when the subprocess execution fails
  * 
  * @see {@link anotherRelatedFunction} - For additional processing options
  */
  export async function exampleFunction(input: IExampleFunctionInput): Promise<IExampleFunctionOutput> {
    // Implementation would go here
    return {
      result: `Processed: ${input.name}`,
      success: true
    };
  }
  ```
  </details>

  <details>
  <summary>Good: Internal Function</summary>
  ```tsx
  /**
  * Example internal utility function with lighter documentation
  * 
  * @internal
  * @param str - The string to validate
  * @returns True if the string is valid
  */
  function isValidString(str: string): boolean {
    return str.length > 0 && str.trim() !== '';
  }
  ```
  </details>


  <details>
  <summary>Good: Zod Schema</summary>
  ```tsx
  import { z } from 'zod';

  /**
  * Schema for validating user input data
  * 
  * @remarks
  * This schema validates user information including name, email, and age.
  * It's used primarily for API request validation and configuration parsing.
  * 
  * @example
  * ```typescript
  * const userData = UserSchema.parse({
  *   name: "John Doe",
  *   email: "john@example.com",
  *   age: 30
  * });
  * ```
  */
  export const UserSchema = z.object({
    /** User's full name - must be at least 2 characters */
    name: z.string().min(2).describe("User's full name"),
    
    /** Valid email address */
    email: z.string().email().describe("User's email address"),
    
    /** Age must be 18 or older */
    age: z.number().min(18).optional().describe("User's age (optional)")
  }).describe("Schema for user information validation");
  ```
  </details>

  <details>
  <summary>Good: Class</summary>
  ```tsx
  /**
  * Example class with TSDoc documentation
  */
  export class ExampleProcessor {
    /**
    * Creates a new instance of ExampleProcessor
    * 
    * @param config - Configuration options for the processor
    */
    constructor(private config: IExampleProcessorConfig) {}

    /**
    * Processes the given data according to the configured rules
    * 
    * @param data - The data to process
    * @returns The processed result
    * 
    * @throws {@link CLIError}
    * Throws when data validation fails
    */
    public async process(data: unknown): Promise<IProcessResult> {
      // Implementation
      return { success: true };
    }

    /**
    * Internal helper method with lighter documentation
    * 
    * @internal
    */
    private validateData(data: unknown): boolean {
      return true;
    }
  }

  /**
  * Interface for processor configuration
  */
  interface IExampleProcessorConfig {
    /** Processing mode */
    mode: 'strict' | 'lenient';
    /** Timeout in milliseconds */
    timeout: number;
  }

  /**
  * Interface for process result
  */
  interface IProcessResult {
    /** Whether processing was successful */
    success: boolean;
    /** Optional error details */
    error?: string;
  }
  ```
  </details>


- When writing TSDoc comments, ensure that `@throws` statements use the following format:

  <details>
  <summary>Good</summary>
  ```tsx
  /**
   * @throws {@link FooError}
   * Throws a FooError
   */
  ```
  </details>

  <details>
  <summary>Bad: Missing `@link`</summary>
  ```tsx
  /**
   * @throws {@link FooError}
   * Throws a FooError
   */
  ```
  </details>


  <details>
  <summary>Bad: Missing reference</summary>
  ```tsx
  /**
   * @throws {@link FooError}
   * Throws a FooError
   */
  ```
  </details>

## CLI Rules

- **NEVER** use `Error`. Always use one of our custom error classes defined in `packages/cli/src/util/error/error.ts` such as `CLIError`.

  <details>
  <summary>Good: Use `CLIError` to throw errors</summary>
  ```typescript
  throw new CLIError('User-friendly message', { 
    cause: originalError 
  });
  ```
  </details>


  <details>
  <summary>Bad: Do not use `Error` to throw errors</summary>
  ```typescript
  throw new Error('User-friendly message');
  ```
  </details>

- **All logging MUST be done through the methods on `PanfactumContext.logger`** to ensure that the terminal output is properly formatted and the log hooks
  are executed. This includes submitting user prompts; **NEVER use the inquirer prompt methods directly** as they are made available through `PanfactumContext.logger` methods.

  <details>
  <summary>Good: Example of proper error message logging</summary>
  ```typescript
  context.logger.error(`
      The AWS profile ${DEFAULT_MANAGEMENT_PROFILE} in ${awsConfigFile}
      does not appear to be associated with a real IAM user.

      Please connect the profile to an IAM user with the AdministratorAccess policy directly attached.
  `, { highlights: [DEFAULT_MANAGEMENT_PROFILE, awsConfigFile] })
  ```
  </details>

  <details>
  <summary>Good: Example of user prompt</summary>
  ```typescript
  await context.logger.select({
    explainer: `
        Do you have existing AWS accounts managed by an AWS Organization?
        
        If you aren't sure, see these docs: https://docs.aws.amazon.com/organizations/latest/userguide/orgs_introduction.html
    `,
    message: "Already using an AWS Organization?",
    choices: [
      {
        name: "Yes",
        description: "You have existing accounts managed by an AWS Organization.",
        value: true,
      },
      {
        name: "No",
        description: "You do not have existing accounts or they are not managed by an AWS Organization.",
        value: false,
      }
    ],
    default: true,
  });
  ```
  </details>


  <details>
  <summary>Bad: Do not use console.log</summary>
  ```typescript
  console.log('Some message');
  ```
  </details>

    <details>
  <summary>Bad: Do not use inquirer directly</summary>
  ```typescript
  import { select } from "@inquirer/prompts";

  await select({
    message: "Already using an AWS Organization?",
    choices: [
      {
        name: "Yes",
        description: "You have existing accounts managed by an AWS Organization.",
        value: true,
      },
      {
        name: "No",
        description: "You do not have existing accounts or they are not managed by an AWS Organization.",
        value: false,
      }
    ],
    default: true,
  });
  ```
  </details>


## Data Handling

### Validation

- **ALWAYS use Zod schema validation for all external input and output**, especially when using `execute` to call external scripts
  like `kubect`. This ensures type safety and data integrity throughout the CLI:

  <details>
  <summary>Good</summary>
  ```typescript
  import { z } from 'zod';

  // Create the schema (or import it if it is a standard schema)
  const KubectlOutputSchema = z.object({
    metadata: z.object({
      name: z.string(),
      namespace: z.string()
    })
  });

  // Validate external command output
  const result = await execute('kubectl', ['get', 'pod', '-o', 'json']);
  const validated = KubectlOutputSchema.parse(JSON.parse(result.stdout));
  ```
  </details>

### File Reading / Writing

#### YAML

- **ALWAYS use the utilities in `packages/cli/src/util/yaml` to read and write from YAML files**.

- **YAML keys written to files must be in snake_case**, not camelCase. However, they can transformed to camelCase when used inside the CLI functions.

#### SOPS-encrypted Files

- **ALWAYS use the utilities in `packages/cli/src/util/sops` to read and write from sops-encrypted files**.

#### Other

- Unless a format-specific alternative exists (e.g., yaml files, etc.), **ALWAYS use the utilities in `packages/cli/src/util/fs` for filesystem operations**
  instead of using the Bun APIs directly. We include very specific error and logging logic that we want to run at every IO boundary.


## Subprocess Execution

- **NEVER use `spawn`, `exec`, or `execSync` from Bun.** **ALWAYS use the `execute` utility** from `packages/clisrc/util/subprocess/execute.ts`.
  This provides:
  - Consistent error handling with `CLISubprocessError`
  - Proper logging and debug output
  - Retry capabilities with configurable delays
  - Stream handling for real-time output processing
  - Standardized environment variable handling

  <details>
  <summary>Good</summary>
  ```typescript
  import { execute } from '@/util/subprocess/execute';

  const result = await execute({
    command: ['vault', 'token', 'lookup', '-format=json'],
    context,
    workingDirectory: process.cwd()
  });
  ```
  </details>


  <details>
  <summary>Bad: Never use these</summary>
  ```typescript
  execSync('vault token lookup -format=json');
  spawn('vault', ['token', 'lookup']);
  exec('vault token lookup');
  ```
  </details>


## AWS 

- **ALWAYS prefer AWS SDK over AWS CLI when possible**. Use direct API calls instead of CLI execution for most AWS operations:

  <details>
  <summary>Good</summary>
  ```typescript
  import { getSTSClient } from '@/util/aws/clients/getSTSClient';

  // Good: Use AWS SDK
  const stsClient = getSTSClient({ profile: 'my-profile' });
  const identity = await stsClient.send(new GetCallerIdentityCommand({}));
  ```
  </details>

  <details>
  <summary>Bad: Uses `aws` CLI</summary>
  ```typescript
    const result = await execute({
      command: ['aws', 'sts', 'get-caller-identity'],
      context
    });
  ```
  </details>

- **ALWAYS use the client generators in `packages/cli/src/util/aws/clients` to create clients**. This ensures that credentials
  are properly loaded in a standard way and avoids race conditions.

  <details>
  <summary>Good</summary>
  ```typescript
  import { UpdateAutoScalingGroupCommand } from "@aws-sdk/client-auto-scaling";
  import { getAutoScalingClient } from "@util/aws/clients/getAutoScalingClient";
  import type { PanfactumContext } from "@/util/context/context";

  interface IScaleASGInput {
    context: PanfactumContext;
    awsProfile: string;
  }

  export async function scaleASG(input: IScaleASGInput) {
    const client = await getAutoScalingClient({ 
      context: input.context, 
      profile: input.awsProfile, 
    });
    await client.send(new UpdateAutoScalingGroupCommand({AutoScalingGroupName: "foo", DesiredCapacity: 20 })));
  }
  ```
  </details>

  <details>
  <summary>Bad: Creates the client directly</summary>
  ```typescript
  import { UpdateAutoScalingGroupCommand, AutoScalingClient } from "@aws-sdk/client-auto-scaling";
  import { getAutoScalingClient } from "@util/aws/clients/getAutoScalingClient";
  import type { PanfactumContext } from "@/util/context/context";

  interface IScaleASGInput {
    context: PanfactumContext;
    awsProfile: string;
  }

  export async function scaleASG(input: IScaleASGInput) {
    const client = new AutoScalingClient({
      profile: input.awsProfile
    });
    await client.send(new UpdateAutoScalingGroupCommand({AutoScalingGroupName: "foo", DesiredCapacity: 20 })));
  }
  ```
  </details>
