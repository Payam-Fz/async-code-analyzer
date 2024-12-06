import * as t from "@babel/types";
import _traverse from "@babel/traverse";

import { asyncProblems } from './asyncProblems.ts';

const traverse = _traverse.default;

const diagnosis = (ast: any, dependency_map: any) => {
    let problems = [];
    const awaitNodes = findAwaits(ast);
    problems = problems.concat(sequentialAsyncCheck(ast, dependency_map, awaitNodes));
    problems = problems.concat(unnecessaryAsyncCheck(ast, dependency_map, awaitNodes));
    return problems;
}

const unnecessaryAsyncCheck = (ast: any, dependency_map: any, awaitNodes: any) => {
    const problems = [];
    const rootNode = ast.program;
    const awaitNodesLines = [];
    for (let awaitNode of awaitNodes) {
        const path = findPathOfNode(rootNode, awaitNode, [rootNode]);
        const line = getStatementLineNum(path);
        awaitNodesLines.push(line);
    }

    // Problematic if there are any subsequent independent lines within scope
    for (let awaitNode of awaitNodes) {
        const path = findPathOfNode(rootNode, awaitNode, [rootNode]);
        const line = getStatementLineNum(path);
        const func = getParentFunction(path);
        const endOfFunc = func.loc.end.line;
        const parentBlockStatementStartLine = path[path.length-4].loc.start.line;
        let nonAsyncNodes = [];
        if (func.loc.start.line === parentBlockStatementStartLine) {
            // case where awaitNode is in the shallowest part of the function
            nonAsyncNodes = findNonAsyncNodes(ast, awaitNodesLines, func.id.name);
        } else {
            // case where awaitNode is in a block statement that's not the function itself
            nonAsyncNodes = findNonAsyncNodesBlock(ast, awaitNodesLines, parentBlockStatementStartLine);
        }
        let independentLines = [];

        for (let node of nonAsyncNodes) {
            const otherPath = findPathOfNode(rootNode, node, [rootNode]);
            const otherLine = getStatementLineNum(otherPath);
            if (line < otherLine && otherLine <= endOfFunc && isIndependent(otherLine, line, dependency_map)) {
                const nearestBlockStatement = otherPath[otherPath.length-2];
                if (nearestBlockStatement.loc.start.line !== func.loc.start.line && line < nearestBlockStatement.loc.start.line) {
                    independentLines.push(nearestBlockStatement.loc.start.line);
                    independentLines.push(otherLine);
                    independentLines.push(nearestBlockStatement.loc.end.line);
                } else {
                    independentLines.push(otherLine);
                }
            }
        }
        
        if (independentLines.length > 0) {
            problems.push({
                type: asyncProblems.UnnecessaryAsync,
                targetLine: line,
                independentLines: groupSequence([...new Set(independentLines.sort((a,b) => a-b))]),
            });
        }
    }

    return problems;
};

const sequentialAsyncCheck = (ast: any, dependency_map: any, awaitNodes: any) => {
    const problems = [];
    const rootNode = ast.program;

    //Problematic if there are subsequent independent awaits within scope.
    for (let awaitNode of awaitNodes) {
        const path = findPathOfNode(rootNode, awaitNode, [rootNode]);
        const line = getStatementLineNum(path);
        const func = getParentFunction(path);
        const endOfFunc = func.loc.end.line;


        for (let otherNode of awaitNodes) {
            if (awaitNode === otherNode) {
                continue;
            }
            
            const otherNodePath = findPathOfNode(rootNode, otherNode, [rootNode]);
            const otherNodeLine = getStatementLineNum(otherNodePath);

            if (line < otherNodeLine && otherNodeLine <= endOfFunc && isIndependent(otherNodeLine, line, dependency_map)) {
                problems.push({
                    type: asyncProblems.SequentialAwait,
                    problemLine: line,
                    victimLine: otherNodeLine
                })
            }
        }
    }

    problems.sort((a, b) => {
        if (a.problemLine < b.problemLine) {
            return -1; 
        }
        if (a.problemLine > b.problemLine) {
            return 1;
        }
        // If problem lines are equal, sort by victim line
        if (a.victimLine < b.victimLine) {
            return -1;
        }
        if (a.victimLine > b.victimLine) {
            return 1;
        }
        return 0;
    })

    // Combine victim lines with problemLine into Promise All grouping
    // as long as all members are independent of each other
    const alreadyDiagnosedProblems: any[] = [];
    const groupings: any[] = [];

    for (let problem of problems) {
        if (alreadyDiagnosedProblems.includes(problem.problemLine) 
        || groupings.some((elem, index, array) => elem['promiseGrouping'].includes(problem.problemLine))) {
            continue;
        }
        
        const grouping = [problem.problemLine];

        const victimLineNums = problems.filter((victim) => {
            return victim.problemLine === problem.problemLine
        }).map((victim) => victim.victimLine);


        // This just confirms that the awaits after the problem lines are independent of each other
        // before adding them to the promise grouping
        for (let num of victimLineNums) {
            const independencies = victimLineNums.map((victim) => {
                return num !== victim && isIndependent(num, victim, dependency_map)
            });

            if (independencies.filter(Boolean).length === victimLineNums.length - 1) {
                grouping.push(num);
            }
        }
        groupings.push({
            type: asyncProblems.SequentialAwait,
            problemLine: problem.problemLine,
            promiseGrouping: grouping
        });

        alreadyDiagnosedProblems.push(problem.problemLine);
    }

    return groupings;
}

