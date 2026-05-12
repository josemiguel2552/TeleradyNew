export interface AuthLogin {
    email: string;
    password: string;
    name?: string;
}

export interface TokensLogin {
    accessToken?: string;
    refreshToken?: string;
    newUser?: boolean;
}

export interface AuthRefresh {
    email: string;
    refreshToken: string;
}

export interface AuthSigup {
    email: string;
    name?: string;
    lastName?: string;
    password?: string;
    sessionType?: string;
}


export interface PassRefresh {
    password: string;
    token: string;
}