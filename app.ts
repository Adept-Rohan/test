import dotenv from "dotenv";
dotenv.config();
import fs from "fs";
import path from "path";
import express from "express";
import routes from './src/routes/index';
import { ChargeTemplateModel } from "./src/models/chargeTemplate.ts";
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { ProfileType } from "./src/constants/constants";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use("/api", routes);


export default app


export async function insertData() {
    try {
        const filePath = path.join(__dirname, 'data', 'database', 'db.data.json');
        if (!fs.existsSync(filePath)) {
            console.error(`File not found: ${filePath}`);
            return;
        }

        const rawData = fs.readFileSync(filePath, 'utf8');
        const data = JSON.parse(rawData);

        function transformIds(dataArray: ProfileType[]) {
            return dataArray.map(item =>
                JSON.parse(
                    JSON.stringify(item)
                        .replace(/"\$oid":\s*"(.*?)"/g, '"_id": "$1"')

                )
            );
        }

        const transformedData = transformIds(data);

        if (transformedData.length > 0) {
            await ChargeTemplateModel.insertMany(transformedData);
            console.log(`${transformedData.length} documents inserted.`);
        } else {
            console.log("No data to insert.");
        }

    } catch (err) {
        console.error("Error inserting data:", err);
    }
}
