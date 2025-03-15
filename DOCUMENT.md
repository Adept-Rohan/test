# Documentation For PortPro Assignment 

## Tech Stack 
- Node.js (23.7.8)
- MongoDB (8.0)

## Configuring the Project For The First Time

- While running the server for the first time, the server.ts file throws an error saying portpro-assignment/node_modules/@types/express/index.d.ts' is not a module. The type defination of express was not identified as a module.
  
- I thought the Typescript could not recognize the express type declaration as module. So I included the file app.ts and server.ts in the tsconfig.json. However it did'nt work as well.

- I thought the typescript compiler used was the issue so I changed the compiler to bun and the server started to start and changed the tscconfig configuration.

## Database Configuration

- I Got a Error With the function ConnectDB. It was throwing MongooseServerSelection Error: Failed to connect.

- I installed the Mongo DB community server and Mongo DB shell and connected to the mongoDB server. After this the connection of database was fulfilled and server started running on port 3000.

## Inserting Constant Data To MongoDB

- Since I have to insert the constant json data in the collection chargeTemplates. I created a insertData function that uses built in node js module path and fs to find the path of the json file and read the file content. I used imported the ChargeTemplate model and used built in mongodb feature of insertMany where i inserted the json data after reading the file operation was completed.

- However, I encounter error while inserting data into the collection. The error message suggested a schema validation error suggesting chargeTemplateGroupId has a invalid type. I was getting validation error for chargeTemplateGroupId, createdAt and updatedAt due to the array of object. 

- The issue arrised due to the $_oid and $date key objects inside the three columns. As it was expecting array of numbers for chargeTemplateGroupId and string for createdAt and updatedAt.

- I removed the part $_oid and $date by mapping the array read from the json file and parsing the JSON and using regex to identify the part where $_oid is present and replacing it with the string value.

- After that I got error in EventLocationRules, the schema was defined to be required but in our json data some of the data in EventLocationRules empty. Once, I changed the required to false all the 8 data were inserted into the collection.

- I even added a command in server where it just delete the ChargeTemplate collections right before insertData function so that in development my server won't throw duplication collection error as insertData function runs repeteadly.

## Running the Curl Input Command 

- When running curl1.data.txt, I get response from my server. But When i run curl2.data.txt it does not provide me response. The socket runs out. 

- I thought the issue was the long curl request data which might be the cause of the issue. At first, I set the server timeout to 10 minutes so that the server will not be stopped and increase the size of request payload. None of them were helping the solve the issue. 

## Issue Defination

- Then, I simply commented out the utility function and just consoled the request.body parameter. The request.body paramter was okay and the requested data has been recieved in server from the curl request. Then I was sure that the problem was casued from the utility function.

- There were two utility functions getRuleBasedCharges() and getRuleBasedChargesForLocation() where the issue arrises because when i commented both the function in router I was getting response and the getVendorsFromRouting() was working fine.

## Issue Gathering 
- getRuleBasedCharges() function.
- getRuleBasedChargesForLocation() function.

## Issue Resolution: Part I (getRuleBasedCharges)

-  The function basically receives driver order and additional information from the request body. Through additional information we get owner and vendor details.

- Through the additional information we get a matching chargeTemplates data based on the additional information payload. The payload is passed to queryForVendorValidityCheck() which creates a criteria for query.

- The drivers order and additional information is then sent to findCombination() to determine the query for routing. However the function worked properly for curl1.data.txt but for curl2.data.txt it didn't work. Then I determined there might be an issue with findCombination() function.

- I noticed that for curl1.data.txt the driverOrder value is not large but for curl2.data.txt the driverOrder array has a large data set. I thought the issue was due to large data set in curl2.data.txt because when i run the curl2 input it does not provide response but just loads infinetly.

- I decided to dynamically adjust the processing limit of the function to increase performance and prevent over computation. I set the max window size to process a certain operation in single window. I even ensured that smaller input size does not get larger window size. In simple term what it does is my driverOrder array data will be performed not all at once but according to window size.

- I even defined max iteration so that the function does not run infinitely especially for large data set like curl2.input.txt.

- I even defined max combinations set to 100 so that we don't have to prevent multiple output per window. I choose limitedOrder to avoid unnecssary processing when only few order are relevant.

- Previously, findCombination used to loop through driverOrder.length. However, i changed the for loop through max window size. I changed the iteration to max iteration so that while when getCombination() run it does not hang due to large data set.

- getCombination() function get all the possible combination which has a generateCombinations() recursive function that repetadely generate Combination and i have also use max combination to check the condition so that the function does not run infinetely.

## Issue Resolution: Part II (getRuleBasedChargesForLocation)

- getRuleBasedChargesForLocation() was also similar to the getRuleBasedCharges() function. So, I just did the same thing for getRuleBasedCharges() and the issue was solved and the code was optimized for large data set.

## What does the Code do? POV
- I think the code is used for logistic management system. The provided code handles rule based charge calculation for vendor. It calculates the charges based on vendor profile and routing information. It generates combination of location data to match against charge templates. 


## Conclusion 
- Due to large data set the utility function were not performant and had scalability issue. Due to which the same function worked perfectly fine for curl1.input.txt whearas for curl2.input.txt it could not provide response. Due to the concept of iterating large data set helped to scale the code for the large data set as well.






