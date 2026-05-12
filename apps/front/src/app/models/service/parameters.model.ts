export interface Parameter {
    id: number;
    name: string;
}

export interface Question {
    id: number;
    question: string;
    field?: string;
    itemsAnswer: Parameter[];
    filter?: boolean;
}

export interface ParameterUUID {
    id: string;
    name: string;
}