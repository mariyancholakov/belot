import { parentPort } from "node:worker_threads";
import { runJob, type Job } from "./match";

parentPort!.on("message", (job: Job) => parentPort!.postMessage(runJob(job)));
