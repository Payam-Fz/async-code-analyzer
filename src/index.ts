import * as fs from 'fs';
import yargs from 'yargs';
import { parse }from '@babel/parser'
import { getDependencyMap } from './LineDependencyMap.ts';
import diagnosis from './diagnosis.ts';
import { SuggestionProducer } from './suggestion/suggestion-producer.ts';


const argv: any = yargs(process.argv.slice(2))
    .option('file-path', {
        description: 'File path',
        type: 'string',
        demandOption: true // Set flag as required
    })
    .help()
    .alias('help', 'h')
    .argv;

const filePath = argv.filePath;

fs.readFile(filePath, 'utf8', (err: any, data: string) => {
    if (err) {
        console.error('Error reading file:', err);
        process.exit(1);
    }
    const ast = parse(data);

    // Create dependency map
    const dependencyMap = getDependencyMap(ast);

    // Find issues
    const problems = diagnosis(ast, dependencyMap);

    // Log suggestions to console
    const suggester = new SuggestionProducer(ast, data);
    suggester.produceSuggestions(problems);
});

export {};
