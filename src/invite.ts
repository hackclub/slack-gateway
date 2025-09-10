import { AsyncStatus, Err, logError, logInfo, Success } from "./util";

interface SlackSecrets {
    botToken: string;
    userToken: string;
    cookie: string;
}

export async function inviteSlack(
    secrets: SlackSecrets,
    channels: string[],
    email: string
): AsyncStatus {
    logInfo(`invitation request received for ${email}!`);

    const lookupResponse = await fetch(
        `https://slack.com/api/users.lookupByEmail?email=${encodeURIComponent(email)}`,
        {
            method: "GET",
            headers: {
                Authorization: `Bearer ${secrets.botToken}`,
            },
        }
    );

    const lookupResult = await lookupResponse.json();
    if (lookupResult.ok && lookupResult.user) {
        const user = lookupResult.user;
        logInfo(`user already exists! id=${user.id}, name=${user.name}`);
        return new Err("A user already exists with that e-mail address.");
    }

    logInfo(`inviting ${email} to channels: ${channels.join(', ')}`);

    const headers = new Headers();
    headers.append('Cookie', secrets.cookie);
    headers.append('Content-Type', 'application/json');
    headers.append('Authorization', `Bearer ${secrets.userToken}`);

    const data = JSON.stringify({
        token: secrets.userToken,
        invites: [
            {
                email,
                type: 'restricted',
                mode: 'manual',
            },
        ],
        restricted: true,
        channels,
    });

    try {
        const response = await fetch(`https://slack.com/api/users.admin.inviteBulk`, {
            headers,
            method: 'POST',
            body: data,
        });

        const result = await response.json();

        if (!result.ok) {
            logError("failed to invoke users.admin.inviteBulk!", result, response);
            return new Err("An internal Slack error occured. Please contact ascpixi@hackclub.com.")
        }

        if (!result.invites || result.invites.length === 0) {
            logError("users.admin.invokeBulk invoked, but no invites...?", result, response);
            return new Err("We couldn't send the Slack invite. Please contact ascpixi@hackclub.com.");
        }

        if (!result.invites[0].ok) {
            const inviteError = result.invites[0].error;

            if (inviteError === 'already_in_team') {
                logInfo("already_in_team error received after checking e-mail...?", result);
                return new Err("A user already exists with that e-mail address");
            }

            logError("unknown Slack API error for invites[0].ok!", result.invites[0], result, response);
            return new Err("We couldn't send the Slack invite. Please contact ascpixi@hackclub.com.");
        }

        return new Success();
    }
    catch (error) {
        logError(`exception handler reached when inviting ${email}!`, error);
        return new Err("An internal server error occured. Please contact ascpixi@hackclub.com for assistance.");
    }
}
