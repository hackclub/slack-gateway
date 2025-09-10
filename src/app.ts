import express, { Request, Response } from 'express';
import rateLimited from "express-rate-limit";

import * as fs from "fs";
import * as yup from "yup";
import JSON5 from "json5";
import dotenv from "dotenv";

import { inviteSlack } from './invite';
import { logInfo, logWarn } from './util';

dotenv.config();

const app = express();
app.set("view engine", "ejs");
app.use(express.static("public"));
app.use(express.urlencoded());

const port = 3000;

const programSchema = yup.array(
    yup.object({
        name: yup.string().required(),
        displayName: yup.string().required(),
        active: yup.bool().required(),
        channels: yup.array(yup.string().matches(/^[CGDZ][A-Z0-9]{8,}$/).required()).required()
    })
).required();

const knownPrograms = programSchema.validateSync(
    JSON5.parse(fs.readFileSync("./ysws.jsonc", { encoding: "utf-8" }))
);

function yswsDependentEndpoint(res: Response, params: any) {
    if (!("ysws" in params)) {
        res.status(422);
        res.render("error", { message: "You're missing a 'ysws' parameter in your URL or POST body!" });
        return null;
    }

    const ysws = knownPrograms.find(x => x.name == params.ysws);

    if (!ysws) {
        res.status(422);
        res.render("error", { message: "You specified an unknown YSWS (You Ship, We Ship) program!" });
        return null;
    }

    if (!ysws.active) {
        res.status(410);
        res.render("error", { message: "That YSWS program is not active anymore." });
        return null;
    }

    return ysws;
}

function logRequest(req: Request) {
    logInfo(`[${new Date().toLocaleString("en-gb")}] ${req.ip} -> ${req.method} ${req.url}`);
}

app.get("/invite", (req: Request, res: Response) => {
    logRequest(req);

    const ysws = yswsDependentEndpoint(res, req.query);
    if (!ysws)
        return;

    res.render("main", { ysws });
});

app.get("/send-invite", (req: Request, res: Response) => {
    logRequest(req);
    res.redirect("https://hackclub.com/slack");
});

app.post("/send-invite", rateLimited({
    windowMs: 5 * 60 * 1000,
    limit: 3,
    standardHeaders: "draft-8",
    handler: async (req, res) => {
        logWarn(`IP ${req.ip} (${req.headers['x-forwarded-for'] || req.socket.remoteAddress}) is being rate-limited! (${new Date().toLocaleString("en-gb")})`, req);
        res.status(429);
        res.render("error", { message: "You're doing that a bit too fast! Try again in 5 minutes." });
    }
}), async (req: Request, res: Response) => {
    logRequest(req);
    const ysws = yswsDependentEndpoint(res, req.body);
    if (!ysws)
        return;

    if (!("email" in req.body)) {
        res.status(422);
        res.render("error", { message: "You haven't specified an email!" });
        return;
    }
    
    const email = req.body.email;
    if (!yup.string().email().required().isValidSync(email)) {
        res.status(422);
        res.render("error", { message: "That's not a valid e-mail address!" });
        return;
    }

    const secrets = {
        botToken: process.env.BOT_TOKEN!,
        userToken: process.env.USER_TOKEN!,
        cookie: process.env.SLACK_COOKIE!
    };

    const result = await inviteSlack(secrets, ysws.channels, email);

    if (result.ok) {
        res.render("success", { email });
        return;
    }

    res.status(400);
    res.render("error", { message: result.error });
});

app.get('/', (req: Request, res: Response) => {
    logRequest(req);
    res.redirect("https://hackclub.com/slack");
});

app.listen(port, () => {
    logInfo(`ready! listening on port ${port}!`);
});