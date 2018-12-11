import fetch from 'node-fetch';

// Fix Elm not finding XMLHttpRequest.
import XMLHttpRequest from 'xhr2';
global['XMLHttpRequest'] = XMLHttpRequest;

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

export async function startPolling(unverifiedToken: string, BotElm) {
    const { token, handleUpdate } = await setupBot(unverifiedToken, BotElm);
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

    console.log('Bot starting.')
    let offset = 0;

    while (true) {
        console.log(`\nFetching updates starting with id ${offset}...`);
        const res = await fetch(
            method('getUpdates'),
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ offset }),
            }
        );
        const json = await res.json();
        if (json.ok) {
            const updates = json.result;
            console.log('\nReceived updates:');
            console.log(JSON.stringify(updates, undefined, 2));

            const newOffset = await handleUpdates(updates);
            offset = newOffset ? newOffset : offset;

            await new Promise(resolve => {
                const delay = 0;
                setTimeout(resolve, delay);
            });
        } else {
            console.error('Error fetching updates:');
            console.error(json.description);
            process.exit(2);
        }
    }

    async function handleUpdates(updates) {
        const ids = updates.map(update => {
            handleUpdate(update);
            return update.update_id;
        })

        if (ids.length) {
            return ids[ids.length - 1] + 1;
        } else {
            return null;
        }
    }
}

export async function setupBot(unverifiedToken: string, BotElm): Promise<{ token: string, handleUpdate }> {
    // SETUP TOKEN
    console.log('Checking token...')
    const { user, token } = await verifyToken(unverifiedToken);
    console.log(`Token valid for bot '${user.first_name}'.`)
    const baseUrl = getBaseUrl(token);

    // SETUP ELM
    // Fill in undefined fields with null to help Elm detect them
    // and prevent it from crashing.
    user.last_name = user.last_name || null;
    user.username = user.username || null;
    user.language_code = user.language_code || null;

    const bot = BotElm.Elm.Main.init({
        flags: user
    });
    bot.ports.errorPort.subscribe(function (errorMessage: string) {
        console.error(errorMessage);
    });
    bot.ports.methodPort.subscribe(function (methods: Array<{ method: string, content }>) {
        methods.reduce(async (promise, method) => {
            await promise;

            switch (method.method) {
                case "sendMessage":
                    return sendMessage(method.content);
                case "answerInlineQuery":
                    return answerInlineQuery(method.content);
                case "answerCallbackQuery":
                    return answerCallbackQuery(method.content);
            }

        }, Promise.resolve());
    });

    function nullToUndefined(object, field: string) {
        object[field] = object[field] == null ? undefined : object[field];
        return object;
    }

    async function sendMessage(sendMessage) {
        [
            "parse_mode",
            "reply_to_message_id",
            "reply_markup"
        ].forEach(field => {
            nullToUndefined(sendMessage, field);
        })

        const res = await fetch(
            baseUrl + 'sendMessage',
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(sendMessage),
            }
        );
        const json = await res.json();
        if (!json.ok) {
            console.error('\nSending message failed. Wanted to send:');
            console.error(JSON.stringify(sendMessage, undefined, 2));
            console.error('Received error:');
            console.error(JSON.stringify(json, undefined, 2));
        } else {
            console.log('\nSuccessfully sent message:');
            console.log(JSON.stringify(sendMessage, undefined, 2));
        }
    }

    async function answerInlineQuery(inlineQuery) {
        ["cache_time", "is_personal", "next_offset"].forEach(field => {
            nullToUndefined(inlineQuery, field);
        })
        inlineQuery.results.forEach(result => {
            if (result.type == "article") {
                [
                    "description",
                    "url",
                    "hide_url",
                    "thumb_url",
                    "thumb_width",
                    "thumb_height",
                    "reply_markup"
                ].forEach(field => {
                    nullToUndefined(result, field);
                });

                if (result.input_message_content &&
                    result.input_message_content.parse_mode == null) {
                    result.input_message_content.parse_mode = undefined;
                }
            }
        });

        const res = await fetch(
            baseUrl + 'answerInlineQuery',
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(inlineQuery),
            }
        );
        const json = await res.json();
        if (!json.ok) {
            console.error('\nAnswering inline query failed. Wanted to send:');
            console.error(JSON.stringify(inlineQuery, undefined, 2));
            console.error('Received error:');
            console.error(JSON.stringify(json, undefined, 2));
        } else {
            console.log('\nSuccessfully answered inline query:');
            console.log(JSON.stringify(inlineQuery, undefined, 2));
        }
    }

    async function answerCallbackQuery(callbackQuery) {
        [
            "text",
            "url"
        ].forEach(field => {
            nullToUndefined(callbackQuery, field);
        })

        const res = await fetch(
            baseUrl + 'answerCallbackQuery',
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(callbackQuery),
            }
        );
        const json = await res.json();
        if (!json.ok) {
            console.error('\nAnswering callback query failed. Wanted to send:');
            console.error(JSON.stringify(callbackQuery, undefined, 2));
            console.error('Received error:');
            console.error(JSON.stringify(json, undefined, 2));
        } else {
            console.log('\nSuccessfully answered callback query:');
            console.log(JSON.stringify(callbackQuery, undefined, 2));
        }
    }

    return { token, handleUpdate: bot.ports.incomingUpdatePort.send };
}

async function verifyToken(token: string): Promise<{ user, token: string }> {
    if (!token) {
        cancelWithError("The provided token was empty. Please provide a valid Telegram bot token.");
    }
    const res = await fetch(getBaseUrl(token) + 'getMe');
    const json = await res.json();
    if (!json.ok) {
        cancelWithError(json.description, token);
        throw new Error("Error verifying token.")
    } else {
        const user = json.result;
        return { user, token }
    }

    function cancelWithError(error: string, token?: string) {
        console.error(`Could not verify the token${token ? " '" + token + "'" : ''}.`);
        console.error('Explanation:');
        console.error(error);
    }
}

function getBaseUrl(token: string): string {
    return `https://api.telegram.org/bot${token}/`;
}

function getMethodUrl(token: string, method: string) {
    return getBaseUrl(token) + method;
}