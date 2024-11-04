const { exec } = require('child_process');

function execCommand(command) {
    return new Promise((resolve, reject) => {
        exec(command, (error, stdout, stderr) => {
            //console.log(command);
            if (error) {
                reject(error.message);
            } else if (stderr) {
                reject(stderr);
            } else {
                resolve(stdout);
            }
        });
    });
}
const dependencies_map = new Map();


async function checkDependencies(command) {
    try {
        const stdout = await execCommand(command);

        const result = stdout.trim().split("\n");

        for (let index = 0; index < result.length; index++) {
            let line = result[index].trim();
            if(line.includes("UNMET OPTIONAL DEPENDENCY")){
                continue;
            }
            let dep = "";
            if(index===0){
                dep=line.split(" ")[0];
            }
            else{
                arr=line.split(" ");
                if(arr[arr.length-1]=="deduped" || arr[arr.length-1]=="overridden"){
                    dep=arr[arr.length-2];
                }
                else{
                    dep=arr[arr.length-1];
                }
            }
            if(dep.includes(":")){
                dep=dep.split(":").pop();
            }
            if (dependencies_map.has(dep)) {
                continue;
            } else {
                try{
                const output = await execCommand(`npm view ${dep}`);
                
                if (output.includes("DEPRECATED")) {
                    dependencies_map.set(dep, "DEPRECATED");
                } else {
                    dependencies_map.set(dep, "active");
                }
                }
                catch(error){
                    console.log(error);
                }
            }
        }

        //console.log(dependencies_map);
    } catch (error) {
        console.error(`Error: ${error}`);
    }
}

async function runDependencyCheck() {
    
    await checkDependencies('npm ls'); 

    let dep_check = true;
    counter=0;
    dependencies_map.forEach((val, key) => {
        if (val === "DEPRECATED") {
            counter++;
            dep_check = false;
            console.log(counter+". "+key+" "+val);
        }
    });

    if (dep_check) {
        console.log("\x1b[32mSUCCESS: All tests passed, no deprecated packages found at root level! Congos!!\n\x1b[0m")
    } else {
        console.log("\x1b[31mWARNING!!Deprecated results found at root level.\n\x1b[0m");
    }
    
    await checkDependencies('npm ls --all');

    counter=0;
    dependencies_map.forEach((val, key) => {
        if (val === "DEPRECATED") {
            counter++;
            dep_check = false;
            console.log(counter+". "+key+" "+val);
        }
    });

    if (dep_check) {
        console.log("\x1b[32mSUCCESS: All tests passed, no deprecated packages found! Congos!!\x1b[0m")
    } else {
        console.log("\x1b[31mWARINING!!Deprecated results found.\x1b[0m");
    }
    
}


runDependencyCheck();