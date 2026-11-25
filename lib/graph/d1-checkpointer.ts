// LangGraph checkpointer backed by Cloudflare D1.
// Workers keep no memory between requests, so the graph state (and every
// interrupt() pause) has to live in the database. Tables: graph_checkpoints,
// graph_checkpoint_writes (db/schema.ts). Modeled on MemorySaver from
// @langchain/langgraph-checkpoint.
import type { RunnableConfig } from "@langchain/core/runnables";
import {
  BaseCheckpointSaver,
  type ChannelVersions,
  type Checkpoint,
  type CheckpointListOptions,
  type CheckpointMetadata,
  type CheckpointPendingWrite,
  type CheckpointTuple,
  type PendingWrite,
  WRITES_IDX_MAP,
  compareWritesSortKeys,
  copyCheckpoint,
  getCheckpointId,
  writesSortKey,
} from "@langchain/langgraph-checkpoint";

type CheckpointRow = {
  thread_id: string;
  checkpoint_ns: string;
  checkpoint_id: string;
  parent_checkpoint_id: string | null;
  checkpoint_type: string;
  checkpoint: string;
  metadata_type: string;
  metadata: string;
};

type WriteRow = {
  task_id: string;
  idx: number;
  channel: string;
  value_type: string;
  value: string;
  task_path: string;
};

const textDecoder = new TextDecoder();

