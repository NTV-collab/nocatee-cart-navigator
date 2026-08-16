import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { bindings } from "../bindings.server";

export type TrailRow = {
  id: number;
  name: string;
  geom: string;
  kind: string;
};

export const listTrails = createServerFn({ method: "GET" }).handler(async () => {
  const { DB } = bindings();
  if (!DB) return { trails: [] };
  const rows = await DB.prepare(
    "SELECT id, name, geom, kind FROM trails ORDER BY id ASC",
  ).all<TrailRow>();
  return { trails: rows.results ?? [] };
});

export const saveTrail = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      name: z.string().max(120).optional(),
      geom: z.string().min(10).max(500000),
      kind: z.enum(["path", "road"]).optional().default("path"),
    }),
  )
  .handler(async ({ data }) => {
    const { DB } = bindings();
    if (!DB) throw new Error("database unavailable");
    const res = await DB.prepare(
      "INSERT INTO trails (name, geom, kind) VALUES (?, ?, ?)",
    )
      .bind(data.name ?? "", data.geom, data.kind ?? "path")
      .run();
    return { id: Number(res.meta.last_row_id) };
  });



export const upsertTrail = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      name: z.string().min(1).max(120),
      geom: z.string().min(10).max(500000),
    }),
  )
  .handler(async ({ data }) => {
    const { DB } = bindings();
    if (!DB) throw new Error("database unavailable");
    await DB.prepare("DELETE FROM trails WHERE name = ?").bind(data.name).run();
    await DB.prepare("INSERT INTO trails (name, geom, kind) VALUES (?, ?, 'path')")
      .bind(data.name, data.geom)
      .run();
    return { ok: true };
  });
export const deleteTrail = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.number() }))
  .handler(async ({ data }) => {
    const { DB } = bindings();
    if (!DB) return { ok: false };
    await DB.prepare("DELETE FROM trails WHERE id = ?").bind(data.id).run();
    return { ok: true };
  });