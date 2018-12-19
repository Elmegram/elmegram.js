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
    function method(method: string): string {
        return getMethodUrl(token, method);
    }

    // RUN
    console.log('Deleting potential webhook.')
    const res = await fetch(method('deleteWebhook'));
    const json = await res.json();
    if (!json.ok || !json.result) {
        console.error('Error deleting webhook:');
        console.error(json.description);
    }

    console.log('Bot started.')
}

export async function setupBot(token: string, BotElm) {
    const bot = BotElm.Elm.Main.init({
        flags: { token }
    });
    bot.ports.errorPort.subscribe(function (errorMessage: string) {
        console.error(errorMessage);
    });
}

function getBaseUrl(token: string): string {
    return `https://api.telegram.org/bot${token}/`;
}

function getMethodUrl(token: string, method: string) {
    return getBaseUrl(token) + method;
}