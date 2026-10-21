
import "dotenv/config";
import app from "./app";
import { prisma } from "./lib/prisma";

const PORT = Number(process.env.PORT) || 8000;

async function startServer() {
  try {
    await prisma.$connect();
    await prisma.$queryRaw`SELECT 1`;

    console.log("Database connection established successfully.");

    app.listen(PORT, () => {
      console.log(
        `BrewAnalytics Backend API is running on port ${PORT}.`
      );
    });
  } catch (error) {
    console.error("Failed to start the server:", error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

startServer();