/** JSON payloads are stored as text; anything else as base64. */
function encode(type: string, bytes: Uint8Array): string {
  if (type === "json") return textDecoder.decode(bytes);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function decode(type: string, stored: string): string | Uint8Array {
  if (type === "json") return stored;
  return Uint8Array.from(atob(stored), (c) => c.charCodeAt(0));
}

export class D1Checkpointer extends BaseCheckpointSaver {
  constructor(private readonly db: D1Database) {
    super();
  }

  private async load(type: string, stored: string) {
    return this.serde.loadsTyped(type, decode(type, stored));
  }

  private async pendingWrites(threadId: string, ns: string, checkpointId: string): Promise<CheckpointPendingWrite[]> {
    const { results } = await this.db
      .prepare(
        `select task_id, idx, channel, value_type, value, task_path from graph_checkpoint_writes
         where thread_id = ? and checkpoint_ns = ? and checkpoint_id = ?`,
      )
      .bind(threadId, ns, checkpointId)
      .all<WriteRow>();
    const sorted = [...results].sort((a, b) =>
      compareWritesSortKeys(writesSortKey(a.task_path, a.task_id, a.idx), writesSortKey(b.task_path, b.task_id, b.idx)),
    );
    return Promise.all(
      sorted.map(async (w) => [w.task_id, w.channel, await this.load(w.value_type, w.value)] as CheckpointPendingWrite),
    );
  }

  private async toTuple(row: CheckpointRow): Promise<CheckpointTuple> {
    const tuple: CheckpointTuple = {
      config: {
        configurable: { thread_id: row.thread_id, checkpoint_ns: row.checkpoint_ns, checkpoint_id: row.checkpoint_id },
      },
      checkpoint: (await this.load(row.checkpoint_type, row.checkpoint)) as Checkpoint,
      metadata: (await this.load(row.metadata_type, row.metadata)) as CheckpointMetadata,
      pendingWrites: await this.pendingWrites(row.thread_id, row.checkpoint_ns, row.checkpoint_id),
    };
    if (row.parent_checkpoint_id) {
      tuple.parentConfig = {
        configurable: {
          thread_id: row.thread_id,
          checkpoint_ns: row.checkpoint_ns,
          checkpoint_id: row.parent_checkpoint_id,
        },
      };
    }
    return tuple;
  }

  async getTuple(config: RunnableConfig): Promise<CheckpointTuple | undefined> {
    const threadId = config.configurable?.thread_id as string | undefined;
    if (!threadId) return undefined;
    const ns = (config.configurable?.checkpoint_ns as string | undefined) ?? "";
    const checkpointId = getCheckpointId(config);
    const row = checkpointId
      ? await this.db
          .prepare(`select * from graph_checkpoints where thread_id = ? and checkpoint_ns = ? and checkpoint_id = ?`)
          .bind(threadId, ns, checkpointId)
          .first<CheckpointRow>()
      : await this.db
          .prepare(
            `select * from graph_checkpoints where thread_id = ? and checkpoint_ns = ?
             order by checkpoint_id desc limit 1`,
          )
          .bind(threadId, ns)
          .first<CheckpointRow>();
    return row ? this.toTuple(row) : undefined;
  }

  async *list(config: RunnableConfig, options?: CheckpointListOptions): AsyncGenerator<CheckpointTuple> {
    const where: string[] = [];
    const params: unknown[] = [];
    const add = (clause: string, value: unknown) => {
      where.push(clause);
      params.push(value);
    };
    const c = config.configurable ?? {};
    if (c.thread_id !== undefined) add("thread_id = ?", c.thread_id);
    if (c.checkpoint_ns !== undefined) add("checkpoint_ns = ?", c.checkpoint_ns);
    if (c.checkpoint_id) add("checkpoint_id = ?", c.checkpoint_id);
    const before = options?.before?.configurable?.checkpoint_id;
    if (before) add("checkpoint_id < ?", before);

    const sqlText = `select * from graph_checkpoints ${where.length ? `where ${where.join(" and ")}` : ""}
      order by thread_id, checkpoint_ns, checkpoint_id desc`;
    const { results } = await this.db.prepare(sqlText).bind(...params).all<CheckpointRow>();

    let remaining = options?.limit;
    for (const row of results) {
      const tuple = await this.toTuple(row);
      const filter = options?.filter;
      if (filter) {
        const meta = tuple.metadata as Record<string, unknown> | undefined;
        if (!Object.entries(filter).every(([k, v]) => meta?.[k] === v)) continue;
      }
      if (remaining !== undefined) {
        if (remaining <= 0) break;
        remaining -= 1;
      }
      yield tuple;
    }
  }

  async put(
    config: RunnableConfig,
    checkpoint: Checkpoint,
    metadata: CheckpointMetadata,
    // Required by the BaseCheckpointSaver signature; channel versions travel inside the checkpoint.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    newVersions: ChannelVersions,
  ): Promise<RunnableConfig> {
    const threadId = config.configurable?.thread_id as string | undefined;
    if (!threadId) throw new Error("D1Checkpointer.put: missing configurable.thread_id");
    const ns = (config.configurable?.checkpoint_ns as string | undefined) ?? "";
    const [[cpType, cpBytes], [metaType, metaBytes]] = await Promise.all([
      this.serde.dumpsTyped(copyCheckpoint(checkpoint)),
      this.serde.dumpsTyped(metadata),
    ]);
    await this.db
      .prepare(
        `insert or replace into graph_checkpoints
         (thread_id, checkpoint_ns, checkpoint_id, parent_checkpoint_id, checkpoint_type, checkpoint, metadata_type, metadata)
         values (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        threadId,
        ns,
        checkpoint.id,
        (config.configurable?.checkpoint_id as string | undefined) ?? null,
        cpType,
        encode(cpType, cpBytes),
        metaType,
        encode(metaType, metaBytes),
      )
      .run();
    return { configurable: { thread_id: threadId, checkpoint_ns: ns, checkpoint_id: checkpoint.id } };
  }

  async putWrites(config: RunnableConfig, writes: PendingWrite[], taskId: string, taskPath?: string): Promise<void> {
    const threadId = config.configurable?.thread_id as string | undefined;
    const checkpointId = config.configurable?.checkpoint_id as string | undefined;
    if (!threadId || !checkpointId) throw new Error("D1Checkpointer.putWrites: missing thread_id or checkpoint_id");
    const ns = (config.configurable?.checkpoint_ns as string | undefined) ?? "";
    if (!writes.length) return;

    const statements = await Promise.all(
      writes.map(async ([channel, value], i) => {
        const special = WRITES_IDX_MAP[channel as keyof typeof WRITES_IDX_MAP];
        const idx = special ?? i;
        const [type, bytes] = await this.serde.dumpsTyped(value);
        // Special channels (errors, interrupts) are overwritten; regular writes are kept once.
        const verb = special !== undefined ? "insert or replace" : "insert or ignore";
        return this.db
          .prepare(
            `${verb} into graph_checkpoint_writes
             (thread_id, checkpoint_ns, checkpoint_id, task_id, idx, channel, value_type, value, task_path)
             values (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(threadId, ns, checkpointId, taskId, idx, channel, type, encode(type, bytes), taskPath ?? "");
      }),
    );
    await this.db.batch(statements);
  }

  async deleteThread(threadId: string): Promise<void> {
    await this.db.batch([
      this.db.prepare(`delete from graph_checkpoints where thread_id = ?`).bind(threadId),
      this.db.prepare(`delete from graph_checkpoint_writes where thread_id = ?`).bind(threadId),
    ]);
  }
}
