import { Router } from "express";
import { getRuleBasedCharges, getRuleBasedChargesForLocation, getVendorsFromRouting } from "../utils/utils.js";


const router = Router(); router.post("/chargeTemplates", async (req, res) => {
  try {
    let additionalInfo: any = req?.body?.additionalInfo || {};
    console.log("Additional info:", additionalInfo);
    try {
      additionalInfo.vendorList = getVendorsFromRouting(req?.body?.loadInfo?.driverOrder, "driver");
    } catch (error) {
      console.error("Error processing vendor list:", error);
      additionalInfo.vendorList = [];
    }


    const [fetchMultiRulesChargesFromProfileGroup, fetchedMultiLocationCharges] = await Promise.all([
      Promise.race([
        getRuleBasedCharges(req?.body?.loadInfo?.driverOrder, additionalInfo),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 60000))
      ]).catch(error => {
        console.error("Error fetching rule based charges:", error);
        return [] as any[];
      }),
      Promise.race([
        getRuleBasedChargesForLocation(req?.body?.loadInfo?.driverOrder, additionalInfo),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 60000))
      ]).catch(error => {
        console.error("Error fetching location charges:", error);
        return [] as any[];
      })
    ]);

    return res.json({
      data: Array.isArray(fetchMultiRulesChargesFromProfileGroup) && Array.isArray(fetchedMultiLocationCharges)
        ? [...fetchMultiRulesChargesFromProfileGroup, ...fetchedMultiLocationCharges]
        : [],
      success: true
    });


  } catch (error: any) {
    console.error("Error in chargeTemplates route:", error);
    res.status(500).json({
      error: error?.message || "Internal server error",
      success: false
    });
  }
});

export default router;