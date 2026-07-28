import "dotenv/config";
import http from "node:http";
import { createApp } from "./app";
import { initSockets } from "./sockets";
import { startAuctionTicker } from "./ticker/auctionTicker";

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

const app = createApp();
const server = http.createServer(app);

initSockets(server);
startAuctionTicker();

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
