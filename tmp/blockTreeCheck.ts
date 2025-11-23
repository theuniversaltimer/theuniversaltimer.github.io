import { applyExistingDrop, buildDropId, parseDropId } from "../src/components/editor/blockTree.ts";
import type { Block } from "../src/types.ts";

const blocks: Block[] = [
  { id: "a", type: "wait", amount: 5, unit: "seconds" },
  { id: "b", type: "wait", amount: 10, unit: "seconds" },
  { id: "c", type: "wait", amount: 15, unit: "seconds" }
];

const dropId = buildDropId("b", "after");
const drop = parseDropId(dropId)!;
const next = applyExistingDrop(blocks, "a", drop);
console.log(next.map((b) => b.id));
