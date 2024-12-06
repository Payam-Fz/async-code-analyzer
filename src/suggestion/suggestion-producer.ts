import { ParseResult } from "@babel/parser";
import { SequentialAwaitLogger } from "./sequential-await/sequential-await-logger.ts";
import { UnnecessaryBlockingLogger } from "./unnecessary-blocking/unnecessary-blocking.ts";
import { asyncProblems } from "../asyncProblems.ts";

export class SuggestionProducer {
    private _sequentialAwait: SequentialAwaitLogger;
    private _unncessaryBlocking: UnnecessaryBlockingLogger;

    constructor(ast: ParseResult<babel.types.File>, data: String) {
        this._sequentialAwait = new SequentialAwaitLogger(ast, data);
        this._unncessaryBlocking = new UnnecessaryBlockingLogger(ast, data);
    }

    public produceSuggestions(problems: any[]) {
        problems.forEach(problem => {
            console.log("----------------------------------------------");
            if (problem.type === asyncProblems.SequentialAwait) this._sequentialAwait.produceSuggestion(problem);
            else if (problem.type === asyncProblems.UnnecessaryAsync) this._unncessaryBlocking.produceSuggestion(problem);
        });
    }
}
