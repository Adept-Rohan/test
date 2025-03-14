
import { connectDB } from "./src/config/database.js";
import app, { insertData } from './app.js'

const PORT = process.env.PORT || 3000;

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`⚡️[server]: Server is running on PORT:${PORT}`);
    console.log('connected database')
    insertData()

  });

  process.on("unhandledRejection", (err) => {
    console.log(`Server halted due to unhandled rejection ${err}`);
  });
})