const getStatementLineNum = (path: any) => {
    for (let item of path.toReversed()) {
        if (t.isStatement(item)) {
            return item.loc.start.line;
        }
    }
    throw new Error('Statement not found.');
}

// Checks the ast for any use of the await keyword and returns the node of each one.
const findAwaits = (ast: any) => {
    const awaits: any[] = [];
    traverse(ast, {
        enter(path: any) {
            if (t.isAwaitExpression(path.node)) {
                awaits.push(path.node);
            }
        }
    });
    return awaits;
}

// Finds nodes that don't depend on await calls by traversing the ast and checking for statement nodes within function scopes that contain await nodes
const findNonAsyncNodes = (ast: any, awaitNodesLines: any, funcName: any) => {
    const nonAsyncNodes = [];
    traverse(ast, {
        enter(path) {
            if (t.isFunctionDeclaration(path.node) && path.node.id.name === funcName) {
                traverse(path.node.body, {
                    enter(path) {
                        if (t.isStatement(path.node) && !awaitNodesLines.includes(path.node.loc.start.line)) {
                            if (!t.isIfStatement(path.node) && !t.isBlockStatement(path.node) && !t.isLoop(path.node)) {
                                nonAsyncNodes.push(path.node);
                            }
                        }
                    }
                }, path.scope, path.parentPath);
            }
        }
    });
    return nonAsyncNodes;
}

// Like findNonAsyncNodes but only checks within parent block statement, but not other block statements within parent block statement
const findNonAsyncNodesBlock = (ast: any, awaitNodesLines: any, blockStartLine: any) => {
    const nonAsyncNodes = [];
    traverse(ast, {
        enter(path) {
            if (t.isBlockStatement(path.node) && path.node.loc.start.line === blockStartLine) {
                for (let node of path.node.body) {
                    if (t.isStatement(node) && !awaitNodesLines.includes(node.loc?.start.line)) {
                        if (!t.isIfStatement(node) && !t.isBlockStatement(node) && !t.isLoop(node)) {
                            nonAsyncNodes.push(node);
                        }
                    }
                }
            }
        }
    })
    return nonAsyncNodes;
}

// Returns the AST path of the await expression on nodeToFind
const findPathOfNode = (astNode: any, nodeToFind: any, nodeStack: any): any => {


    if (astNode === nodeToFind) {
        return nodeStack;
    }

    for (let prop in astNode) {
        const val = astNode[prop];
        if (t.isNode(val)) {
            const path = findPathOfNode(val, nodeToFind, nodeStack.concat([val]));
            if (path !== null) {
                return path;
            }
        }
        if (Array.isArray(val)) {
            for (let item of val) {
                if (t.isNode(item)) {
                    const path = findPathOfNode(item, nodeToFind, nodeStack.concat([item]));
                    if (path !== null) {
                        return path;
                    }
                }
            }
        }
    }

    // There was no path found in entire program, throw error
    if (astNode.type === 'Program') {
        throw new Error('No path found. This shouldn\'t be reached.');
    }

    return null;
}

const getParentFunction = (path: any) => {
    for (let item of path.toReversed()) {
        if (item.type === 'FunctionDeclaration') {
            return item;
        }
    }
    throw new Error('No parent function found.');
}

function groupSequence(arr: any) {
    let result = [];
    let group = [];
    for (let i = 0; i < arr.length; i++) {
        if (group.length === 0 || arr[i] - group[group.length - 1] === 1) {
            group.push(arr[i]);
        } else {
            result.push(group);
            group = [arr[i]];
        }
    }
    if (group.length > 0) {
        result.push(group);
    }
    return result;
}

//Checks if line1 is dependent on line2 based on its presence in line1's dependency mapping
const isIndependent = (line1: any, line2: any, dependency_map: any) => {
    return !dependency_map[line1.toString()].dependencies.includes(line2);
}

export default diagnosis;