import assert from "node:assert/strict";

const sourceConnectionString = process.env.THERAPY_RETRIEVAL_TEST_DATABASE_URL;
assert.ok(sourceConnectionString, "The synthetic PostgreSQL test URL is required");

const restoredFixtureUrl = new URL(sourceConnectionString);
assert.ok(
  restoredFixtureUrl.hostname === "127.0.0.1"
    || restoredFixtureUrl.hostname === "localhost",
  "The failure-isolation probe may use only the local ephemeral PostgreSQL service",
);
restoredFixtureUrl.pathname = "/retrieval_restore";
restoredFixtureUrl.search = "";
restoredFixtureUrl.hash = "";
const targetUrl = new URL(restoredFixtureUrl);
targetUrl.pathname = "/retrieval_failure_isolation";

const { Client } = await import("pg");
const callerCount = 4;
const staleCallerCount = 3;
const applicationName = "therapy-retrieval-step7g-failure-isolation";
const advisoryBarrierKey = 7340032;
const safetyRubricLinks = [{
  therapy_input_fact_id: "93000000-0000-4000-8000-000000000010",
  rubric_revision_id: "42100000-0000-4000-8000-000000000011",
  importance: 1,
  polarity: "include",
}];

async function connect(connectionString) {
  const client = new Client({
    connectionString,
    application_name: applicationName,
  });
  await client.connect();
  await client.query("SET statement_timeout = '30s'");
  await client.query("SET lock_timeout = '10s'");
  await client.query("SET idle_in_transaction_session_timeout = '30s'");
  return client;
}

async function waitForBlockedCallers(client) {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    const result = await client.query(`
      SELECT count(*)::integer AS count
      FROM pg_locks lock_row
      JOIN pg_stat_activity activity ON activity.pid = lock_row.pid
      WHERE activity.application_name = $1
        AND activity.datname = current_database()
        AND lock_row.locktype = 'advisory'
        AND lock_row.mode = 'ShareLock'
        AND NOT lock_row.granted
    `, [applicationName]);
    if (result.rows[0].count === callerCount) return result.rows[0].count;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error("Failure-isolation callers did not reach the PostgreSQL barrier");
}

async function persistAudit(client, fixture, expectedAuditHash, useBarrier = false) {
  const query = useBarrier
    ? `
      WITH start_barrier AS MATERIALIZED (
        SELECT pg_advisory_xact_lock_shared(${advisoryBarrierKey})
      )
      SELECT public.therapy_retrieval_v2_persist_audit_envelope_v1(
        $1::uuid, $2::text, $3::uuid, $4::text, $5::uuid, $6::uuid,
        $7::jsonb, $8::text, $9::text, $10::text, $11::text, $12::text,
        $13::text, $14::uuid, 8, 16, 50
      ) AS value
      FROM start_barrier
    `
    : `
      SELECT public.therapy_retrieval_v2_persist_audit_envelope_v1(
        $1::uuid, $2::text, $3::uuid, $4::text, $5::uuid, $6::uuid,
        $7::jsonb, $8::text, $9::text, $10::text, $11::text, $12::text,
        $13::text, $14::uuid, 8, 16, 50
      ) AS value
    `;
  return (await client.query(query, [
    fixture.therapy_input_revision_id,
    fixture.expected_therapy_input_hash,
    fixture.knowledge_release_id,
    fixture.expected_release_manifest_hash,
    fixture.repertory_entity_id,
    fixture.repertory_revision_id,
    JSON.stringify(safetyRubricLinks),
    fixture.expected_homeopathic_request_hash,
    fixture.expected_split_track_result_hash,
    fixture.expected_safety_gate_result_hash,
    fixture.expected_candidate_status_result_hash,
    fixture.expected_dosage_rule_result_hash,
    expectedAuditHash,
    fixture.persisted_by,
  ])).rows[0].value;
}

function assertInactive(value) {
  for (const field of [
    "productive_candidate_use_allowed",
    "dosage_evaluation_allowed",
    "dosage_display_allowed",
    "audit_persistence_allowed",
    "replay_execution_allowed",
    "shadow_execution_allowed",
    "ai_use_allowed",
    "plan_selection_allowed",
    "medical_use_allowed",
    "activation_allowed",
  ]) {
    assert.equal(value[field], false, `${field} must remain false`);
  }
}

