export class Success {
    ok = true as const;
}

export class Ok<T> {
    ok = true as const;
    result: T;

    constructor (value: T) {
        this.result = value;
    }
}

export class Err {
    ok = false as const;
    error: string;

    constructor (error: string) {
        this.error = error;
    }
}

export type Result<T> = Ok<T> | Err;
export type Status = Success | Err;
export type AsyncResult<T> = Promise<Result<T>>;
export type AsyncStatus = Promise<Status>;

export function logInfo(...data: any[]) {
    console.log("(info)", ...data);
}

export function logError(...data: any[]) {
    console.error("(error)", ...data)
}

export function logWarn(...data: any[]) {
    console.warn("(warn)", ...data);
}