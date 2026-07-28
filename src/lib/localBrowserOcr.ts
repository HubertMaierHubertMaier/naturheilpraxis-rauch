import workerUrl from "tesseract.js/dist/worker.min.js?url";
import coreLstmUrl from "tesseract.js-core/tesseract-core-lstm.wasm.js?url";
import coreSimdLstmUrl from "tesseract.js-core/tesseract-core-simd-lstm.wasm.js?url";
import coreRelaxedSimdLstmUrl from "tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm.js?url";
import deuModelUrl from "@tesseract.js-data/deu/4.0.0_best_int/deu.traineddata.gz?url";
import engModelUrl from "@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz?url";

export const OCR_INITIALIZATION_TIMEOUT_MS = 60_000;
export const OCR_RECOGNITION_TIMEOUT_MS = 45_000;

export type LocalOcrProgress = {
  status: string;
  progress: number;
};

export type LocalOcrWorker = {
  recognize: (image: HTMLCanvasElement) => Promise<{ data: { text: string } }>;
  terminate: () => Promise<void>;
};

type WorkerResponse = {
  jobId: string;
  status: "resolve" | "reject" | "progress";
  data: unknown;
};

type PendingJob = {
  resolve: (data: unknown) => void;
  reject: (error: Error) => void;
  timeout?: ReturnType<typeof setTimeout>;
};

function assetDirectory(url: string): string {
  return url.slice(0, url.lastIndexOf("/"));
}

function abortError(): DOMException {
  return new DOMException("Lokale OCR wurde abgebrochen.", "AbortError");
}

async function canvasToPngBytes(canvas: HTMLCanvasElement, signal?: AbortSignal): Promise<Uint8Array> {
  if (signal?.aborted) throw abortError();
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      signal?.removeEventListener("abort", onAbort);
      callback();
    };
    const onAbort = () => finish(() => reject(abortError()));
    const timeout = setTimeout(() => finish(() => reject(new Error("Lokale OCR konnte die Canvas-Seite nicht rechtzeitig vorbereiten."))), 10_000);
    signal?.addEventListener("abort", onAbort, { once: true });
    canvas.toBlob((blob) => {
      if (!blob) {
        finish(() => reject(new Error("Lokale OCR konnte die Canvas-Seite nicht vorbereiten.")));
        return;
      }
      blob.arrayBuffer().then(
        (buffer) => finish(() => resolve(new Uint8Array(buffer))),
        (error) => finish(() => reject(error instanceof Error ? error : new Error(String(error)))),
      );
    }, "image/png");
  });
}

export async function createLocalBrowserOcrWorker(
  onProgress?: (progress: LocalOcrProgress) => void,
  signal?: AbortSignal,
): Promise<LocalOcrWorker> {
  const coreAssets = [coreLstmUrl, coreSimdLstmUrl, coreRelaxedSimdLstmUrl];
  const corePath = assetDirectory(coreAssets[0]);
  const deuModelDirectory = assetDirectory(deuModelUrl);
  const engModelDirectory = assetDirectory(engModelUrl);
  const langPath = deuModelDirectory === engModelDirectory ? deuModelDirectory : "/assets/local-ocr";
  if (!coreAssets.every((url) => assetDirectory(url) === corePath)) {
    throw new Error("Lokale OCR-Programmdateien konnten nicht eindeutig aufgelöst werden.");
  }
  if (signal?.aborted) throw abortError();

  // Tesseract 7's public createWorker() hides the native Worker until initialization finishes.
  // Its worker dispatch protocol is marked public; using it directly keeps cleanup reachable.
  const nativeWorker = new Worker(workerUrl);
  const pending = new Map<string, PendingJob>();
  const workerId = "local-ocr";
  let jobCounter = 0;
  let terminated = false;

  const shutdown = (reason: Error) => {
    if (!terminated) {
      terminated = true;
      nativeWorker.terminate();
      signal?.removeEventListener("abort", onAbort);
    }
    for (const job of pending.values()) {
      if (job.timeout) clearTimeout(job.timeout);
      job.reject(reason);
    }
    pending.clear();
  };
  const onAbort = () => shutdown(abortError());
  signal?.addEventListener("abort", onAbort, { once: true });

  nativeWorker.onerror = (event) => {
    event.preventDefault();
    shutdown(new Error("Der lokale OCR-Worker ist unerwartet ausgefallen."));
  };
  nativeWorker.onmessage = ({ data }: MessageEvent<WorkerResponse>) => {
    const job = pending.get(data.jobId);
    if (!job) return;
    if (data.status === "progress") {
      const progress = data.data as Partial<LocalOcrProgress>;
      onProgress?.({ status: String(progress.status || ""), progress: Number(progress.progress || 0) });
      return;
    }
    pending.delete(data.jobId);
    if (job.timeout) clearTimeout(job.timeout);
    if (data.status === "resolve") job.resolve(data.data);
    else job.reject(new Error(String(data.data || "Lokale OCR fehlgeschlagen.")));
  };

  const sendJob = <T>(action: string, payload: unknown, timeoutMs?: number, transfer: Transferable[] = []) => {
    if (terminated) return Promise.reject(new Error("Der lokale OCR-Worker ist nicht mehr verfügbar."));
    const jobId = `local-${++jobCounter}`;
    return new Promise<T>((resolve, reject) => {
      const job: PendingJob = { resolve: (data) => resolve(data as T), reject };
      if (timeoutMs) {
        job.timeout = setTimeout(() => {
          const error = new Error(action === "recognize"
            ? "Zeitüberschreitung bei der lokalen Seitenerkennung."
            : "Zeitüberschreitung beim Start der lokalen OCR.");
          shutdown(error);
        }, timeoutMs);
      }
      pending.set(jobId, job);
      try {
        nativeWorker.postMessage({ workerId, jobId, action, payload }, transfer);
      } catch (error) {
        pending.delete(jobId);
        if (job.timeout) clearTimeout(job.timeout);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  };

  const initializationTimeout = setTimeout(() => shutdown(new Error("Zeitüberschreitung beim Start der lokalen OCR.")), OCR_INITIALIZATION_TIMEOUT_MS);
  try {
    await sendJob("load", { options: { lstmOnly: true, corePath, logging: false } });
    await sendJob("loadLanguage", {
      langs: ["deu", "eng"],
      options: { langPath, cachePath: "local-ocr-v1", cacheMethod: "write", gzip: true, lstmOnly: true },
    });
    await sendJob("initialize", { langs: ["deu", "eng"], oem: 1, config: {} });
    await sendJob("setParameters", {
      params: { tessedit_pageseg_mode: "3", preserve_interword_spaces: "1", user_defined_dpi: "180" },
    });
  } catch (error) {
    shutdown(error instanceof Error ? error : new Error(String(error)));
    throw error;
  } finally {
    clearTimeout(initializationTimeout);
  }

  return {
    async recognize(canvas) {
      const image = await canvasToPngBytes(canvas, signal);
      const data = await sendJob<{ text: string }>(
        "recognize",
        { image, options: {}, output: { text: true } },
        OCR_RECOGNITION_TIMEOUT_MS,
        [image.buffer],
      );
      return { data };
    },
    async terminate() {
      shutdown(abortError());
    },
  };
}
