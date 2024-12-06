import * as babel from "@babel/core";
import {parse, ParseResult} from '@babel/parser';
import _traverse from "@babel/traverse";

const traverse = _traverse.default;

interface DependencyMap {
    [key: string]: { dependencies: number[] }
}

type LineDependencyMap = Map<number, Set<number>>;
type ScopeNameDependency = Map<string, Set<number>>;

/**
 * Generates a map for each line to all the previous lines that contributed to variables of current line.
 * The dependency set of modified variables or objects is updated by:
 * 1. Adding dependencies of RHS parameters
 * 2. Adding the current line if it contains an await expression
 * 3. Adding dependencies of the flow control
 *
 * @param {string} ast - The ast for which to generate the dependency map.
 * @returns {LineDependencyMap} A mapping from line number to the lines it is dependant on.
 */
function getDependencyMap(ast: ParseResult<File>): DependencyMap {
    const lineDependencyMap: LineDependencyMap = new Map<number, Set<number>>();
    const nameDependencyList: ScopeNameDependency[] = [];
    const flowDependencyList: Set<number>[] = [];

    const mainTraversal: babel.Visitor = {
        Block: {
            enter(blockPath) {
                const scopeBindings = Object.keys(blockPath.scope.bindings);
                const head: ScopeNameDependency = new Map();
                scopeBindings.forEach(variableName => {
                    const initialDependency = new Set<number>();
                    const definitionLine = blockPath.scope.bindings[variableName].path.node.loc?.start.line;
                    if (definitionLine !== undefined) {
                        initialDependency.add(definitionLine);
                    }
                    head.set(variableName, initialDependency);
                });
                nameDependencyList.push(head);
            },
            exit(blockPath) {
                nameDependencyList.pop();
            }
        },
        Statement: {
            enter(statementPath) {
                const start = statementPath.node.loc?.start.line;
                const end = statementPath.node.loc?.end.line;
                if (start === undefined || end === undefined)
                    throw Error('Missing statement location.');

                if (statementPath.isConditional() || statementPath.isLoop()) {
                    let conditionPaths = statementPath.get('test');
                    if (!Array.isArray(conditionPaths)) {
                        conditionPaths = [conditionPaths];
                    }
                    let rhsNames = new Set<string>();
                    for (const conditionPath of conditionPaths) {
                        rhsNames = new Set([...rhsNames, ...extractRHSName(conditionPath)]);
                    }
                    const condDependencies = new Set([...getNameDependencies(nameDependencyList, rhsNames), start]);
                    flowDependencyList.push(condDependencies);
                } else if (statementPath.isSwitchStatement()) {
                    const discriminantPaths = statementPath.get('discriminant');
                    const rhsNames = extractRHSName(discriminantPaths);
                    const condDependencies = new Set([...getNameDependencies(nameDependencyList, rhsNames), start]);
                    flowDependencyList.push(condDependencies);
                }
            },
            // Update lineDependencyMap for the current statement based on Statements or Expressions inside it
            exit(statementPath) {
                const start = statementPath.node.loc?.start.line;
                const end = statementPath.node.loc?.end.line;
                if (start === undefined || end === undefined)
                    throw Error('Missing statement location.');

                let lineDependencies = new Set<number>();
                lineDependencies = getInnerStatementDependencies(lineDependencyMap, start, end);
                lineDependencies = new Set([...lineDependencies, ...getFlowDependencies(flowDependencyList)]);
                lineDependencies = new Set([...lineDependencies, start]);
                const updatedDependencies = setLineDependency(lineDependencyMap, start, lineDependencies, false);
                updateLHSDependencies(nameDependencyList, statementPath, updatedDependencies);

                if (statementPath.isConditional() || statementPath.isLoop() || statementPath.isSwitchStatement()) {
                    flowDependencyList.pop();
                }
            }
        },
        Expression: {
            exit(expressionPath) {
                const start = expressionPath.node.loc?.start.line;
                const end = expressionPath.node.loc?.end.line;
                if (start === undefined || end === undefined)
                    throw Error('Missing expression location.');

                // Collect dependencies from RHS variables/functions
                const rhsNames = extractRHSName(expressionPath);
                const innerDependencies = getNameDependencies(nameDependencyList, rhsNames);
                setLineDependency(lineDependencyMap, start, innerDependencies, false);
            }
        }
    }

    traverse(ast, mainTraversal);
    return convertToSharedType(lineDependencyMap);
}

