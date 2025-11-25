import { z } from "zod";

const BlockBase = z.object({
  id: z.string(),
  type: z.string()
});

export const WaitBlockSchema = BlockBase.extend({
  type: z.literal("wait"),
  amount: z.number(),
  unit: z.enum(["seconds", "minutes", "hours", "days"])
});

export const WaitUntilBlockSchema = BlockBase.extend({
  type: z.literal("waitUntil"),
  time: z.string(),
  ampm: z.enum(["AM", "PM"])
});

export const PlaySoundBlockSchema = BlockBase.extend({
  type: z.literal("playSound"),
  soundType: z.enum(["default", "url", "upload", "custom"]).optional(),
  label: z.string().optional(),
  customUrl: z.string().optional()
});

export const PlaySoundUntilBlockSchema = BlockBase.extend({
  type: z.literal("playSoundUntil"),
  soundType: z.enum(["default", "url", "upload", "custom"]).optional(),
  label: z.string().optional(),
  customUrl: z.string().optional()
});

export const NotifyBlockSchema = BlockBase.extend({
  type: z.literal("notify"),
  title: z.string(),
  body: z.string().optional()
});

export const NotifyUntilBlockSchema = BlockBase.extend({
  type: z.literal("notifyUntil"),
  title: z.string(),
  body: z.string().optional(),
  label: z.string().optional(),
  timeoutMs: z.number().optional(),
  soundType: z.enum(["default", "url", "upload", "custom"]).optional(),
  customUrl: z.string().optional(),
  interval: z.number().optional(),
  children: z.lazy(() => BlockSchema.array()).optional()
});

export const LoopBlockSchema: z.ZodType<any> = BlockBase.extend({
  type: z.literal("loop"),
  repeat: z.number(),
  children: z.lazy(() => BlockSchema.array())
});

export const BlockSchema: z.ZodType<any> = z.lazy(() =>
  z.union([
    WaitBlockSchema,
    WaitUntilBlockSchema,
    PlaySoundBlockSchema,
    PlaySoundUntilBlockSchema,
    NotifyBlockSchema,
    NotifyUntilBlockSchema,
    LoopBlockSchema
  ])
);

export const StopwatchLogSchema = z.object({
  id: z.string(),
  name: z.string(),
  elapsedMs: z.number(),
  loggedAt: z.number()
});

export const TimerSchema = z.object({
  id: z.string(),
  name: z.string(),
  blocks: BlockSchema.array(),
  mode: z.enum(["alarm", "stopwatch", "simpleStopwatch"]).optional(),
  locked: z.boolean().optional(),
  logs: StopwatchLogSchema.array().optional()
});

export type TimerSchemaType = z.infer<typeof TimerSchema>;
