import { SuggestionLogger } from "../suggestion-logger.ts";

export class UnnecessaryBlockingLogger extends SuggestionLogger {
    public produceSuggestion(problem: Groupings): void {
        const { targetLine, independentLines } = problem;

        this.log("Warning: Unnecessary blocking", 'yellow');
        this.log("The following statements can be moved earlier since they do not depend on async calls.", 'yellow');
        this.log("");

        if (targetLine > 0) this.logLine(targetLine - 1);

        const ranges = independentLines.map((lineGroup) => {
            // If the innerArray has only one element, return it directly
            if (lineGroup.length === 1 || Math.min(...lineGroup) === Math.max(...lineGroup)) {
                return `${lineGroup[0]}`;
            } else {
                const min = Math.min(...lineGroup);
                const max = Math.max(...lineGroup);
                return `${min}-${max}`;
            }
        }).join(', ');

        this.log("<--- Move lines "+ ranges + " to here", "green");
        this.logLine(targetLine)
        this.log("----------------------------------------------", 'red')
        independentLines.forEach(lineGroup => { 
            lineGroup.forEach(line => {
            this.logLine(line, 'red');
        });
            
        });
        this.log("----------------------------------------------", 'red')
    }
}

type Groupings = {
    type: string;
    targetLine: number
    independentLines: number[][]
};