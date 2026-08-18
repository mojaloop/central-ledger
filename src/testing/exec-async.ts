import { exec } from 'child_process';
import { promisify } from 'node:util';

const execPromise = promisify(exec);

/**
 * A convenience wrapper around exec_sync to make it more like bun's $.
 */
export async function execAsync(
  command: string,
  options: {
    cwd?: string;
    env?: NodeJS.ProcessEnv;
    silent?: boolean,
    force?: boolean,
  } = {
      silent: true,
      force: false,
    }
): Promise<{ stdout: string; stderr: string }> {
  const { cwd, env, silent, force } = options

  const logStdout = (content: string) => {
    if (silent) {
      return
    }
    console.log(content)
  }

  const logStderr = (content: string) => {
    if (silent) {
      return
    }
    console.error(content)
  }

  logStdout(`executing: ${command}`)
  try {
    const { stdout, stderr } = await execPromise(command, {
      cwd,
      env,
      // 10MB.
      maxBuffer: 10 * 1024 * 1024,
    });


    if (stdout.trim()) {
      logStdout(`stdout:\n${stdout}`)
    }
    if (stderr.trim()) {
      logStderr(`stderr:\n${stderr}`)
    }

    return { stdout, stderr };
  } catch (err: any) {
    if (force) {
      return {
        stdout: '',
        stderr: '',
      }
    }

    logStderr(`Command failed: ${command}`);

    throw err;
  }
}
