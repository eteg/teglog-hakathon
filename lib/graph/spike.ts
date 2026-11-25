// T01 spike: proves LangGraph.js runs on the Worker and that interrupt()
// survives between two HTTP requests through the D1 checkpointer.
// Remove once the incident graph (T12) is in place.
import { Annotation, END, START, StateGraph, interrupt } from "@langchain/langgraph";
import type { BaseCheckpointSaver } from "@langchain/langgraph-checkpoint";

const SpikeState = Annotation.Root({
  value: Annotation<number>(),
  needsReview: Annotation<boolean>(),
  approved: Annotation<boolean | null>(),
});

export function buildSpikeGraph(checkpointer: BaseCheckpointSaver) {
  return new StateGraph(SpikeState)
    .addNode("decide_review", (s) => ({ needsReview: s.value > 10_000 }))
    .addNode("human_review", () => {
      const answer = interrupt<{ question: string }, { approve: boolean }>({ question: "Approve?" });
      return { approved: answer.approve };
    })
    .addEdge(START, "decide_review")
    .addConditionalEdges("decide_review", (s) => (s.needsReview ? "human_review" : END), ["human_review", END])
    .addEdge("human_review", END)
    .compile({ checkpointer });
}
