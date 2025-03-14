import { Types } from "mongoose";
import { ProfileType, VendorTypes } from "../constants/constants.js";
import { ChargeTemplateModel } from "../models/chargeTemplate.js";
import _ from "lodash";



export const queryForVendorValidityCheck = (payloadData: any): any => {
  const { owner, groupIds, vendorList, vendorType } = payloadData;
  console.log("Query params:", { owner, groupIds, vendorList, vendorType }); let criteria: any = {
    owner,
    isDeleted: { $ne: true },
    chargeTemplateGroupID: { $in: [new Types.ObjectId("66729ed844d8b882ea14817c")] },
  }; if (vendorType === VendorTypes.DRIVER) {
    criteria = {
      ...criteria,
      $or: [
        {
          vendorProfileType: {
            $in: [vendorType, ProfileType.DRIVER_GROUP],
          },
          vendorId: {
            $in: [...(vendorList ?? []), ...(groupIds ?? [])]?.filter(Boolean),
          },
        },
        {
          vendorProfileType: ProfileType.ALL_DRIVER_GROUP,
        },
      ],
    };
  } if (vendorType === VendorTypes.CARRIER) {
    criteria = {
      ...criteria,
      vendorProfileType: {
        $in: [vendorType, ProfileType.CARRIER_GROUP],
      },
      vendorId: {
        $in: [...(vendorList ?? []), ...(groupIds ?? [])]?.filter(Boolean),
      },
    };
  } console.log("Final query criteria:", JSON.stringify(criteria, null, 2));
  return criteria;
};



export const getRuleBasedCharges = async (routing?: any, additionalInfo?: any): Promise<any[]> => {
  let groupIds: string[] = [];

  additionalInfo?.vendorList?.forEach((singleVendor: string) => {
    const groupForVendor = additionalInfo?.groupInformation?.vendor?.[singleVendor];
    groupIds = [...groupIds, ...(groupForVendor ?? [])];
  });

  const payloadForQueryMaker = {
    owner: additionalInfo?.owner,
    groupIds,
    vendorList: additionalInfo?.vendorList,
    vendorType: additionalInfo?.vendorType,
  };
  const validityCheckQuery = queryForVendorValidityCheck(payloadForQueryMaker);
  let finalQuery = { ...validityCheckQuery };

  const countQuery = { ...finalQuery, "multiQueryIndex.0": { $exists: true } };
  const chargeTemplateCount: any = await ChargeTemplateModel.findOne(countQuery).lean();
  if (!chargeTemplateCount) return [];
  const queryForRouting = findCombination(routing, additionalInfo?.groupInformation);
  const orCriteria = finalQuery?.$or;
  delete finalQuery?.$or;

  finalQuery = {
    ...finalQuery,
    moveType: { $ne: "BY_LEG" },
    $and: [{ $or: queryForRouting?.map((singleRoutingQuery: any) => ({ multiQueryIndex: singleRoutingQuery })) }],
  };

  if (orCriteria) {
    finalQuery.$and.push({ $or: orCriteria });
  }

  return await ChargeTemplateModel.find(finalQuery).lean();
};

const findCombination = (driverOrders = [], groupInformation: any) => {
  const minWindowSize = 2;
  let totalCombinations = [];

  for (let frame = minWindowSize; frame <= driverOrders.length; frame++) {
    let iterations = driverOrders.length - frame + 1;
    for (let i = 0; i < iterations; i++) {
      const slicedOrder = driverOrders.slice(i, i + frame);
      // find the combination of the slicedOrder
      const combination = getCombination(slicedOrder, groupInformation);
      totalCombinations.push(combination);
    }
  }

  const flatTotalCombination = totalCombinations.flat();

  return flatTotalCombination?.map((singleCombination: any) => singleCombination?.filter(Boolean));
};