/******************* HELPERS *************************/
function getInnerStatementDependencies(dependencyMap: LineDependencyMap, startLine: number, endLine: number): Set<number> {
    // Combine all dependencies related to lines between start and end
    let innerDependencies = new Set<number>();
    for (const [lineNumber, dependencies] of dependencyMap.entries()) {
        if (startLine <= lineNumber && lineNumber < endLine) {
            innerDependencies = new Set([...innerDependencies, ...dependencies]);
        }
    }
    // Exclude all lines between start and end
    innerDependencies.forEach(number => {
        if (number > startLine && number < endLine) {
            innerDependencies.delete(number);
        }
    });
    return innerDependencies;
}

// Flattens all flow dependencies to a set
function getFlowDependencies(dependencyList: Set<number>[]): Set<number> {
    // Combine all dependencies related to lines between start and end
    let flattenedDependencies = new Set<number>();
    for (const head of dependencyList) {
        flattenedDependencies = new Set([...flattenedDependencies, ...head]);
    }
    return flattenedDependencies;
}

function setLineDependency(
    dependencyMap: LineDependencyMap,   // Mutates this Map
    lineNumber: number,
    dependencies: Set<number>,
    replace: boolean    // if True, will remove the old content, otherwise will add to the set
) {
    let unionDependencies = dependencies;
    if (dependencyMap.has(lineNumber) && !replace) {
        const oldDependencies = dependencyMap.get(lineNumber)!;
        unionDependencies = new Set([...oldDependencies, ...unionDependencies]);
        dependencyMap.set(lineNumber, unionDependencies);
    } else {
        dependencyMap.set(lineNumber, unionDependencies);
    }
    return unionDependencies;
}

/*
 * Traverses dependencyList from end to beginning and if it finds the first occurance
 * of varName, will add dependencies to it.
 * This will NOT add the varName to the set if it doesn't already exist.
 * If 'replace' is true, will remove the old content, otherwise will add to the set.
 * Returns undefined if no name dependency was set.
 */
function setNameDependency(
    dependencyList: ScopeNameDependency[],   // Mutates this list
    varName: string | undefined,
    dependencies: Set<number>,
    replace: boolean    // if True, will remove the old content, otherwise will add to the set
) {
    if (varName === undefined) return undefined;
    let unionDependencies = dependencies;
    for (let i = dependencyList.length - 1; i >= 0; i--) {
        const scope = dependencyList[i];
        if (scope.has(varName)) {
            if (replace) {
                dependencyList[i].set(varName, unionDependencies);
            } else {
                const oldDependencies = scope.get(varName)!;
                unionDependencies = new Set([...oldDependencies, ...unionDependencies]);
                dependencyList[i].set(varName, unionDependencies);

            }
            return unionDependencies;
        }
    }
    return undefined;
}

// Extracts LHS names based on each statement type and updates their dependency
function updateLHSDependencies(
    dependencyList: ScopeNameDependency[],   // Mutates this list
    statementPath: babel.NodePath<babel.types.Statement>,
    dependencies: Set<number>
) {
    // Have to use if-else instead of switch to properly identify types
    if (statementPath.isVariableDeclaration()) {
        const declarators = statementPath.get('declarations');
        declarators.forEach(declPath => {
            const lhsPath = declPath.get('id');
            const lhsNames = extractName(lhsPath);
            lhsNames.forEach(varName => setNameDependency(dependencyList, varName, dependencies, true));
        })
    } else if (statementPath.isFunctionDeclaration()) {
        // Add dependency for function name
        const funcName = statementPath.node.id?.name;
        setNameDependency(dependencyList, funcName, dependencies, true);
        // Add dependency for parameters
        const paramPaths = statementPath.get('params');
        for (const paramPath of paramPaths) {
            if (paramPath.isIdentifier()) {
                const paramName = paramPath.node.name;
                const paramLine = paramPath.node.loc?.start.line;
                if (paramLine !== undefined) {
                    setNameDependency(dependencyList, paramName, new Set([paramLine]), true);
                }
            }
        }
    } else if (statementPath.isClassDeclaration()) {
        const className = statementPath.node.id?.name;
        setNameDependency(dependencyList, className, dependencies, true);
    } else if (statementPath.isExpressionStatement()) {
        const expressionPath = statementPath.get('expression');
        if (expressionPath.isAssignmentExpression()) {
            // E.g. a = a + b;
            const lhsPath = expressionPath.get('left');
            const lhsNames = extractName(lhsPath);
            lhsNames.forEach(varName => setNameDependency(dependencyList, varName, dependencies, true));
        } else if (expressionPath.isUpdateExpression()) {
            // E.g. variable++;
            const lhsPath = expressionPath.get('argument');
            const lhsNames = extractName(lhsPath);
            lhsNames.forEach(varName => setNameDependency(dependencyList, varName, dependencies, false));
        } else if (expressionPath.isCallExpression()) {
            // E.g. obj.inner.call(param); OR foo(param);
            const lhsPath = expressionPath.get('callee');
            if ( !lhsPath.isMemberExpression()) return;  // Exclude direct function calls
            const lhsNames = extractName(lhsPath);
            lhsNames.forEach(varName => setNameDependency(dependencyList, varName, dependencies, false));
        }
    }
}

