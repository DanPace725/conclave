import { parseArgs } from 'node:util';
import { readFileSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { Store } from './store.js';
import { ConclaveService } from './service.js';
import { downloadRecord } from './context-repository.js';
import { redact } from './provider.js';

export const serviceCommands = new Set(['call', 'view', 'workspace-list', 'workspace-read', 'workspace-upload',
  'agent-start', 'agent-step', 'agent-stop', 'agent-status', 'count-tokens', 'activity', 'audit', 'download']);
const methods = new Set(['status', 'list', 'create', 'view', 'ask', 'remember', 'name', 'sourceEvent',
  'contextBundle', 'workspaceFile', 'saveDocument', 'uploadDocument', 'changeDocument', 'countTokens',
  'saveContext', 'saveState', 'saveMemory', 'memoryLifecycle', 'agentStart', 'agentStep', 'agentStop', 'activity', 'audit', 'export', 'modelInput',
  'clpFrames', 'clpBundle', 'clpRegisterFrame', 'clpAttest', 'clpRecord', 'clpLink', 'clpQuery']);

export async function serviceCommand(argv, { service: suppliedService, write = text => console.log(text) } = {}) {
  const { values, positionals } = parseArgs({ args: argv, allowPositionals: true, options: {
    conversation: { type: 'string' }, data: { type: 'string', default: '.conclave' },
    input: { type: 'string' }, provider: { type: 'string', default: 'openai' }, model: { type: 'string' },
    reasoning: { type: 'string' }, 'no-jev': { type: 'boolean' }, stream: { type: 'boolean' },
    'max-steps': { type: 'string' }, 'duration-seconds': { type: 'string' }, 'max-tokens': { type: 'string' },
  } });
  const [command, ...args] = positionals;
  if (!serviceCommands.has(command)) throw Error(`Unknown service command: ${command}`);
  const store = suppliedService ? null : new Store(values.data);
  const service = suppliedService || new ConclaveService(store);
  try {
    let input = values.input ? JSON.parse(readFileSync(values.input, 'utf8')) : {};
    const id = values.conversation;
    const settings = { provider: values.provider,
      model: values.model || (values.provider === 'anthropic' ? 'claude-sonnet-5-5' : 'gpt-6-luna'),
      ...(values.reasoning ? { reasoning: values.reasoning } : {}), jev: !values['no-jev'] };
    const onEvent = values.stream ? event => write(JSON.stringify(event)) : null;
    let result;
    if (command === 'call') {
      const [method, inputPath] = args;
      if (!methods.has(method)) throw Error(`Unsupported service method: ${method}`);
      if (inputPath) input = JSON.parse(readFileSync(inputPath, 'utf8'));
      if (method === 'status' || method === 'list') result = await service[method]();
      else if (method === 'create') result = await service.create(input.title);
      else {
        if (!id) throw Error('--conversation ID is required');
        // For reads taking a string, a JSON object names that argument explicitly.
        const argument = method === 'sourceEvent' ? input.event_id : ['contextBundle', 'clpBundle'].includes(method) ? input.bundle_id
          : method === 'workspaceFile' ? input.path : input;
        result = await service[method](id, argument, onEvent ? { onEvent } : undefined);
      }
    } else {
      if (!id) throw Error('--conversation ID is required');
      if (command === 'workspace-upload') result = await service.uploadDocument(id, {
        name: basename(args[0]), content: readFileSync(args[0], 'utf8'),
      });
      else if (command === 'workspace-read') result = service.workspaceFile(id, args[0]);
      else if (command === 'workspace-list') result = service.view(id).workspace;
      else if (command === 'agent-start') {
        const limits = { mode: 'adaptive' };
        for (const [flag, field] of [['max-steps', 'max_steps'], ['duration-seconds', 'duration_seconds'], ['max-tokens', 'max_total_tokens']])
          if (values[flag] !== undefined) { limits.mode = 'fixed'; limits[field] = Number(values[flag]); }
        result = await service.agentStart(id, { message_id: `msg_${randomUUID()}`, content: args.join(' '),
          settings, limits, ...input });
      } else if (command === 'agent-step' || command === 'agent-stop') {
        const agent = service.view(id).agent;
        if (!agent) throw Error('No agent run exists in this conversation');
        result = command === 'agent-step'
          ? await service.agentStep(id, { run_id: agent.run_id, expected_step: agent.steps, ...input }, onEvent ? { onEvent } : undefined)
          : await service.agentStop(id, { run_id: agent.run_id, ...input });
      } else if (command === 'agent-status') result = service.view(id).agent;
      else if (command === 'count-tokens') result = await service.countTokens(id);
      else if (command === 'activity' || command === 'audit') result = service[command](id, input);
      else if (command === 'download') {
        if (!args[0]) throw Error('Download path is required');
        writeFileSync(resolve(args[0]), JSON.stringify(downloadRecord(service, id), null, 2));
        result = { path: resolve(args[0]) };
      } else result = service.view(id);
    }
    write(JSON.stringify(result, null, 2));
    return result;
  } finally { store?.close(); }
}

export async function runServiceCli(argv) {
  try { await serviceCommand(argv); }
  catch (error) { console.error(redact(error)); process.exitCode = 1; }
}
