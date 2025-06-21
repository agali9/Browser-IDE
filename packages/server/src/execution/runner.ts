import Docker from 'dockerode';
import tar from 'tar-stream';

const isWindows = process.platform === 'win32';
const docker = new Docker(
  isWindows
    ? { socketPath: '//./pipe/docker_engine' }
    : { socketPath: '/var/run/docker.sock' }
);
const SANDBOX_IMAGE = 'browser-ide-sandbox';
const TIMEOUT_MS = 10_000;

export interface ExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
}

function parseWaitExitCode(data: unknown): number {
  if (data == null) return -1;
  if (typeof data === 'object') {
    const o = data as { StatusCode?: unknown; statusCode?: unknown };
    if (typeof o.StatusCode === 'number' && !Number.isNaN(o.StatusCode)) return o.StatusCode;
    if (typeof o.statusCode === 'number' && !Number.isNaN(o.statusCode)) return o.statusCode;
  }
  return -1;
}

function codeToTar(code: string, filename: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const pack = tar.pack();
    pack.entry({ name: filename }, code, (err) => {
      if (err) return reject(err);
      pack.finalize();
    });
    const chunks: Buffer[] = [];
    pack.on('data', (d) => chunks.push(d));
    pack.on('end', () => resolve(Buffer.concat(chunks)));
    pack.on('error', reject);
  });
}

const LANG_CONFIG: Record<string, { filename: string; cmd: string[] }> = {
  javascript: { filename: 'index.js', cmd: ['node', '/code/index.js'] },
  typescript: { filename: 'index.ts', cmd: ['ts-node', '--project', '/code/tsconfig.json', '--transpile-only', '/code/index.ts'] },
  python: { filename: 'main.py', cmd: ['python3', '/code/main.py'] },
  bash: { filename: 'run.sh', cmd: ['bash', '/code/run.sh'] },
};

export async function runInSandbox(code: string, language: string): Promise<ExecutionResult> {
  const config = LANG_CONFIG[language] ?? LANG_CONFIG['javascript'];
  const start = Date.now();

  const container = await docker.createContainer({
    Image: SANDBOX_IMAGE,
    Cmd: config.cmd,
    NetworkDisabled: true,
    HostConfig: {
      Memory: 128 * 1024 * 1024,
      CpuShares: 512,
      AutoRemove: true,
    },
    AttachStdout: true,
    AttachStderr: true,
  });

  const tarBuf = await codeToTar(code, config.filename);
  await container.putArchive(tarBuf, { path: '/code' });

  const stream = await container.attach({ stream: true, stdout: true, stderr: true });
  await container.start();

  const waitPromise = container.wait();

  let stdout = '';
  let stderr = '';

  const outputDone = new Promise<void>((resolve) => {
    container.modem.demuxStream(
      stream,
      { write: (c: Buffer) => { stdout += c.toString(); } },
      { write: (c: Buffer) => { stderr += c.toString(); } }
    );
    stream.on('end', resolve);
  });

  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Execution timed out')), TIMEOUT_MS)
  );

  try {
    await Promise.race([outputDone, timeout]);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    try {
      await container.stop({ t: 2 });
    } catch {
      /* ignore */
    }
    await waitPromise;
    const durationMs = Date.now() - start;
    return {
      stdout: stdout.trim(),
      stderr: stderr.trim() ? `${stderr.trim()}\n${message}` : message,
      exitCode: 124,
      durationMs,
    };
  }

  const waitResult = await waitPromise;
  const exitCode = parseWaitExitCode(waitResult);
  const durationMs = Date.now() - start;

  return {
    stdout: stdout.trim(),
    stderr: stderr.trim(),
    exitCode,
    durationMs,
  };
}
