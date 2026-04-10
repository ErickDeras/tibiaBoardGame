import { createServer } from "http";
import { app } from "./app.js";
import { attachWebSocketServer } from "./realtime/wsHub.js";

const port = Number(process.env.PORT ?? 4000);

const httpServer = createServer(app);
attachWebSocketServer(httpServer);

httpServer.listen(port, () => {
  console.log(`Backend running on http://localhost:${port}`);
});