function getNameDependencies(dependencyList: ScopeNameDependency[], varNames: Set<string>) {
    let unionDependencies = new Set<number>;
    varNames.forEach(varName => {
        for (let i = dependencyList.length - 1; i >= 0; i--) {
            const scope = dependencyList[i];
            if (scope.has(varName)) {
                const dependencies = scope.get(varName)!;
                unionDependencies = new Set([...unionDependencies, ...dependencies]);
            }
        }
    });
    return unionDependencies;
}

// Get name from Identifier, MemberExpression, or ObjectPattern
function extractName(expressionPath: babel.NodePath<babel.types.Expression | babel.types.LVal>) {
    const varNames: Set<string> = new Set();
    if (expressionPath.isIdentifier()) {
        varNames.add(expressionPath.node.name);
    } else if (expressionPath.isMemberExpression()) {
        const varName = getObjNameFromMemberExpression(expressionPath);
        if (varName) {
            varNames.add(varName);
        }
    } else if (expressionPath.isObjectPattern()) {
        expressionPath.traverse({
            Identifier: innerPath => {
                const varName = innerPath.node.name;
                varNames.add(varName);
            },
        });
    }
    return varNames;
}

function extractRHSName(expressionPath: babel.NodePath<any>) {
    const varNames: Set<string> = new Set();
    if (expressionPath.isIdentifier()) {
        varNames.add(expressionPath.node.name);
    } else {
        expressionPath.traverse({
            Identifier(idPath) {
                varNames.add(idPath.node.name);
            }
        });
    }

    return varNames;
}

// Get the root object in a chain of properties. E.g. get 'root' in 'root.inner.find()' OR root['att']
function getObjNameFromMemberExpression(expressionPath: babel.NodePath<babel.types.MemberExpression>) {
    let objPath: any = expressionPath;
    while (objPath.isMemberExpression()) {
        objPath = objPath.get('object');
    }
    if (objPath.isIdentifier()) {
        const objName: string = objPath.node.name;
        return objName;
    }
    return undefined;
}

function printHead(arr: any[]) {
    if (arr.length > 0) {
        console.log(arr[arr.length - 1])
    } else {
        console.log('empty')
    }
}

function convertToSharedType(lineDependencyMap: LineDependencyMap) {
    // return new Map([["1", {dependencies: [1]}]]);
    const sortedMap = new Map();
    // Sort line numbers in each set
    for (const [key, value] of lineDependencyMap.entries()) {
        if (value.size > 0) {
            const sortedValue = [...value].sort((a, b) => a - b);
            sortedMap.set(key, {dependencies: sortedValue});
        }
    }
    // Sort entries of the whole map
    const sortedLineDependencyMap = new Map(
        [...sortedMap.entries()]
            .sort(([keyA], [keyB]) => keyA - keyB)
    );
    const formattedMap: DependencyMap = {};
    sortedLineDependencyMap.forEach((value, key) => {
        formattedMap[String(key)] = value;
    });
    return formattedMap;
}

export { getDependencyMap, DependencyMap };
