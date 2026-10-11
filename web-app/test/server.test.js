'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('../main');

async function startTestServer(t) {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));
  return 'http://127.0.0.1:' + address.port;
}

async function postJson(url, value) {
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(value)
  });
}

test('health reports an isolated simulator with no external connections', async (t) => {
  const baseUrl = await startTestServer(t);
  const response = await fetch(baseUrl + '/api/health');
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    status: 'ok',
    mode: 'local-simulation',
    externalConnections: false
  });
});

test('rejects invalid PINs and participant limits', async (t) => {
  const baseUrl = await startTestServer(t);
  const badPin = await postJson(baseUrl + '/api/simulations', { pin: 'not-a-pin', count: 2, baseName: 'Test' });
  assert.equal(badPin.status, 400);
  assert.match((await badPin.json()).error, /PIN de práctica/);

  const badCount = await postJson(baseUrl + '/api/simulations', { pin: '123456', count: 101, baseName: 'Test' });
  assert.equal(badCount.status, 400);
  assert.match((await badCount.json()).error, /entre 1 y 100/);
});

test('creates participants locally, reports completion, and exposes a working stop route', async (t) => {
  const baseUrl = await startTestServer(t);
  const created = await postJson(baseUrl + '/api/simulations', { pin: '123456', count: 3, baseName: 'Equipo' });
  assert.equal(created.status, 201);
  const initial = await created.json();
  assert.equal(initial.status, 'running');
  assert.equal(initial.joined, 0);
  assert.equal(initial.participants.length, 0);

  await new Promise((resolve) => setTimeout(resolve, 700));
  const completedResponse = await fetch(baseUrl + '/api/simulations/' + initial.id);
  const completed = await completedResponse.json();
  assert.equal(completed.status, 'completed');
  assert.equal(completed.participants.length, 3);
  assert.equal(completed.participants[0].name, 'Equipo_1');
  assert.ok(completed.events.some((event) => event.message.includes('simulado')));

  const stoppableResponse = await postJson(baseUrl + '/api/simulations', { pin: '987654', count: 100, baseName: 'Prueba' });
  const stoppable = await stoppableResponse.json();
  const stopResponse = await fetch(baseUrl + '/api/simulations/' + stoppable.id + '/stop', { method: 'POST' });
  assert.equal(stopResponse.status, 200);
  assert.equal((await stopResponse.json()).status, 'stopped');
});

test('serves the web interface and refuses traversal outside the public folder', async (t) => {
  const baseUrl = await startTestServer(t);
  const page = await fetch(baseUrl + '/');
  assert.equal(page.status, 200);
  assert.match(await page.text(), /Modo aislado/);
  assert.ok(page.headers.get('content-security-policy'));

  const missing = await fetch(baseUrl + '/%2e%2e/server.js');
  assert.notEqual(missing.status, 200);
});