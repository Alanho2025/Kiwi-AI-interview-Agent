const sessions = new Map();

export const createSession = (data) => {
  const id = 'KV-' + Date.now();
  const session = {
    id,
    ...data,
    status: 'ready',
    transcript: [],
    elapsedSeconds: 0,
    lastResumedAt: null,
  };
  sessions.set(id, session);
  return session;
};

export const getSessionById = (id) => {
  return sessions.get(id);
};

export const updateSession = (id, data) => {
  const session = sessions.get(id);
  if (session) {
    Object.assign(session, data);
    sessions.set(id, session);
  }
  return session;
};
