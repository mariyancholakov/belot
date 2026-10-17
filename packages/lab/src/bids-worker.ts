import { parentPort } from "node:worker_threads";
import { recordBids, type BidJob } from "./bids";

parentPort!.on("message", (job: BidJob) => parentPort!.postMessage(recordBids(job)));
