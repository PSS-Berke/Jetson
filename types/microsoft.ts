export type ExchangeMSCodeForTokenRequestPayload = {
    code: string;
    state: string;
};

export interface MicrosoftCompany {
    id: number;
    name: string;
    tenantId?: string;
    createdAt?: string;
    updatedAt?: string;
    [key: string]: unknown;
}

export type CompanyRequestPayload = {
    name: string;
    tenantId?: string;
    [key: string]: unknown;
};
