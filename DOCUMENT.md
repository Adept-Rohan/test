### Documentation For PortPro Assignment 

1) While running the server for the first time, the server.ts file throws an error saying portpro-assignment/node_modules/@types/express/index.d.ts' is not a module. The type defination of express was not identified as a module.
  
  => I thought the Typescript could not recognize the express type declaration as module. So I included the file app.ts and server.ts in the tsconfig.json. However it did'nt work as well.

  => I thought the typescript compiler used was the issue so I changed the compiler to bun and the server started to start and changed the tscconfig configuration.

2) I Got a Error With the function ConnectDB. It was throwing MongooseServerSelection Error: Failed to connect.

   => I installed the Mongo DB community server and Mongo DB shell and connected to the mongoDB server. After this the connection of database was fulfilled and server started running on port 3000.

   => After the closer look I could not find my database in mongosh shell. However, I looked throught the schema and found that the code to create model using the schema was missing. I simply added the code and created a chargeTemplates collection in mongodb. However the code was already present on model folder so i simply used that.

3) Since I have to insert the constant json data in the collection chargeTemplates. I created a insertData function that uses built in node js module path and fs to find the path of the json file and read the file content. I used imported the ChargeTemplate and used built in mongodb feature of insertMany where i inserted the json data after reading the file operation was completed.

4) However, I encounter error while inserting data into the collection. The error message suggested a schema validation error suggesting chargeTemplateGroupId has a invalid type. I was getting validation error for chargeTemplateGroupId, createdAt and updatedAt due to the array of object. 

 => The issue arrised due to the $_oid and $date key objects inside the three columns. As it was expecting array of numbers for chargeTemplateGroupId and string for createdAt and updatedAt.

 => I removed the part $_oid and $date by mapping the array read from the json file and parsing the JSON and using regex to identify the part where $_oid is present and replacing it with the string value.

 ==> After that I got error in EventLocationRules, the schema was defined to be required but in our json data some of the data in EventLocationRules empty. Once, I changed the required to false all the 8 data were inserted into the collection.

5) When running curl1.data.txt, I get response from my server. But When i run curl2.data.txt it does not provide me response. The socket runs out. 
