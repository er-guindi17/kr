'use strict';

const form = document.getElementById('simulation-form');
const pinInput = document.getElementById('pin');
const countInput = document.getElementById('count');
const baseNameInput = document.getElementById('base-name');
const startButton = document.getElementById('start-button');
const stopButton = document.getElementById('stop-button');
const clearButton = document.getElementById('clear-button');
const formError = document.getElementById('form-error');
const serverIndicator = document.getElementById('server-indicator');
const serverStatus = document.getElementById('server-status');
const sessionState = document.getElementById('session-state');
const generatedCount = document.getElementById('generated-count');
const pinDisplay = document.getElementById('pin-display');
const progressLabel = document.getElementById('progress-label');
const progressTrack = document.getElementById('progress-track');
const progressFill = document.getElementById('progress-fill');
const participantsTotal = document.getElementById('participants-total');
const participantsList = document.getElementById('participants-list');
const participantsEmpty = document.getElementById('participants-empty');
const eventList = document.getElementById('event-list');
const eventsEmpty = document.getElementById('events-empty');

let serverReady = false;
let currentSessionId = null;
let pollTimer = null;

function showError(message) {
  formError.textContent = message;
  formError.hidden = false;
}

function clearError() {
  formError.textContent = '';
  formError.hidden = true;
}

function updateButtons(running) {
  startButton.disabled = !serverReady || running;
  stopButton.disabled = !running;
  clearButton.disabled = running || !currentSessionId;
}

function statusLabel(status) {
  if (status === 'running') return 'Generando';
  if (status === 'completed') return 'Completado';
  if (status === 'stopped') return 'Detenido';
  return 'Sin sesión';
}

function formatTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--:--:--';
  return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function renderParticipant(participant) {
  const item = document.createElement('li');
  item.className = 'participant-item';

  const avatar = document.createElement('span');
  avatar.className = 'participant-avatar';
  avatar.textContent = String(participant.id).padStart(2, '0');

  const copy = document.createElement('span');
  copy.className = 'participant-copy';
  const name = document.createElement('span');
  name.className = 'participant-name';
  name.textContent = participant.name;
  const status = document.createElement('span');
  status.className = 'participant-status';
  status.textContent = 'simulado';
  copy.append(name, status);
  item.append(avatar, copy);
  return item;
}

function renderEvent(event) {
  const item = document.createElement('li');
  item.className = 'event-item';
  if (event.kind === 'success') item.classList.add('is-success');
  if (event.kind === 'system') item.classList.add('is-system');

  const time = document.createElement('time');
  time.className = 'event-time';
  time.dateTime = event.at;
  time.textContent = formatTime(event.at);
  const message = document.createElement('span');
  message.className = 'event-message';
  message.textContent = event.message;
  item.append(time, message);
  return item;
}

function renderSession(session) {
  currentSessionId = session.id;
  const running = session.status === 'running';
  sessionState.className = 'session-badge';
  if (running) sessionState.classList.add('is-running');
  if (session.status === 'completed') sessionState.classList.add('is-completed');
  if (session.status === 'stopped') sessionState.classList.add('is-stopped');
  sessionState.replaceChildren();
  const dot = document.createElement('span');
  dot.className = 'session-dot';
  const label = document.createElement('span');
  label.textContent = statusLabel(session.status);
  sessionState.append(dot, label);

  generatedCount.replaceChildren();
  generatedCount.append(document.createTextNode(String(session.joined) + ' '));
  const total = document.createElement('small');
  total.textContent = '/ ' + String(session.count);
  generatedCount.append(total);
  pinDisplay.textContent = session.pin;
  participantsTotal.textContent = String(session.joined);

  const percentage = session.count > 0 ? Math.round((session.joined / session.count) * 100) : 0;
  progressLabel.textContent = String(percentage) + '%';
  progressFill.style.width = String(percentage) + '%';
  progressTrack.setAttribute('aria-valuenow', String(percentage));

  participantsList.replaceChildren();
  session.participants.slice().reverse().forEach((participant) => participantsList.append(renderParticipant(participant)));
  participantsEmpty.hidden = session.participants.length > 0;

  eventList.replaceChildren();
  session.events.slice(-24).reverse().forEach((event) => eventList.append(renderEvent(event)));
  eventsEmpty.hidden = session.events.length > 0;

  updateButtons(running);
}

