import { Writable } from 'node:stream';
import pc from "picocolors";


type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'none'
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