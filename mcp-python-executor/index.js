import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { execFile } from 'child_process';
import { randomUUID } from 'crypto';
import { writeFile, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const serverDirectory = dirname(fileURLToPath(import.meta.url));
const pythonExecutable = process.env.PYTHON_EXECUTABLE || join(serverDirectory, '.venv', 'bin', 'python');
const workingDirectory = process.env.PYTHON_WORKING_DIRECTORY || process.cwd();

const server = new Server(
  { name: 'python-executor', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [{
    name: 'run_python',
    description: 'Executa cod Python in mediul analitic. Disponibil: pandas, numpy, matplotlib, plotly, pyodbc, sqlalchemy, lxml, httpx, rich.',
    inputSchema: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'Codul Python de executat' },
        timeout: { type: 'number', description: 'Timeout in secunde (implicit: 30)' }
      },
      required: ['code']
    }
  }]
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name !== 'run_python') {
    throw new Error('Unknown tool');
  }

  const { code, timeout = 30 } = request.params.arguments;
  const temporaryFile = join(tmpdir(), `agent_${randomUUID()}.py`);

  try {
    await writeFile(temporaryFile, code, 'utf8');

    const result = await new Promise((resolve) => {
      execFile(
        pythonExecutable,
        [temporaryFile],
        { cwd: workingDirectory, timeout: timeout * 1000 },
        (error, stdout, stderr) => {
          resolve({
            stdout: stdout || '',
            stderr: stderr || '',
            exitCode: error?.code ?? 0
          });
        }
      );
    });

    return {
      content: [{
        type: 'text',
        text: [
          result.stdout && `STDOUT:\n${result.stdout}`,
          result.stderr && `STDERR:\n${result.stderr}`,
          `Exit code: ${result.exitCode}`
        ].filter(Boolean).join('\n')
      }]
    };
  } finally {
    await unlink(temporaryFile).catch(() => {});
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);