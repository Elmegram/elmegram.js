import fetch from 'node-fetch';
import * as Path from 'path'
import * as ElmCompiler from 'node-elm-compiler'

// Fix Elm not finding XMLHttpRequest.
global['XMLHttpRequest'] = require('xhr2')

export async function startPolling(token: string, botPath: string) {
    const compiled = await BotCompiler.compile(PollingBot, Path.resolve(botPath));
    const bot = compiled.start(token);
    bot.onConsole(function (log: { level: string, message: string }) {
        console[log.level](log.message);
    });
}

interface ReceivingPort {
    subscribe: Function,
    unsubsribe: Function,
}
interface SendingPort {
    send: Function
}

export interface Log {
    level: string,
    message: string,
}

export interface SendMessage {
    methodName: string,
    content: object,
}

export interface IncomingUpdate {
    update_id: number,
}

export class BotCompiler<Bot> {
    private constructor(
        private botElm: {
            Elm: { Main: { init: Function } }
        },
        private mainModuleName: string,
        private botConstructor: new (bot: any) => Bot
    ) { }

    public static async compile<Bot>(botConstructor: new (bot: any) => Bot, sourcePath: string, dev: boolean = false, ): Promise<BotCompiler<Bot>> {
        const compiledPath = Path.resolve(__dirname, "../compiled/bot.js")
        await compile(compiledPath, sourcePath, dev);
        const mainModuleName = Path.basename(sourcePath, ".elm");
        const bot = require(compiledPath);
        return new BotCompiler(bot, mainModuleName, botConstructor);
    }

    public start(token: string): Bot {
        const bot = this.botElm.Elm[this.mainModuleName].init({
            flags: { token }
        });
        return new this.botConstructor(bot);
    }
}

export class CustomBot {
    public constructor(
        private bot: {
            ports: {
                consolePort: ReceivingPort,
                sendMessagePort: ReceivingPort,
                incomingUpdatePort: SendingPort,
            }
        },
    ) { }

    public onConsole(callback: (log: Log) => void) {
        this.bot.ports.consolePort.subscribe(callback);
    }

    public onSendMessage(callback: (toSend: SendMessage) => void) {
        this.bot.ports.sendMessagePort.subscribe(callback);
    }

    public sendUpdates(updates: IncomingUpdate[]) {
        this.bot.ports.incomingUpdatePort.send(updates);
    }
}

export class PollingBot {
    public constructor(
        private bot: {
            ports: {
                consolePort: ReceivingPort,
            }
        },
    ) { }

    public onConsole(callback: (log: Log) => void) {
        this.bot.ports.consolePort.subscribe(callback);
    }
}

async function compile(targetPath: string, src: string, dev: boolean): Promise<string> {
    const shouldOptimize = !dev;
    return new Promise((resolve, reject) => {
        ElmCompiler.compile([src], { output: targetPath, optimize: shouldOptimize })
            .on('close', (exitCode: number) => {
                if (exitCode == 0) {
                    resolve()
                } else {
                    reject()
                }
            })
    })
}

export async function setupWebhook(token: string, url: string) {
    await fetch(
        getMethodUrl(token, 'setWebhook')
        , {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                url
            })
        }
    );
}

function getMethodUrl(token: string, method: string) {
    return getBaseUrl(token) + method;
}

function getBaseUrl(token: string): string {
    return `https://api.telegram.org/bot${token}/`;
}