let fixtureReader = await connect(restoredFixtureUrl.toString());
const inspector = await connect(targetUrl.toString());
const callers = [];
let barrierHeld = false;

try {
  const fixtureResult = await fixtureReader.query(`
    SELECT
      run.therapy_input_revision_id::text,
      run.audit_result #>> '{audit_envelope,stage_hashes,therapy_input_manifest_hash}'
        AS expected_therapy_input_hash,
      run.knowledge_release_id::text,
      run.audit_result #>> '{audit_envelope,stage_hashes,release_manifest_hash}'
        AS expected_release_manifest_hash,
      run.repertory_entity_id::text,
      run.repertory_revision_id::text,
      run.audit_result #>> '{audit_envelope,stage_hashes,homeopathic_request_hash}'
        AS expected_homeopathic_request_hash,
      run.audit_result #>> '{audit_envelope,stage_hashes,split_track_result_hash}'
        AS expected_split_track_result_hash,
      run.audit_result #>> '{audit_envelope,stage_hashes,safety_gate_result_hash}'
        AS expected_safety_gate_result_hash,
      run.audit_result #>> '{audit_envelope,stage_hashes,candidate_status_result_hash}'
        AS expected_candidate_status_result_hash,
      run.audit_result #>> '{audit_envelope,stage_hashes,dosage_rule_result_hash}'
        AS expected_dosage_rule_result_hash,
      run.audit_result_hash,
      run.persisted_by::text
    FROM public.therapy_retrieval_audit_runs run
  `);
  assert.equal(fixtureResult.rows.length, 1, "Expected one synthetic audit fixture");
  const fixture = fixtureResult.rows[0];
  for (const [key, value] of Object.entries(fixture)) {
    assert.ok(value, `Synthetic failure-isolation fixture is missing ${key}`);
  }
  await fixtureReader.end();
  fixtureReader = undefined;

  const initialInventory = await inspector.query(`
    SELECT count(*)::integer AS count,
           public.therapy_retrieval_v2_invalid_audit_run_count_v1()::integer
             AS invalid
    FROM public.therapy_retrieval_audit_runs
  `);
  assert.deepEqual(initialInventory.rows[0], { count: 0, invalid: 0 });

  const rollbackCaller = await connect(targetUrl.toString());
  try {
    await rollbackCaller.query("BEGIN");
    const rollbackValue = await persistAudit(
      rollbackCaller,
      fixture,
      fixture.audit_result_hash,
    );
    assert.equal(rollbackValue.status, "RETRIEVAL_AUDIT_PERSISTED_INACTIVE");
    assertInactive(rollbackValue);
    const insideTransaction = await rollbackCaller.query(`
      SELECT count(*)::integer AS count,
             public.therapy_retrieval_v2_invalid_audit_run_count_v1()::integer
               AS invalid
      FROM public.therapy_retrieval_audit_runs
    `);
    assert.deepEqual(insideTransaction.rows[0], { count: 1, invalid: 0 });
  } finally {
    await rollbackCaller.query("ROLLBACK").catch(() => undefined);
    await rollbackCaller.end();
  }

  const afterRollback = await inspector.query(`
    SELECT count(*)::integer AS count,
           public.therapy_retrieval_v2_invalid_audit_run_count_v1()::integer
             AS invalid
    FROM public.therapy_retrieval_audit_runs
  `);
  assert.deepEqual(afterRollback.rows[0], { count: 0, invalid: 0 });

  callers.push(...await Promise.all(
    Array.from({ length: callerCount }, () => connect(targetUrl.toString())),
  ));
  const boundedSessions = await inspector.query(`
    SELECT count(*)::integer AS count
    FROM pg_stat_activity
    WHERE application_name = $1
      AND datname = current_database()
  `, [applicationName]);
  assert.equal(boundedSessions.rows[0].count, callerCount + 1);

  await inspector.query("SELECT pg_advisory_lock($1)", [advisoryBarrierKey]);
  barrierHeld = true;
  const expectedHashes = [
    fixture.audit_result_hash,
    "0".repeat(64),
    "1".repeat(64),
    "2".repeat(64),
  ];
  const calls = callers.map(async (client, index) => {
    const startedAt = Date.now();
    const value = await persistAudit(client, fixture, expectedHashes[index], true);
    return { value, durationMs: Date.now() - startedAt };
  });

  const barrierWaiters = await waitForBlockedCallers(inspector);
  const unlock = await inspector.query(
    "SELECT pg_advisory_unlock($1) AS unlocked",
    [advisoryBarrierKey],
  );
  assert.equal(unlock.rows[0].unlocked, true);
  barrierHeld = false;
  const results = await Promise.allSettled(calls);
  assert.equal(barrierWaiters, callerCount);

  const fulfilled = results.filter((result) => result.status === "fulfilled");
  const rejected = results.filter((result) => result.status === "rejected");
  assert.equal(fulfilled.length, 1);
  assert.equal(rejected.length, staleCallerCount);
  assert.equal(
    fulfilled[0].value.value.status,
    "RETRIEVAL_AUDIT_PERSISTED_INACTIVE",
  );
  assert.equal(
    fulfilled[0].value.value.audit_result_hash,
    fixture.audit_result_hash,
  );
  assertInactive(fulfilled[0].value.value);
  for (const result of rejected) {
    assert.match(
      result.reason instanceof Error ? result.reason.message : String(result.reason),
      /exact ready Step 7A result/,
    );
  }

  const finalState = await inspector.query(`
    SELECT
      count(*)::integer AS count,
      count(DISTINCT audit_result_hash)::integer AS result_hashes,
      bool_and(public.therapy_retrieval_v2_audit_run_is_valid_v1(id)) AS valid,
      public.therapy_retrieval_v2_invalid_audit_run_count_v1()::integer AS invalid
    FROM public.therapy_retrieval_audit_runs
  `);
  assert.deepEqual(finalState.rows[0], {
    count: 1,
    result_hashes: 1,
    valid: true,
    invalid: 0,
  });

  const preflight = (await inspector.query(`
    SELECT public.therapy_retrieval_v2_audit_retention_restore_preflight_v1(
      10000, 67108864
    ) AS value
  `)).rows[0].value;
  assert.equal(
    preflight.status,
    "AUDIT_RETENTION_RESTORE_TECHNICAL_PREFLIGHT_READY_INACTIVE",
  );
  assert.equal(preflight.technical_readiness_complete, true);
  assert.equal(preflight.snapshot_contract_valid, true);
  assert.equal(preflight.append_only_contract_valid, true);
  assert.equal(preflight.restore_fk_contract_valid, true);
  assert.equal(preflight.access_contract_valid, true);
  assert.equal(preflight.retention_policy_approved, false);
  assert.equal(preflight.retention_deletion_allowed, false);
  assert.equal(preflight.operational_restore_drill_completed, false);
  assert.equal(preflight.real_postgres_validation_completed, false);
  assertInactive(preflight);

  const waitingLocks = await inspector.query(`
    SELECT count(*)::integer AS count
    FROM pg_locks lock_row
    JOIN pg_stat_activity activity ON activity.pid = lock_row.pid
    WHERE activity.application_name = $1
      AND activity.datname = current_database()
      AND NOT lock_row.granted
  `, [applicationName]);
  assert.equal(waitingLocks.rows[0].count, 0);

  console.log(JSON.stringify({
    rollback_insert_results: 1,
    rows_after_rollback: afterRollback.rows[0].count,
    mixed_callers: callerCount,
    barrier_waiters: barrierWaiters,
    bounded_sessions: boundedSessions.rows[0].count,
    inserted_results: fulfilled.length,
    rejected_stale_results: rejected.length,
    audit_rows: finalState.rows[0].count,
    invalid_audit_rows: finalState.rows[0].invalid,
    waiting_locks: waitingLocks.rows[0].count,
    max_duration_ms: fulfilled[0].value.durationMs,
    operational_or_medical_approval: false,
  }));
} finally {
  if (barrierHeld) {
    await inspector.query("SELECT pg_advisory_unlock($1)", [advisoryBarrierKey])
      .catch(() => undefined);
  }
  await Promise.all(callers.map((client) => client.end().catch(() => undefined)));
  await fixtureReader?.end().catch(() => undefined);
  await inspector.end().catch(() => undefined);
}
