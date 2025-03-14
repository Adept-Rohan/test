import mongoose from "mongoose";
import { ChargeTemplateSchema } from "../schema/chargeTemplate.schema.js";

export const ChargeTemplateModel = mongoose.model("ChargeTemplate", ChargeTemplateSchema);
