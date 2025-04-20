import { Writable } from 'node:stream';
import pc from "picocolors";


export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'none'
type LogStyle = 'default' | 'input' | 'success' | 'failure' | 'important' | 'warning'
export class Logger {

    private stream: Writable;

    private logLevel: number;

    constructor(stream: Writable, config?: {
        indentLevel?: number;
        logLevel?: LogLevel
    }) {
        this.stream = stream;
        this.logLevel = this.levelToNum(config?.logLevel ?? 'info')
    }


    public log(
        message: string | string[],
        config?: {
            level?: LogLevel,
            style?: LogStyle,
            indentLevel?: number
            newline?: boolean
            trailingNewlines?: number;
            leadingNewlines?: number;
        }
    ) {
        const {
            style,
            newline = true,
            indentLevel = 0,
            trailingNewlines = 0,
            leadingNewlines = 0
        } = config ?? {};

        const level = config?.level ?? (style === "failure" ? "error" : style === "warning" ? "warn" : "info")
        const actualStyle = style ?? (level === "error" ? "failure" : level === "warn" ? "warning" : "default")

        // Omit logs below the configured log level
        const messageLogLevel = this.levelToNum(level)
        if (messageLogLevel > this.logLevel || messageLogLevel === 0) {
            return this
        }

        const styleWrapper = this.getStyleWrapper(actualStyle)
        const stringifiedMessage = typeof message === "string" ? message : message.join("\n")
        const formattedMessage = stringifiedMessage.replace(/\n/g, "\n" + "".repeat(indentLevel));
        this.stream.write(
            "\n".repeat(leadingNewlines) + 
            "  ".repeat(indentLevel) +
            styleWrapper(formattedMessage) +
            (newline ? "\n" : "") +
            "\n".repeat(trailingNewlines)
        )
        return this
    }


    public progressMessage(
        inProgressMessage: string,
        config?: {
        successMessage?: string,
        failureMessage?: string,
        finishMessage?: string;
        interval?: number;
        level?: LogLevel;
        style?: LogStyle;
        indentLevel?: number;
      }) {
        const {interval, finishMessage, failureMessage, successMessage,  ...rest} = config ?? {}
        let dots = 0;
        this.log(inProgressMessage, rest);
        const timer =  globalThis.setInterval(() => {
          dots = (dots + 1) % 5;
          const progressText = `${inProgressMessage}${".".repeat(dots)}${" ".repeat(5 - dots)}`;
          this.log(`\r${progressText}`, rest);
        }, interval);

        return (success: boolean = true) => {
            globalThis.clearInterval(timer);
            if(success){
                if(finishMessage || successMessage){
                    this.log("\r" + (successMessage ?? finishMessage) + " ".repeat(25), {
                        ...rest,
                        style: "success"
                    })
                }
            } else {
                if(finishMessage || failureMessage){
                    this.log("\r" + (failureMessage ?? finishMessage) + " ".repeat(25), {
                        ...rest,
                        style: "failure"
                    })
                }
            }

        }
      }

      public crashMessage() {
        this.log([
            "If you need assistance, connect with us on our discord server: https://discord.gg/MJQ3WHktAS",
            "If you think you've found a bug, please submit an issue: https://github.com/panfactum/stack/issues"
        ],
            {
                leadingNewlines: 1,
                level: "error"
            }
        )
      }

      public showLogo(){
        this.log(
            `
            ██████╗  █████╗ ███╗   ██╗███████╗ █████╗  ██████╗████████╗██╗   ██╗███╗   ███╗
            ██╔══██╗██╔══██╗████╗  ██║██╔════╝██╔══██╗██╔════╝╚══██╔══╝██║   ██║████╗ ████║
            ██████╔╝███████║██╔██╗ ██║█████╗  ███████║██║        ██║   ██║   ██║██╔████╔██║
            ██╔═══╝ ██╔══██║██║╚██╗██║██╔══╝  ██╔══██║██║        ██║   ██║   ██║██║╚██╔╝██║
            ██║     ██║  ██║██║ ╚████║██║     ██║  ██║╚██████╗   ██║   ╚██████╔╝██║ ╚═╝ ██║
            ╚═╝     ╚═╝  ╚═╝╚═╝  ╚═══╝╚═╝     ╚═╝  ╚═╝ ╚═════╝   ╚═╝    ╚═════╝ ╚═╝     ╚═╝
            `,
            {
                style: "important"
            }
        )
      }

      public clusterInstallSuccess(){
        this.log((
            pc.green(
              "\n🎉 Congrats! You've successfully deployed a Kubernetes cluster using Panfactum! 🎉\n\n"
            ) +
              pc.blue(
                "Run: " +
                  pc.bold(pc.cyan("kubectl cluster-info\n\n")) +
                  "You should receive a response similar to the following:\n\n"
              ) +
              "Kubernetes control plane is running at https://99DF0D231CAEFBDA815F2D8F26575FB6.gr7.us-east-2.eks.amazonaws.com\n" +
              "CoreDNS is running at https://99DF0D231CAEFBDA815F2D8F26575FB6.gr7.us-east-2.eks.amazonaws.com/api/v1/namespaces/kube-system/services/kube-dns:dns/proxy\n\n" +
              pc.blue(
                "The Panfactum devShell ships with a TUI called k9s.\n" +
                  "To verify what pods are running in the cluster do the following:\n" +
                  `1. Run ${pc.bold(pc.cyan("k9s"))}.\n` +
                  `2. Type ${pc.bold(pc.cyan("':pods⏎'"))} to list all the pods in the cluster.\n` +
                  `3. k9s will filter results by namespace and by default it is set to the default namespace. Press ${pc.bold(pc.cyan("'0'"))} to switch the filter to all namespaces.\n` +
                  `4. You should see a minimal list of pods running in the cluster\n` +
                  `5. If you don't see any pods, please reach out to us on Discord\n` +
                  `6. Type ${pc.bold(pc.cyan("':exit⏎'"))} when ready to exit k9s.\n\n`
              )
          ))
      }
      

    private levelToNum(level: LogLevel) {
        switch (level) {
            case 'debug':
                return 4
            case 'info':
                return 3
            case 'warn':
                return 2
            case 'error':
                return 1
            case 'none':
                return 0
        }
    }



    private getStyleWrapper(style: LogStyle) {
        switch (style) {
            case 'input':
                return pc.yellow
            case 'success':
                return pc.green
            case 'failure':
                return pc.red
            case 'important':
                return (text: string) => pc.blue(pc.bold(text))
            default:
                return (text: string) => text
        }
    }
}