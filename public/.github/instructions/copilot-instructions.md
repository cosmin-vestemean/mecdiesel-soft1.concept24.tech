# Soft1 Web Services Integration Reference

## Table of Contents
- [Key Endpoints](#key-endpoints)
- [Authentication](#authentication)
- [Documentation](#documentation)
- [FeathersJS Backend Integration](#feathersjs-backend-integration)
- [Coding Conventions](#coding-conventions)
- [Code Structure](#code-structure)
- [API Functions](#api-functions)
  - [RUNSQL](#runsqlasql-string-aparams-variant)
  - [GETSQLDATASET](#getsqldatasetasql-string-aparams-variant-tdataset)
  - [SQL](#sql-asql-string-aparams-variant-string)
  - [HTTPCALL](#httpcallurl-string-postdata-string-headers-string-method-string-variant)
  - [WEBREQUEST](#webrequestjsonrequest-string-string)
  - [WSCALL](#wscallscope-variant-uri-string-postdata-string-callbackfunc-variant-string)
  - [GETXML](#getxmlwithmetadata-boolean-string)
  - [JSON](#json-string)
  - [CREATEOBJ](#createobobjectname-string-object-idispatch)
  - [CREATEOBJFORM](#createobjformobjectname-string-object-idispatch)
  - [Database Operations](#database-operations)
    - [DBDELETE](#dbdelete)
    - [DBLOCATE](#dblocate)
    - [DBINSERT](#dbinsert)
    - [DBPOST](#dbpost)

This repository integrates with the Soft1 Web Services API available at https://www.softone.gr/ws/

## Key Endpoints

The base URL format for API calls is:
```
http://[Registered Name or Serial Number].oncloud.gr/s1services
```

## Authentication
- Requires Web Service account (AppID)
- Login service requires:
    - Username
    - Password 
    - AppID

## Documentation
For complete API documentation and integration details, visit [Soft1 Web Services Documentation](https://www.softone.gr/ws/)

## FeathersJS Backend Integration

This project uses FeathersJS as the backend framework. Refer to the [FeathersJS API Documentation](https://feathersjs.com/api/) for the latest information.

### Key FeathersJS Components:
- **Application**: Main Feathers application API
- **Services**: Service objects and their methods
- **Hooks**: Pluggable middleware for service methods
- **Events**: Events sent by service methods
- **Authentication**: Supports JWT, Local, and OAuth strategies
- **Transports**: REST, Socket.io, and other API server implementations
- **Database Adapters**: Support for MongoDB, SQL, Memory, and other databases

## Coding Conventions

### Soft1 Specific Code Files
- Files containing Soft1 ERP specific code must use JavaScript ES5 syntax
- All Soft1 specific files should be marked with a comment in the first line:
  - Standard S1 files: `// Cod specific S1`
  - SQL files as API: `-- Cod specific S1 - SQL - API`
  - SQL files as various: `-- Cod specific S1 - SQL`
  - AJS endpoint files: `// Cod specific S1 - AJS`
- The global variable `X` is used throughout Soft1 code and provides access to Soft1 API

### API Endpoints
- Custom API endpoints should be placed in the `/public/S1/AJS` directory
- Only files in the AJS directory should be modified
- URL endpoints are published following this pattern:
  ```
  https://mecdiesel.oncloud.gr/s1services/JS/AJS_filename/function_name
  ```
  Where `AJS_filename` is the name of your file in the AJS directory and `function_name` is the exported function

## Code Structure

The `/public/S1` folder contains:
- `/AJS` - Customizable Soft1 endpoint implementations 
- Other reference code from Soft1 ERP (view only)

Only files in the `/AJS` directory should be modified. Other files serve as reference implementations.

### RUNSQL(ASQL: string; AParams: Variant)

Executes an action query using the provided SQL statement and parameters.

#### Parameters
- `ASQL` (string): The SQL statement to execute. Can include parameterized queries using :1, :2 etc syntax.
- `AParams` (Variant): Array containing parameter values to substitute in the SQL statement. Parameters are matched by position to :1, :2 etc in the SQL.

#### Usage Notes
- Used for executing UPDATE, INSERT, DELETE and other action queries
- SQL parameters should be specified using :1, :2 etc syntax
- Number of parameters in AParams must match number of :n placeholders in SQL
- Company context is often required in queries

#### Example

```javascript
// Example of RUNSQL usage
var sql = "UPDATE TRDR SET ISACTIVE=0 WHERE COMPANY=:1 AND CODE=:2";
X.RUNSQL(sql, X.SYS.COMPANY, "CUST001");
```

### GETSQLDATASET(ASQL: string; AParams: Variant): TDataset

Executes a SQL query and returns results in a dataset.

#### Parameters
- `ASQL` (string): The SQL query to execute. Can include parameterized queries using :1, :2 etc syntax
- `AParams` (Variant): Parameter values to substitute in the SQL statement, matched by position

#### Returns
- `TDataset`: Dataset containing the query results

#### Usage Notes
- Used for SELECT queries that return data
- SQL parameters use :1, :2 etc syntax
- Number of AParams must match :n placeholders
- Company context typically required

#### Example
```javascript
var qry = "SELECT CODE, NAME FROM TRDR WHERE COMPANY=:1 AND SODTYPE=:2 AND BUSUNITS=:3";
var ds = X.GETSQLDATASET(qry, X.SYS.COMPANY, 13, 100);
```

### SQL(ASQL: string; AParams: Variant): string

Executes a SQL query and returns a single row result as a comma-separated string.

#### Parameters
- `ASQL` (string): The SQL statement to execute. Can include parameterized queries using :1, :2 etc syntax.
- `AParams` (Variant): Array containing parameter values to substitute in the SQL statement.

#### Returns
- `string`: A comma-separated string with the values from the first row of the result set.

#### Usage Notes
- Used for simple queries where you need only one row result
- Useful for retrieving single values or a small set of values
- Returns empty string if no rows are found
- Only returns the first row if multiple rows are in the result set
- For multiple rows or complex data, use GETSQLDATASET instead

#### Examples

```javascript
// Example 1: Get next number in sequence
var NewCode = X.SQL("SELECT ISNULL((SELECT MAX(ISNULL(TRY_PARSE(ISNULL(SNCODE,0) AS INT),0)) FROM GUARANTY),0) + 1", null);
// Returns the max number + 1 of the field Guaranty.SNCODE

// Example 2: Get customer information by tax ID
function ExampleSQL(vAFM) {
    var str = "SELECT TRDR, CODE, NAME FROM TRDR "
        + "\n WHERE COMPANY=:X.SYS.COMPANY AND SODTYPE=13 AND AFM=:1";
    return X.SQL(str, vAFM);
}
// Return Example: 1, 1234, TestCustomer
```

### HTTPCALL(URL: string, PostData: string, Headers: string, Method: string): Variant

Makes HTTP requests for interacting with web services, APIs and websites.

#### Parameters
- `URL` (string): Target URL for the web request
- `PostData` (string): Data to send in the request body
- `Headers` (string): Request headers separated by \r\n
- `Method` (string): HTTP method (GET, POST, PUT, PATCH, DELETE)

#### Returns
- `Variant`: Response from the HTTP request

#### Usage Notes
- Used for external web service integration
- Headers must be \r\n delimited
- Supports standard HTTP methods
- Returns raw response data

#### Examples
```javascript
// GET request example
function makeGetRequest() {
    try {
        var response = X.HTTPCALL("https://www.mysite.com/api"); 
        if (response) {
            return true;
        }
    } catch (err) {
        X.WARNING(err.message);
    }
    return false;
}

// POST request example
function makePostRequest(apiKey) {
    var headers = "Content-Type: application/json\r\nAuthorization: Bearer " + apiKey;
    var data = JSON.stringify({
        username: "user1",
        password: "pass"
    });
    
    return X.HTTPCALL("https://www.mysite.com/api", data, headers, "POST");
}
```

### WEBREQUEST(JSONRequest: string): string

Executes SoftOne web service requests using built-in services.

#### Parameters
- `JSONRequest` (string): JSON string containing the service request parameters

#### Returns
- `string`: JSON response from the web service

#### Usage Notes
- Used for built-in SoftOne services like SetData, GetData, GetBrowserInfo
- For custom web services, use WSCALL instead
- Supports both external and internal requests
- Request must be properly formatted JSON

#### Examples
```javascript
// Get data using SqlData service
function getItems() {
    var ws = {
        SERVICE: "SqlData",
        SQLNAME: "CallFromForm",
        PARAM1: "2020,2021,2022,2023"
    };
    return JSON.parse(X.WEBREQUEST(JSON.stringify(ws)));
}

// Get INST data using getData service
function getInstData(key) {
    var ws = {
        SERVICE: "getData",
        OBJECT: "INST",
        KEY: key,
        appid: 3000,
        LOCATEINFO: "INST:INST,CODE,NAME,GDATEFROM,GDATETO"
    };
    return JSON.parse(X.WEBREQUEST(JSON.stringify(ws)));
}
```
### WSCALL(scope: variant, Uri: string, postData: string, callbackFunc: variant): string

Executes SoftOne web service requests, supporting both built-in and custom services.

#### Parameters
- `scope` (variant): Scope for the web service call (use null for most cases)
- `Uri` (string): URL path for custom web services, null for built-in services
- `postData` (string): JSON string containing request parameters
- `callbackFunc` (variant): Optional callback function (use null if not needed)

#### Returns
- `string`: JSON response from the web service

#### Usage Notes
- Handles both built-in and custom web service requests
- For built-in services, set Uri to null
- For custom services, specify the URL path (e.g. "/s1services/JS/mywebcall")
- PostData must be properly formatted JSON

#### Example
```javascript
// Custom web service request
function CustomWSRequest() {
    var ws = {
        clientID: "xxx",
        categ: 100
    };
    var url = "/s1services/JS/myWS/getItemCategories";
    var result = X.WSCALL(null, url, JSON.stringify(ws), null);
    return JSON.parse(result);
}
```

### GETXML(withmetadata: boolean): string

Converts a dataset to XML format.

#### Parameters
- `withmetadata` (boolean): Whether to include metadata in the XML output
    - `false` (0): Basic XML without metadata
    - `true` (1): XML including field definitions and parameters

#### Returns
- `string`: XML representation of the dataset

#### Usage Notes
- Converts dataset contents to XML format
- Metadata includes field definitions when enabled
- Uses ISO-8859-7 encoding
- Useful for data exchange and web services

#### Example
```javascript
function GetXMLFormat(withmetadata) {
        var ds = X.GETSQLDATASET("SELECT CODE, NAME FROM TRDR WHERE TRDR=:1", SALDOC.TRDR);
        return ds.GETXML(withmetadata);
}
```

Sample Output (without metadata):
```xml
<?xml version="1.0" encoding="ISO-8859-7"?>
<SODATA>
<ROWDATA><ROW CODE="09" NAME="Test Customer 1"/>
</ROWDATA>
</SODATA>
```

Sample Output (with metadata):
```xml
<?xml version="1.0" encoding="ISO-8859-7"?>
<SODATA>
<METADATA>
<FIELDS>
<FIELD fieldname="CODE" fieldtype="string" WIDTH="25" fieldcaption=""/>
<FIELD fieldname="NAME" fieldtype="string" WIDTH="64" fieldcaption=""/>
</FIELDS>
<PARAMS PRIMARY_KEY=""/>
</METADATA>
<ROWDATA>
<ROW CODE="09" NAME="Test Customer 1"/>
</ROWDATA>
</SODATA>
```

### JSON: string

Returns a dataset or table contents in JSON format.

#### Returns
- `string`: JSON representation of the dataset or table

#### Usage Notes
- Converts dataset/table contents to JSON string
- Includes column names and data rows
- Useful for web services and data exchange
- Compatible with standard JSON parsers

#### Example
```javascript
function GetTableAsJson() {
    var vjson = MTRSUBSTITUTE.JSON;
    X.WARNING(vjson);
    return vjson;
}
```

### CREATEOBJ(ObjectName: string): OBJECT (IDispatch)

Creates a SoftOne business object instance and returns its interface.

#### Parameters
- `ObjectName` (string): The name of the object to create
  - Can include form name using syntax: 'ObjectName;FormName'

#### Returns
- `OBJECT (IDispatch)`: Interface to interact with the created object

#### Usage Notes
- Used to programmatically create and manipulate business objects
- Allows access to business logic and database operations
- Objects can be created with specific forms for customized behavior
- Commonly used with DBINSERT, DBLOCATE, and DBPOST operations

#### Examples

```javascript
// Example 1: Create and save a sales document
function CreateSales() {
    var myObj = X.CreateObj('SALDOC;MYSALESVIEW');
    try {
        myObj.DBINSERT;
        var tblFINDOC = myObj.FindTable('FINDOC');
        var tblITELINES = myObj.FindTable('ITELINES');
        
        tblFINDOC.Edit;
        tblFINDOC.SERIES = 7062;
        tblFINDOC.TRDR = CUSTOMER.TRDR;
        
        tblITELINES.Append;
        tblITELINES.MTRL = 123456;
        tblITELINES.QTY1 = 100;
        tblITELINES.PRICE = 50;
        tblITELINES.Post;
        
        var id = myObj.DBPOST;
        if (id > 0)
            X.WARNING('New id is: ' + id);
    }
    catch (e) {
        if (myObj != null)
            X.WARNING("General Error: " + e.message + "\nObject Error: " + myObj.GETLASTERROR);
        else
            X.WARNING("General Error: " + e.message);
    }
}

// Example 2: Batch print documents to PDF
function PrintSelectedDocuments() {
    var vSelRecs = X.GETPARAM('SELRECS');
    var fso = new ActiveXObject('Scripting.FileSystemObject');
    var vFolder = "C:\\Temp";
    var ObjSaldoc = X.CreateObj('SALDOC');
    
    vQueryBrowser = "SELECT DISTINCT FINDOC, TRDR, (SELECT CODE FROM TRDR WHERE TRDR=FINDOC.TRDR) as TRDRCODE FROM FINDOC WHERE " + vSelRecs + " ORDER BY TRDR";
    ds = X.GETSQLDATASET(vQueryBrowser, null);
    
    ds.FIRST;
    while (!ds.EOF) {
        vCurTrdr = ds.TRDR;
        vCurTrdrCode = ds.TRDRCODE;
        
        if (!fso.FolderExists(vFolder + "\\" + vCurTrdrCode)) {
            fso.CreateFolder(vFolder + "\\" + vCurTrdrCode);
        }
        
        ObjSaldoc.DBLocate(ds.FINDOC);
        ObjSaldoc.PRINTFORM(1001, 'PDF file', vFolder + '\\' + vCurTrdrCode + '\\' + ds.FINDOC + '.PDF');
        ds.NEXT;
    }
}
```

### CREATEOBJFORM(ObjectName: string): OBJECT (IDispatch)

Creates a SoftOne business object instance configured to display UI forms, and returns its interface.

#### Parameters
- `ObjectName` (string): The name of the object to create
  - Can include form and list specifications using syntax: 'ObjectName[FORM=MyFormName, LIST=MyListName]'

#### Returns
- `OBJECT (IDispatch)`: Interface to interact with the created object

#### Usage Notes
- Similar to CREATEOBJ but designed to display forms to users
- Used when interaction with the UI form is required before finalizing operations
- Support for SHOWOBJFORM() to display the form to users
- Combines programmatic data manipulation with user interaction

#### Example

```javascript
// Create purchase document and display form for user interaction
function CreatePurchase() {
    var myObj = X.CreateObjForm('PURDOC[FORM=MyFormName]');
    try {
        myObj.DBINSERT;
        var tblFINDOC = myObj.FindTable('FINDOC');
        var tblITELINES = myObj.FindTable('ITELINES');
        
        tblFINDOC.Edit;
        tblFINDOC.SERIES = 2001;
        tblFINDOC.TRDR = 123456;
        
        tblITELINES.Append;
        tblITELINES.MTRL = ITEM.MTRL;
        tblITELINES.QTY1 = 100;
        tblITELINES.PRICE = 50;
        tblITELINES.Post;
        
        // Display form to user - waits for user to save
        var id = myObj.SHOWOBJFORM();
        if (id > 0)
            X.WARNING('New id is: ' + id);
    }
    catch (e) {
        if (myObj != null)
            X.WARNING("General Error: " + e.message + "\nObject Error: " + myObj.GETLASTERROR);
        else
            X.WARNING("General Error: " + e.message);
    }
}
```

### Database Operations

Core functions for performing CRUD operations within SoftOne's business logic.

### DBDELETE

Deletes a located record, executing all object methods and jobs.

#### Usage Notes
- Similar to using the "Delete" toolbar button
- Must locate record first using DBLocate
- Validates deletion permissions
- Throws error if deletion not allowed

#### Example
```javascript
// Delete a purchase document
function DeleteRecord(vID) {
    var myObj = X.CreateObj('PURDOC');
    myObj.DBLocate(vID);
    myObj.DBDelete;
}
```

### DBLOCATE(KeyData: variant)

Locates a record by primary key value.

#### Parameters
- `KeyData` (variant): Primary key value to locate

#### Example
```javascript
// Locate sales document
function LocateRecord(vID) {
    var myObj = X.CreateObj('SALDOC');
    myObj.DBLocate(vID);
    X.WARNING('Located record: ' + vID);
}
```

### DBINSERT

Prepares object for inserting new record.

#### Usage Notes
- Similar to "New" toolbar button
- Must be called before setting field values
- Used with DBPOST to save changes

#### Example
```javascript
// Add new customer
function AddNewCustomer() {
    var myObj = X.CREATEOBJ('CUSTOMER');
    var CustTbl;
    try {
        CustTbl = myObj.FINDTABLE('TRDR');
        myObj.DBINSERT;
        CustTbl.CODE = "000*";
        CustTbl.NAME = "TEST_CUSTOMER";
        var newid = myObj.DBPOST;
        X.WARNING("New Customer's ID is: " + newid);
    }
    catch (e) {
        if (myObj != null)
            X.WARNING("General Error: " + e.message + "\nObject Error: " + myObj.GETLASTERROR);
        else
            X.WARNING("General Error: " + e.message);
    }
}
```

### DBPOST

Saves object changes to database.

#### Usage Notes
- Similar to "Save" toolbar button
- Applies all business logic and validations
- Returns new record ID for inserts
- Throws error if validation fails

#### Example
```javascript
// Update project record
function UpdatePRJC(vPRJCID, vnewTRDR, vnewBOOL01) {
    var myObj = X.CREATEOBJ('PRJC;MYCUSTOMFORM');
    var tblPRJC = myObj.FINDTABLE('PRJC');
    var tblPRJEXTRA = myObj.FINDTABLE('PRJEXTRA');
    try {
        myObj.DBLOCATE(vPRJCID);
        // Set new values
        tblPRJC.TRDR = vnewTRDR;
        tblPRJEXTRA.BOOL01 = vnewBOOL01;
        // Save changes
        myObj.DBPOST;
        return true;
    }
    catch (e) {
        X.WARNING("Failed to update: " + e.message);
        return false;
    }
}
```

## 📚 Documentation System Overview

The Ofertainvest project uses a professional, client-facing documentation system located in `public/docs/`. This system provides comprehensive technical documentation for stakeholders, clients, and team members.

## 🚫 Critical Guidelines - What NOT to Include

**NEVER autogenerate documentation:**
- ❌ Do not create documentation files without explicit user request
- ❌ Do not suggest creating new documentation pages unless asked
- ❌ Only create or update documentation when specifically requested by the user

**NEVER include development/billing metrics in documentation:**
- ❌ "Lines of code" or "LOC"
- ❌ "Hours worked" or time tracking
- ❌ "Lines modified" or similar metrics
- ❌ "Development effort" or billing references
- ❌ "Time spent" or duration metrics
- ❌ "Cost" or pricing information

**Instead, focus on:**
- ✅ **Business value** and **benefits**
- ✅ **Technical features** and **capabilities**
- ✅ **User experience** improvements
- ✅ **System architecture** and **design patterns**
- ✅ **Implementation details** and **best practices**