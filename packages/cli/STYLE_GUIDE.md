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

## TSDoc Rules

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
  <summary>Bad:Do not use `Error` to throw errors</summary>
  ```typescript
  throw new Error('User-friendly message');
  ```
  </details>

## Data Handling

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
