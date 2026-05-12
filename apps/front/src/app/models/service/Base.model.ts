export interface Base<U> {
    ok: boolean;
    message: string;
    response: U;
    showMessagePlan?:boolean;
}