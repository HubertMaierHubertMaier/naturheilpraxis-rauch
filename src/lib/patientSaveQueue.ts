export function createPatientSaveQueue() {
  const pending = new Map<string, Promise<void>>();
  return {
    run<T>(pseudonymId: string, save: () => Promise<T>): Promise<T> {
      const previous = pending.get(pseudonymId) || Promise.resolve();
      const operation = previous.then(save);
      const settled = operation.then(() => undefined, () => undefined);
      pending.set(pseudonymId, settled);
      void settled.then(() => { if (pending.get(pseudonymId) === settled) pending.delete(pseudonymId); });
      return operation;
    },
  };
}

// Shared across component remounts. Only write promises are retained, never case data.
export const patientDraftSaveQueue = createPatientSaveQueue();
