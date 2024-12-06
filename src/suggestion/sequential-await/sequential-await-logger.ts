import { NodePath } from "@babel/traverse";
import { SuggestionLogger } from "../suggestion-logger.ts";
import { getExpressionPath, getPathAtLine, getVariableNameAtPath } from "../traverser.ts";
import { PromiseExecutionCode } from "./types.ts";
import { Node } from "@babel/types";
import { getWhitespace } from "../../utils/string.utils.ts";

/**
 * Provides suggestions for sequential await issues
 */
export class SequentialAwaitLogger extends SuggestionLogger {

    public async produceSuggestion(problem: Groupings) {
        const { problemLine, promiseGrouping } = problem;

        // Get all the promises that we will combine into Promise.all()
        const promisesToCombine = this.getConcurrentPromises(promiseGrouping);

        // Suggestion description
        this.log("Warning: Inefficient Use of Asynchronous Calls", 'yellow');
        this.log("The following async calls can be combined into a Promise.all() call.", 'yellow');
        this.log("");

        // Print the line before the problem line
        if (problemLine > 0) this.logLine(problemLine - 1);

        // Log every line 
        promiseGrouping.forEach(line => {
            this.logLine(line, 'red');
        });

        let suggestedLine = this.getSuggestedLine(promisesToCombine);

        // Give appropriate whitespace before the suggested line
        // It should have the same whitespace as the first line to be replaced
        const leadingWhitespace = getWhitespace(this.getLine(promiseGrouping[0]));
        suggestedLine = `+\t${leadingWhitespace}${suggestedLine}`;

        // Log the suggestion
        this.log(suggestedLine, 'green');
        this.log("");
    }

    // Get the variables and expressions for promises that can be combined together
    private getConcurrentPromises(lines: number[]): PromiseExecutionCode[] {
        const getPromiseCode = (line: number) => {

            const path = getPathAtLine(line, this.ast);
            if (!path) {
                throw new Error(`Could not find path at line ${line}`);
            }

            const variableName = getVariableNameAtPath(path);
            const expression = this.getExpressionCode(path);

            return {
                variableName,
                expression,
            };
        };

        return lines.map(getPromiseCode);
    }

    // Get the suggested Promise.all line, given the promises we can combine
    private getSuggestedLine(promises: PromiseExecutionCode[]): string {
        const variableNames = promises
            .map(promise => promise.variableName ?? '_')
            .join(', ');

        const expressions = promises
            .map(promise => promise.expression)
            .join(', ');;

        const line = `const [${variableNames}] = await Promise.all([${expressions}]);`;
        return line;
    }

    // Get the expression
    private getExpressionCode = (path: NodePath<Node>) => {
        const expression = getExpressionPath(path);

        if (!expression) throw new Error("Can't find expression");

        const expressionNode = expression.node;
        const expressionStart = expressionNode.loc?.start.index;
        const expressionEnd = expressionNode.loc?.end.index;

        if (expressionStart == null || expressionEnd == null) {
            throw new Error("Unable to find expression");
        }

        return this.data.slice(expressionStart, expressionEnd);
    };
};



// TODO: Define this properly in diagnosis
// This is just for my own dev purposes for now
type Groupings = {
    type: string;
    problemLine: number;
    promiseGrouping: number[];
};
