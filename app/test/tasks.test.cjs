const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const path = require('node:path');

function fixture() {
  const docs = new Map([['families/f/tasks/t', { isActive: true }]]);
  const revisions = new Map();
  let nextId = 0;
  const deleted = Symbol('deleted');
  const ref = (...parts) => ({ path: parts.join('/'), id: parts[parts.length - 1] });
  const snapshot = (document) => ({ exists: () => docs.has(document.path), data: () => ({ ...docs.get(document.path) }) });
  const firestore = {
    doc: (first, ...parts) => first.path && !parts.length ? ref(first.path, `id${++nextId}`) : ref(...parts),
    collection: (_db, ...parts) => ref(...parts),
    Timestamp: { now: () => 'now' }, deleteField: () => deleted,
    query: (collection, ...filters) => ({ collection, filters }), where: (...args) => args,
    getDocs: async ({ collection, filters }) => ({ empty: ![...docs.entries()].some(([key, value]) => key.startsWith(`${collection.path}/`) && filters.every(([field, operator, wanted]) => operator === 'in' ? wanted.includes(value[field]) : value[field] === wanted)) }),
    runTransaction: async (_db, callback) => {
      for (let attempt = 0; attempt < 10; attempt++) {
        const reads = new Map(); const writes = [];
        const transaction = {
          get: async (document) => { assert.equal(writes.length, 0, 'Reads must precede writes'); reads.set(document.path, revisions.get(document.path) || 0); return snapshot(document); },
          set: (document, data) => writes.push([document, data, false]),
          update: (document, data) => writes.push([document, data, true]),
        };
        const value = await callback(transaction);
        if ([...reads].some(([key, revision]) => (revisions.get(key) || 0) !== revision)) continue;
        for (const [document, data, merge] of writes) {
          const updated = merge ? { ...docs.get(document.path), ...data } : { ...data };
          for (const [key, value] of Object.entries(updated)) if (value === deleted) delete updated[key];
          docs.set(document.path, updated); revisions.set(document.path, (revisions.get(document.path) || 0) + 1);
        }
        return value;
      }
      throw new Error('Too many transaction retries');
    },
  };
  const module = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/services/tasks.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(source, { module, exports: module.exports, require: (name) => {
    if (name === 'firebase/firestore') return firestore;
    if (name === './firebase') return { db: {} };
    if (name === './firestore') return { taskDocRef: (f, t) => ref('families', f, 'tasks', t), taskClaimDocRef: (f, c) => ref('families', f, 'taskClaims', c), taskClaimsRef: (f) => ref('families', f, 'taskClaims') };
    throw new Error(`Unexpected import ${name}`);
  } });
  return { services: module.exports, docs };
}

test('simultaneous children claiming a quest produce exactly one active claim', async () => {
  const f = fixture();
  const results = await Promise.allSettled([f.services.claimTask('f', 't', 'c1'), f.services.claimTask('f', 't', 'c2')]);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(results.find((r) => r.status === 'rejected').reason.code, 'ALREADY_CLAIMED');
  assert.equal([...f.docs.keys()].filter((p) => p.includes('/taskClaims/')).length, 1);
});
test('releasing a quest clears its lock and permits another child to claim it', async () => {
  const f = fixture(); const first = await f.services.claimTask('f', 't', 'c1');
  await f.services.releaseTask('f', first);
  assert.equal(f.docs.get(`families/f/taskClaims/${first}`).status, 'released');
  assert.equal(f.docs.get('families/f/tasks/t').activeClaimId, undefined);
  const second = await f.services.claimTask('f', 't', 'c2'); assert.notEqual(first, second);
});
test('submitted quests cannot be released before parent review', async () => {
  const f = fixture(); const claim = await f.services.claimTask('f', 't', 'c1');
  f.docs.set(`families/f/taskClaims/${claim}`, { taskId: 't', status: 'submitted' });
  await assert.rejects(f.services.releaseTask('f', claim), /unfinished/);
  assert.equal(f.docs.get('families/f/tasks/t').activeClaimId, claim);
});
test('approve-all makes no partial changes when one claim is no longer submitted', async () => {
  const f = fixture();
  f.docs.set('families/f/taskClaims/a', { status: 'submitted' });
  f.docs.set('families/f/taskClaims/b', { status: 'released' });
  await assert.rejects(f.services.reviewTaskClaims('f', ['a', 'b'], 'approved'), /queue changed/);
  assert.equal(f.docs.get('families/f/taskClaims/a').status, 'submitted');
});
test('reviewing submitted quests persists approvals and rejection feedback', async () => {
  const f = fixture();
  f.docs.set('families/f/taskClaims/a', { status: 'submitted' });
  f.docs.set('families/f/taskClaims/b', { status: 'submitted' });
  await f.services.reviewTaskClaims('f', ['a', 'a'], 'approved');
  await f.services.reviewTaskClaims('f', ['b'], 'rejected', '  Please finish the corners  ');
  assert.equal(f.docs.get('families/f/taskClaims/a').status, 'approved');
  assert.equal(f.docs.get('families/f/taskClaims/b').rejectionReason, 'Please finish the corners');
});

test('rejected claims can resubmit but approved and submitted claims cannot', async () => {
  const f = fixture();
  const claim = await f.services.claimTask('f', 't', 'c1');
  f.docs.get(`families/f/taskClaims/${claim}`).status = 'rejected';
  await f.services.submitTaskCompletion('f', claim);
  assert.equal(f.docs.get(`families/f/taskClaims/${claim}`).status, 'submitted');
  await assert.rejects(f.services.submitTaskCompletion('f', claim), /Only an active quest/);
  f.docs.get(`families/f/taskClaims/${claim}`).status = 'approved';
  await assert.rejects(f.services.submitTaskCompletion('f', claim), /Only an active quest/);
});
