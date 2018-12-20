import fetch from 'node-fetch';
import * as Path from 'path'

// Fix Elm not finding XMLHttpRequest.
global['XMLHttpRequest'] = require('xhr2')

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

export async function startPolling(token: string, botPath: string) {
    const BotElm = require(Path.resolve(botPath))
    await setupBot(token, BotElm);
}

export async function setupBot(token: string, BotElm) {
    const bot = BotElm.Elm.Main.init({
        flags: { token }
    });
    bot.ports.consolePort.subscribe(function (log: { level: string, message: string }) {
        console[log.level](log.message);
    });
}

function getMethodUrl(token: string, method: string) {
    return getBaseUrl(token) + method;
}

function getBaseUrl(token: string): string {
    return `https://api.telegram.org/bot${token}/`;
}
