import { ParseResult } from "@babel/parser";

/**
 * Base class for logging a suggestion to the console 
 */
export abstract class SuggestionLogger {
    private _ast: ParseResult<babel.types.File>;
    private _data: String;

    public get ast() {
        return this._ast;
    }

    public get data() {
        return this._data;
    }

    constructor(ast: ParseResult<babel.types.File>, data: String) {
        this._ast = ast;
        this._data = data;
    }

    /**
     * Given a line number, return the line of code in the program
     * 
     * @param line 
     */
    public getLine(line: number): string {
        const dataSplit = this._data.split('\n');
        return dataSplit[line - 1];
    }

    /**
     * Log a line of text
     */
    public log(text: string, color?: string) {
        const reset = "\x1b[0m";

        let colorCode = "";
        switch (color) {
            case "yellow":
                colorCode = "\x1b[33m";
                break;
            case "red":
                colorCode = "\x1b[31m";
                break;
            case "green":
                colorCode = "\x1b[32m";
                break;
            default:
                break;
        }

        if (colorCode) {
            console.log(`${colorCode}${text}${reset}`);
        } else {
            console.log(text)
        }
    }


    /**
     * Log a specific line of the code with the line number at the beginning
     * 
     * @param line 
     * @param color 
     */
    public logLine(line: number, color?: string) {
        // TODO: use this.getLine and this.log

        // TODO: do we need this to be able to log multiple lines at once?
        // ex: what if we want to log something like
        /**
         * const myPromise = await fetchData({
         *     url: "https://google.com",
         *     params: {}
         * });
         */

        const dataSplit = this._data.split('\n')
        if (line > 0) {
            this.log(line + "\t" + dataSplit[line - 1], color)
        }

    }

    /**
     * Log a suggestion, given a problem
     * 
     * @param problem 
     */
    // TODO: add type for problem?
    public abstract produceSuggestion(problem: any): void; // If we're just logging then there's nothing to return
};
