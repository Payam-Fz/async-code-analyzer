import { ParseResult } from "@babel/parser";
import { Node } from "@babel/types";
import * as t from "@babel/types";

import _traverse, { NodePath } from "@babel/traverse";

const traverse = _traverse.default;

/**
 * Get the first AST path that starts at the given line
 * 
 * @param ast 
 * @param line 
 */
export const getPathAtLine = (line: number, ast: ParseResult<babel.types.File>): NodePath<Node> | null => {
    let foundPath: NodePath<Node> | null = null;

    const visitor: babel.Visitor = {
        enter(path) {
            const { node } = path;
            const loc = node.loc;
            if (!loc) return;

            const startLine = loc.start.line;

            if (startLine === line) {
                // Found the node
                foundPath = path;
                path.stop();
            }
        }
    };

    traverse(ast, visitor);

    return foundPath;
};

/**
 * Make an attempt to get the variable name at a path
 * If there's no name found, return undefined
 * 
 * @param node
 */
export const getVariableNameAtPath = (path: NodePath<Node>) => {

    let variableName: string | undefined = undefined;

    const visitor: babel.Visitor = {
        Identifier: {
            enter(path) {
                const parent = path.parent;
                if (t.isVariableDeclarator(parent) || t.isAssignmentExpression(parent)) {
                    variableName = path.node.name;
                    path.stop();
                }
            }
        }
    };

    path.traverse(visitor);

    return variableName;
};

export const getExpressionPath = (path: NodePath<Node>) => {
    let expression: NodePath<babel.types.Expression> | undefined = undefined;
    let seenFirstAwait = false;

    const visitor: babel.Visitor = {
        Expression: {
            enter(path) {
                // We don't want the await part
                if (t.isAwaitExpression(path.node)) {
                    seenFirstAwait = true;
                    return;
                }

                if (seenFirstAwait) {
                    // Stop at the highest level expression possible, after the await expression
                    expression = path;
                    path.stop();
                }
            }
        }
    };

    path.traverse(visitor);

    return (expression as NodePath<babel.types.Expression> | undefined);
};
