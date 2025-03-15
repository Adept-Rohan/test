import { Types } from "mongoose";
import { ProfileType, VendorTypes } from "../constants/constants.js";
import { ChargeTemplateModel } from "../models/chargeTemplate.js";
import _ from "lodash";


export const queryForVendorValidityCheck = (payloadData: any): any => {
  const { owner, groupIds, vendorList, vendorType } = payloadData;

  let criteria: any = {
    owner,
    isDeleted: { $ne: true },
    chargeTemplateGroupID: { $in: [new Types.ObjectId("66729ed844d8b882ea14817c")] },
  };

  if (vendorType === VendorTypes.DRIVER) {
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
  }
  return criteria;
};



export const getRuleBasedCharges = async (routing?: any, additionalInfo?: any): Promise<any[]> => {
  try {
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

    if (!queryForRouting?.length) {
      return [];
    }

    const orCriteria = finalQuery?.$or;
    delete finalQuery?.$or;

    finalQuery = {
      ...finalQuery,
      moveType: { $ne: "BY_LEG" },
      $and: [{ $or: queryForRouting?.map((singleRoutingQuery: any) => ({ multiQueryIndex: singleRoutingQuery })) }],
    }; if (orCriteria) {
      finalQuery.$and.push({ $or: orCriteria });
    }

    const results = await ChargeTemplateModel.find(finalQuery)
      .lean()

    return results;

  } catch (error) {
    return [];
  }
};

const findCombination = (driverOrders = [], groupInformation: any) => {
  try {

    const minWindowSize = 2;
    let totalCombinations = [];
    const inputSize = driverOrders?.length || 0;

    const MAX_WINDOW_SIZE = Math.min(inputSize, 5);
    const MAX_ITERATIONS = Math.min(inputSize, 10);
    const MAX_COMBINATIONS_PER_WINDOW = 100;
    const limitedOrders = driverOrders.slice(0, Math.min(inputSize, 10));


    for (let frame = minWindowSize; frame <= MAX_WINDOW_SIZE; frame++) {
      let iterations = Math.min(limitedOrders.length - frame + 1, MAX_ITERATIONS);
      for (let i = 0; i < iterations; i++) {
        const slicedOrder = limitedOrders.slice(i, i + frame);
        const combination = getCombination(slicedOrder, groupInformation, MAX_COMBINATIONS_PER_WINDOW);
        if (combination?.length > 0) {
          totalCombinations.push(combination);
        }
      }
    }

    const flatTotalCombination = totalCombinations.flat();

    const result = flatTotalCombination?.map((singleCombination: any) => singleCombination?.filter(Boolean));

    return result;

  } catch (error) {
    return [];
  }
};

const getCombination = (slicedOrder: any = [], groupInformation: any, maxCombinations: number = 100) => {
  try {
    // Define possible profile attributes for each order
    const combinations: any = [];
    const MAX_COMBINATIONS = maxCombinations;

    const generateCombinations = (index: any, currentCombination: any) => {
      if (combinations.length >= MAX_COMBINATIONS) {
        return;
      }

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
      }      // For each order, create a new combination for each possible profile attribute
      // Use customerId
      if (slicedOrder[index].customerId?._id || slicedOrder[index].customerId) {
        generateCombinations(index + 1, [
          ...currentCombination,
          `${slicedOrder[index].type}-${slicedOrder[index].customerId?._id ?? slicedOrder[index].customerId}`,
        ]);
      }      // Use cityState
      if (slicedOrder[index].city && slicedOrder[index].state) {
        generateCombinations(index + 1, [
          ...currentCombination,
          `${slicedOrder[index].type}-${slicedOrder[index].city},${slicedOrder[index].state}`,
        ]);
      }      // Use zip_code
      if (slicedOrder[index].zip_code) {
        generateCombinations(index + 1, [
          ...currentCombination,
          `${slicedOrder[index].type}-${slicedOrder[index].zip_code}`,
        ]);
      }      // only types
      generateCombinations(index + 1, [...currentCombination, `${slicedOrder[index].type}`]);      // Profile Group 
      if (profileGroup?.length) {
        profileGroup.slice(0, 5).forEach((singleProfile: any) => {
          generateCombinations(index + 1, [...currentCombination, `${slicedOrder[index].type}-${singleProfile}`]);
        });
      }      // All Customer
      generateCombinations(index + 1, [...currentCombination, `${slicedOrder[index].type}-${ProfileType.ALL_CUSTOMER}`]);      // city state group
      if (cityStateGroup?.length) {
        cityStateGroup.slice(0, 5).forEach((singleProfile: any) => {
          generateCombinations(index + 1, [...currentCombination, `${slicedOrder[index].type}-${singleProfile}`]);
        });
      }      // zip code group 
      if (zipCodeGroup?.length) {
        zipCodeGroup.slice(0, 5).forEach((singleProfile: any) => {
          generateCombinations(index + 1, [...currentCombination, `${slicedOrder[index].type}-${singleProfile}`]);
        });
      }
    };    // Start the recursive generation with the first order
    generateCombinations(0, []); return combinations;
  } catch (error) {
    console.error("Error in getCombination:", error);
    return [];
  }
};