const getCombination = (slicedOrder: any = [], groupInformation: any) => {
  // Define possible profile attributes for each order
  const combinations: any = [];

  // Helper function to recursively generate combinations
  const generateCombinations = (index: any, currentCombination: any) => {
    const profileGroup = _.uniq(
      groupInformation?.profile?.[slicedOrder?.[index]?.customerId?._id ?? slicedOrder?.[index]?.customerId ?? ""],
    );
    const zipCodeGroup = _.uniq(
      groupInformation?.zipCode?.[slicedOrder?.[index]?.customerId?._id ?? slicedOrder?.[index]?.customerId ?? ""],
    );
    const cityStateGroup = _.uniq(
      groupInformation?.cityState?.[slicedOrder?.[index]?.customerId?._id ?? slicedOrder?.[index]?.customerId ?? ""],
    );

    if (index === slicedOrder?.length) {
      // If we've handled all orders, add the current combination to results
      combinations.push([...currentCombination]);
      return;
    }

    // For each order, create a new combination for each possible profile attribute
    // Use customerId
    if (slicedOrder[index].customerId?._id || slicedOrder[index].customerId) {
      generateCombinations(index + 1, [
        ...currentCombination,
        `${slicedOrder[index].type}-${slicedOrder[index].customerId?._id ?? slicedOrder[index].customerId}`,
      ]);
    }

    // Use cityState
    if (slicedOrder[index].city && slicedOrder[index].state) {
      generateCombinations(index + 1, [
        ...currentCombination,
        `${slicedOrder[index].type}-${slicedOrder[index].city},${slicedOrder[index].state}`,
      ]);
    }

    // Use zip_code
    if (slicedOrder[index].zip_code) {
      generateCombinations(index + 1, [
        ...currentCombination,
        `${slicedOrder[index].type}-${slicedOrder[index].zip_code}`,
      ]);
    }

    // only types
    generateCombinations(index + 1, [...currentCombination, `${slicedOrder[index].type}`]);

    // Profile Group
    if (profileGroup?.length) {
      profileGroup.forEach((singleProfile: any) => {
        generateCombinations(index + 1, [...currentCombination, `${slicedOrder[index].type}-${singleProfile}`]);
      });
    }

    // All Customer
    generateCombinations(index + 1, [...currentCombination, `${slicedOrder[index].type}-${ProfileType.ALL_CUSTOMER}`]);

    // city state group
    if (cityStateGroup?.length) {
      cityStateGroup.forEach((singleProfile: any) => {
        generateCombinations(index + 1, [...currentCombination, `${slicedOrder[index].type}-${singleProfile}`]);
      });
    }

    // zip code group
    if (zipCodeGroup?.length) {
      zipCodeGroup.forEach((singleProfile: any) => {
        generateCombinations(index + 1, [...currentCombination, `${slicedOrder[index].type}-${singleProfile}`]);
      });
    }
  };

  // Start the recursive generation with the first order
  generateCombinations(0, []);

  return combinations;
};

export const getRuleBasedChargesForLocation = async (routing?: any, additionalInfo?: any): Promise<any[]> => {
  try {
    console.log("Starting getRuleBasedChargesForLocation with routing:", routing?.length, "orders"); let groupIds: string[] = []; additionalInfo?.vendorList?.forEach((singleVendor: string) => {
      const groupForVendor = additionalInfo?.groupInformation?.vendor?.[singleVendor];
      groupIds = [...groupIds, ...(groupForVendor ?? [])];
    }); const payloadForQueryMaker = {
      owner: additionalInfo?.owner,
      groupIds,
      vendorList: additionalInfo?.vendorList,
      vendorType: additionalInfo?.vendorType,
    }; const validityCheckQuery = queryForVendorValidityCheck(payloadForQueryMaker);
    let finalQuery = { ...validityCheckQuery };    // Add index hint for better performance
    const countQuery = { ...finalQuery, "multiQueryIndex.0": { $exists: true } };
    console.log("Count query:", JSON.stringify(countQuery, null, 2)); const chargeTemplateCount: any = await ChargeTemplateModel.findOne(countQuery).lean();
    console.log("Found charge template count:", chargeTemplateCount ? "Yes" : "No"); if (!chargeTemplateCount) return []; const queryForRouting = findLocationCombination(routing, additionalInfo?.groupInformation);
    console.log("Generated location combinations:", queryForRouting?.length); if (!queryForRouting?.length) {
      console.log("No location combinations found, returning empty array");
      return [];
    } const orCriteria = finalQuery?.$or;
    delete finalQuery?.$or; finalQuery = {
      ...finalQuery,
      moveType: { $ne: "BY_LEG" },
      $and: [{ $or: queryForRouting?.map((singleRoutingQuery: any) => ({ multiQueryIndex: singleRoutingQuery })) }],
    }; if (orCriteria) {
      finalQuery.$and.push({ $or: orCriteria });
    } console.log("Final query:", JSON.stringify(finalQuery, null, 2));    // Add lean() and limit for better performance
    const results = await ChargeTemplateModel.find(finalQuery)
      .lean()
      .limit(1000)
      .exec(); console.log("Found results:", results.length);
    return results;
  } catch (error) {
    console.error("Error in getRuleBasedChargesForLocation:", error);
    return [];
  }
};

