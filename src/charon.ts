import { AsyncResult, AsyncStatus, Err, Ok, Result, Success } from "./util";

export class CharonClient {
    apiKey: string;

    constructor (apiKey: string) {
        this.apiKey = apiKey;
    }

    async charonInvite(ip: string, email: string, channels?: string[]): AsyncStatus {
        const resp = await fetch("https://charon.hackclub.com/user/invite", {
            method: "POST",
            body: JSON.stringify({ ip, email, channels })
        });

        if (!resp.ok) {
            // TODO: Non-JSON error responses will be replaced in a future update of Cheron.
            try {
                const body = await resp.json();
                if (typeof body == "string")
                    return new Err(body);

                if (typeof body == "object")
                    return new Err(body.detail ?? body.error ?? resp.statusText);

                return new Err(resp.statusText);
            } 
            catch (err) {
                if (!(err instanceof SyntaxError)) {
                    throw err;
                }
            }

            return new Err(await resp.text())
        }

        return new Success();
    }
}