function renderIdle() {
  currentSessionId = null;
  sessionState.className = 'session-badge';
  sessionState.replaceChildren();
  const dot = document.createElement('span');
  dot.className = 'session-dot';
  const label = document.createElement('span');
  label.textContent = 'Sin sesión';
  sessionState.append(dot, label);
  generatedCount.replaceChildren();
  generatedCount.append(document.createTextNode('0 '));
  const total = document.createElement('small');
  total.textContent = '/ 0';
  generatedCount.append(total);
  pinDisplay.textContent = '—';
  participantsTotal.textContent = '0';
  progressLabel.textContent = '0%';
  progressFill.style.width = '0%';
  progressTrack.setAttribute('aria-valuenow', '0');
  participantsList.replaceChildren();
  eventList.replaceChildren();
  participantsEmpty.hidden = false;
  eventsEmpty.hidden = false;
  updateButtons(false);
}

async function readResponse(response) {
  let data;
  try {
    data = await response.json();
  } catch (error) {
    throw new Error('El servidor devolvió una respuesta que no se pudo leer.');
  }
  if (!response.ok) throw new Error(data.error || 'La operación no se completó.');
  return data;
}

function schedulePoll() {
  if (pollTimer) window.clearTimeout(pollTimer);
  pollTimer = window.setTimeout(refreshSession, 320);
}

async function refreshSession() {
  if (!currentSessionId) return;
  const requestedId = currentSessionId;
  try {
    const response = await fetch('/api/simulations/' + encodeURIComponent(requestedId), { cache: 'no-store' });
    const session = await readResponse(response);
    if (currentSessionId !== requestedId) return;
    renderSession(session);
    if (session.status === 'running') schedulePoll();
    else pollTimer = null;
  } catch (error) {
    pollTimer = null;
    showError(error.message || 'Se perdió la conexión con el servidor local.');
  }
}

async function checkHealth() {
  try {
    const response = await fetch('/api/health', { cache: 'no-store' });
    const data = await readResponse(response);
    if (data.externalConnections !== false || data.mode !== 'local-simulation') {
      throw new Error('No se pudo confirmar el modo aislado del servidor.');
    }
    serverReady = true;
    serverIndicator.classList.remove('is-offline');
    serverIndicator.classList.add('is-online');
    serverStatus.textContent = 'Servidor local activo';
    updateButtons(false);
  } catch (error) {
    serverReady = false;
    serverIndicator.classList.remove('is-online');
    serverIndicator.classList.add('is-offline');
    serverStatus.textContent = 'Servidor desconectado';
    updateButtons(false);
    showError('No se pudo comprobar el modo local. Reinicia la aplicación desde la carpeta web-app.');
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearError();
  if (!serverReady) {
    showError('El servidor local no está disponible. Comprueba que la aplicación esté iniciada.');
    return;
  }
  if (!form.reportValidity()) return;

  if (pollTimer) window.clearTimeout(pollTimer);
  pollTimer = null;
  currentSessionId = null;
  startButton.disabled = true;
  stopButton.disabled = true;
  clearButton.disabled = true;

  const payload = {
    pin: pinInput.value.trim(),
    count: countInput.value,
    baseName: baseNameInput.value.trim()
  };

  try {
    const response = await fetch('/api/simulations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const session = await readResponse(response);
    renderSession(session);
    if (session.status === 'running') schedulePoll();
  } catch (error) {
    updateButtons(false);
    showError(error.message || 'No se pudo iniciar el ensayo. Inténtalo de nuevo.');
  }
});

stopButton.addEventListener('click', async () => {
  if (!currentSessionId) return;
  const requestedId = currentSessionId;
  stopButton.disabled = true;
  clearError();
  try {
    const response = await fetch('/api/simulations/' + encodeURIComponent(requestedId) + '/stop', { method: 'POST' });
    const session = await readResponse(response);
    if (currentSessionId === requestedId) renderSession(session);
    if (pollTimer) window.clearTimeout(pollTimer);
    pollTimer = null;
  } catch (error) {
    stopButton.disabled = false;
    showError(error.message || 'No se pudo detener el ensayo.');
  }
});

clearButton.addEventListener('click', () => {
  if (clearButton.disabled) return;
  if (pollTimer) window.clearTimeout(pollTimer);
  pollTimer = null;
  clearError();
  form.reset();
  renderIdle();
});

renderIdle();
checkHealth();