const findLocationCombination = (driverOrders = [], groupInformation: any) => {
  try {
    const minWindowSize = 2;
    let totalCombinations = [];    // Dynamically adjust limits based on input size
    const inputSize = driverOrders?.length || 0;
    const MAX_WINDOW_SIZE = Math.min(inputSize, 5); // Allow larger windows for smaller inputs
    const MAX_ITERATIONS = Math.min(inputSize, 10); // Allow more iterations for smaller inputs
    const MAX_COMBINATIONS_PER_WINDOW = 100; // Limit combinations per window    // Limit the number of orders we process based on input size
    const limitedOrders = driverOrders.slice(0, Math.min(inputSize, 10)); console.log("Processing location combinations with:", {
      inputSize,
      maxWindowSize: MAX_WINDOW_SIZE,
      maxIterations: MAX_ITERATIONS,
      limitedOrdersLength: limitedOrders.length
    }); for (let frame = minWindowSize; frame <= MAX_WINDOW_SIZE; frame++) {
      let iterations = Math.min(limitedOrders.length - frame + 1, MAX_ITERATIONS);
      for (let i = 0; i < iterations; i++) {
        const slicedOrder = limitedOrders.slice(i, i + frame);
        // find the combination of the slicedOrder
        const combination = getLocationCombination(slicedOrder, groupInformation, MAX_COMBINATIONS_PER_WINDOW);
        if (combination?.length > 0) {
          totalCombinations.push(combination);
        }
      }
    } const flatTotalCombination = totalCombinations.flat();
    const result = flatTotalCombination?.map((singleCombination: any) => singleCombination?.filter(Boolean)); console.log("Generated location combinations:", {
      totalCombinations: totalCombinations.length,
      flatCombinations: flatTotalCombination?.length,
      finalResult: result?.length
    }); return result;
  } catch (error) {
    console.error("Error in findLocationCombination:", error);
    return [];
  }
};

const getLocationCombination = (slicedOrder: any = [], groupInformation: any, maxCombinations: number = 100) => {
  try {
    // Define possible profile attributes for each order
    const combinations: any = [];
    const MAX_COMBINATIONS = maxCombinations; // Use passed limit    // Helper function to recursively generate combinations
    const generateCombinations = (index: any, currentCombination: any) => {
      // Check if we've exceeded the maximum combinations
      if (combinations.length >= MAX_COMBINATIONS) {
        return;
      } const profileGroup = _.uniq(
        groupInformation?.profile?.[slicedOrder?.[index]?.customerId?._id ?? slicedOrder?.[index]?.customerId ?? ""],
      );
      const zipCodeGroup = _.uniq(
        groupInformation?.zipCode?.[slicedOrder?.[index]?.customerId?._id ?? slicedOrder?.[index]?.customerId ?? ""],
      );
      const cityStateGroup = _.uniq(
        groupInformation?.cityState?.[slicedOrder?.[index]?.customerId?._id ?? slicedOrder?.[index]?.customerId ?? ""],
      ); if (index === slicedOrder?.length) {
        // If we've handled all orders, add the current combination to results
        combinations.push([...currentCombination]);
        return;
      }      // Use customerId for location only
      if (slicedOrder[index].customerId?._id || slicedOrder[index].customerId) {
        generateCombinations(index + 1, [
          ...currentCombination,
          `${slicedOrder[index].customerId?._id ?? slicedOrder[index].customerId}`,
        ]);
      }      // Use cityState for location only
      if (slicedOrder[index].city && slicedOrder[index].state) {
        generateCombinations(index + 1, [
          ...currentCombination,
          `${slicedOrder[index].city},${slicedOrder[index].state}`,
        ]);
      }      // Use zip_code for location only
      if (slicedOrder[index].zip_code) {
        generateCombinations(index + 1, [...currentCombination, `${slicedOrder[index].zip_code}`]);
      }      // All Customer for location only
      generateCombinations(index + 1, [...currentCombination, `${ProfileType.ALL_CUSTOMER}`]);      // Profile Group for location only - limit the number of combinations
      if (profileGroup?.length) {
        profileGroup.slice(0, 5).forEach((singleProfile) => {
          generateCombinations(index + 1, [...currentCombination, `${singleProfile}`]);
        });
      }      // city state group for location only - limit the number of combinations
      if (cityStateGroup?.length) {
        cityStateGroup.slice(0, 5).forEach((singleProfile) => {
          generateCombinations(index + 1, [...currentCombination, `${singleProfile}`]);
        });
      }      // zip code group for location only - limit the number of combinations
      if (zipCodeGroup?.length) {
        zipCodeGroup.slice(0, 5).forEach((singleProfile) => {
          generateCombinations(index + 1, [...currentCombination, `${singleProfile}`]);
        });
      }
    };    // Start the recursive generation with the first order
    generateCombinations(0, []); return combinations;
  } catch (error) {
    console.error("Error in getLocationCombination:", error);
    return [];
  }
};

export const getVendorsFromRouting = (loadRoutingData: any, vendorType: string): string[] => {
  let vendorProperty: string;
  switch (vendorType) {
    case VendorTypes.DRIVER:
      vendorProperty = "driver";
      break;
    case VendorTypes.CARRIER:
      vendorProperty = "drayosCarrier";
      break;
    // Add more cases if needed
    default:
      // Handle the default case if necessary
      break;
  }  return Array.from(
    new Set(
      loadRoutingData?.map((item: any) => item?.[vendorProperty]?._id ?? item?.[vendorProperty])?.filter(Boolean),
    ),
  );
};