export const getRuleBasedChargesForLocation = async (routing?: any, additionalInfo?: any): Promise<any[]> => {
  try {
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

    if (!chargeTemplateCount) return []; const queryForRouting = findLocationCombination(routing, additionalInfo?.groupInformation);

    if (!queryForRouting?.length) {
      return [];
    }

    const orCriteria = finalQuery?.$or;

    delete finalQuery?.$or; finalQuery = {
      ...finalQuery,
      moveType: { $ne: "BY_LEG" },
      $and: [{ $or: queryForRouting?.map((singleRoutingQuery: any) => ({ multiQueryIndex: singleRoutingQuery })) }],
    };

    if (orCriteria) {
      finalQuery.$and.push({ $or: orCriteria });
    }

    const results = await ChargeTemplateModel.find(finalQuery).lean()

    return results;
  } catch (error) {
    console.error("Error in getRuleBasedChargesForLocation:", error);
    return [];
  }
};

const findLocationCombination = (driverOrders = [], groupInformation: any) => {
  try {
    const minWindowSize = 2;
    let totalCombinations = [];

    const inputSize = driverOrders?.length || 0;
    const MAX_WINDOW_SIZE = Math.min(inputSize, 5);
    const MAX_ITERATIONS = Math.min(inputSize, 10);
    const MAX_COMBINATIONS_PER_WINDOW = 100;

    const limitedOrders = driverOrders.slice(0, Math.min(inputSize, 10));

    for (let frame = minWindowSize; frame <= MAX_WINDOW_SIZE; frame++) {
      let iterations = Math.min(limitedOrders.length - frame + 1, MAX_ITERATIONS);
      for (let i = 0; i < iterations; i++) {
        const slicedOrder = limitedOrders.slice(i, i + frame);
        const combination = getLocationCombination(slicedOrder, groupInformation, MAX_COMBINATIONS_PER_WINDOW);
        if (combination?.length > 0) {
          totalCombinations.push(combination);
        }
      }
    }

    const flatTotalCombination = totalCombinations.flat();

    const result = flatTotalCombination?.map((singleCombination: any) => singleCombination?.filter(Boolean));

    return result;
  } catch (error) {
    console.error("Error in findLocationCombination:", error);
    return [];
  }
};

const getLocationCombination = (slicedOrder: any = [], groupInformation: any, maxCombinations: number = 100) => {
  try {
    // Define possible profile attributes for each order
    const combinations: any = [];
    const MAX_COMBINATIONS = maxCombinations;

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
      generateCombinations(index + 1, [...currentCombination, `${ProfileType.ALL_CUSTOMER}`]);      // Profile Group for location only 
      if (profileGroup?.length) {
        profileGroup.slice(0, 5).forEach((singleProfile) => {
          generateCombinations(index + 1, [...currentCombination, `${singleProfile}`]);
        });
      }      // city state group for location only 
      if (cityStateGroup?.length) {
        cityStateGroup.slice(0, 5).forEach((singleProfile) => {
          generateCombinations(index + 1, [...currentCombination, `${singleProfile}`]);
        });
      }      // zip code group for location only 
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
