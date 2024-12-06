export type PromiseExecutionCode = {
    /** Name of the variable if it exists */
    variableName?: string;
    /** Piece of code that represents the promise execution */
    expression: string;
};
