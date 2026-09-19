// @vitest-environment node
import { readFileSync } from "node:fs";
import { transformSync } from "esbuild";
import { describe, expect, it, vi } from "vitest";
import { clinicalPartialResponseFormat } from "../../supabase/functions/_shared/clinicalPartialResponse";

// Exercise the actual edge-function request loop without starting Deno's server
// or making network calls. Only repository code and synthetic replies are used.
const source = readFileSync(new URL("../../supabase/functions/analyze-documents/index.ts", import.meta.url), "utf8");
const code = transformSync(source.slice(source.indexOf("async function callGatewayText("), source.indexOf("async function streamGatewayHtml(")), { loader: "ts", target: "es2020" }).code;
const makeGateway = (fetcher: typeof fetch) => new Function("fetch", "clinicalPartialResponseFormat", `${code}; return callGatewayText;`)(fetcher, clinicalPartialResponseFormat);
const response = (finish: string, content: string) => new Response(JSON.stringify({
  choices: [{ finish_reason: finish, message: { content } }],
  usage: { completion_tokens: 8000, completion_tokens_details: { reasoning_tokens: 6000 } },
}));

describe("clinical gateway output-limit handling", () => {
  it("never accepts a valid-looking truncated prefix and expands the budget only once", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(response("length", '{"documents":[]}'))
      .mockResolvedValueOnce(response("stop", '{"synthetic":"complete"}'));
    const metadata = vi.fn();
    const result = await makeGateway(fetcher)("synthetic-key", "synthetic-model", "synthetic source", 0.2,
      { clinicalPartial: true, maxTokens: 8000, attempts: 2, onCompletion: metadata });
    expect(result).toBe('{"synthetic":"complete"}');
    expect(fetcher.mock.calls.map(call => JSON.parse(call[1].body).max_tokens)).toEqual([8000, 16000]);
    expect(metadata.mock.calls[0][0]).toMatchObject({ finishReason: "length", outputLimit: 8000, reasoningTokens: 6000 });
    expect(JSON.parse(fetcher.mock.calls[1][1].body).response_format.type).toBe("json_schema");
  });
  it("fails rather than returning incomplete data when the larger budget also truncates", async () => {
    const fetcher = vi.fn().mockImplementation(async () => response("length", '{"documents":[]}'));
    await expect(makeGateway(fetcher)("synthetic", "model", "source", 0.2,
      { clinicalPartial: true, maxTokens: 8000, attempts: 2 })).rejects.toThrow(/Ausgabelimit/);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("does not increase budgets on a complete response", async () => {
    const fetcher = vi.fn().mockResolvedValue(response("stop", '{"synthetic":"complete"}'));
    await makeGateway(fetcher)("synthetic", "model", "source", 0.2, { clinicalPartial: true, maxTokens: 8000, attempts: 2 });
    expect(fetcher).toHaveBeenCalledOnce();
    expect(JSON.parse(fetcher.mock.calls[0][1].body).max_tokens).toBe(8000);
  });
});
