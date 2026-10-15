import { startServer } from "./server";

const port = Number(process.env.PORT ?? 3000);
const server = await startServer({ port });
console.log(`belot server listening on :${server.port}`);
