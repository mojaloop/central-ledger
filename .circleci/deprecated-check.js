const { spawnSync } = require('child_process');

function execCommandSync(command) {
    const [cmd, ...args] = command.split(' '); // Split command into executable and arguments
    const result = spawnSync(cmd, args, { encoding: 'utf-8', shell: false });

    if (result.error) {
        throw result.error; // Handle system errors
    }
    if (result.status !== 0) {
        throw new Error(result.stderr || `Command failed with exit code ${result.status}`);
    }
    return result.stdout;
}

const dependenciesMap = new Map();
const regex = /(?:@[\w-]+\/)?[\w.-]{1,100}@\d{1,10}\.\d{1,10}\.\d{1,10}(?:[-+][\w.-]{1,50})?/g;

function checkDependencySync(dependency) {
    if (dependenciesMap.has(dependency)) return;
    try {
        const output = execCommandSync(`npm view ${dependency}`);
        if (output.includes('DEPRECATED')) {
            dependenciesMap.set(dependency, 'DEPRECATED');
        } else {
            dependenciesMap.set(dependency, 'active');
        }
    } catch (error) {
        dependenciesMap.set(dependency, 'UNKNOWN');
    }
}

function processLinesSync(lines) {
    for (const line of lines) {
        const trimmedLine = line.trim();
        const matches = trimmedLine.matchAll(regex);

        for (const match of matches) {
            const dependency = match[0];
            checkDependencySync(dependency);
        }
    }
}

function checkDependenciesSync(command) {
    try {
        const stdout = execCommandSync(command);
        const lines = stdout.trim().split('\n');
        processLinesSync(lines);
    } catch (error) {
        
        const errorLines = error.toString().trim().split('\n');
        processLinesSync(errorLines); // Process error lines as well
    }
}

function runDependencyCheckSync() {
    console.log('Checking dependencies at root level...');
    checkDependenciesSync('npm ls');

    let deprecatedFound = false;
    let counter = 0;
    dependenciesMap.forEach((status, dependency) => {
        if (status === 'DEPRECATED') {
            counter++;
            deprecatedFound = true;
            console.log(`${counter}. ${dependency} ${status}`);
        }
    });

    if (deprecatedFound) {
        console.log('\x1b[31mWARNING!! Deprecated results found at root level.\n\x1b[0m');
    } else {
        console.log('\x1b[32mSUCCESS: No deprecated packages found at root level! Congos!!\n\x1b[0m');
    }

    console.log('Checking all dependencies (including transitive)...');
    checkDependenciesSync('npm ls --all');

    deprecatedFound = false;
    counter = 0;
    dependenciesMap.forEach((status, dependency) => {
        if (status === 'DEPRECATED') {
            counter++;
            deprecatedFound = true;
            console.log(`${counter}. ${dependency} ${status}`);
        }
    });

    if (deprecatedFound) {
        console.log('\x1b[31mWARNING!! Deprecated results found in dependencies.\n\x1b[0m');
    } else {
        console.log('\x1b[32mSUCCESS: No deprecated packages found! Congos!!\x1b[0m');
    }
    
}

runDependencyCheckSync();