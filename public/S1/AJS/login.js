function usrPwdValidate(requestObj) {
    var clientID = requestObj.clientID;
    var appId = requestObj.appId;
    var company = requestObj.COMPANY;
    var branch = requestObj.BRANCH;
    var module = requestObj.module ||  0;
    var refid = requestObj.refid;
    var names, username, username1;
    const password = requestObj.password;
    //REFID means USERS when module is 0
    if (module == 0) {
      names = X.GETSQLDATASET("SELECT CODE, NAME FROM USERS WHERE USERS = " + refid);
      username = names.CODE;
      username1 = names.NAME;
      if (X.USERVALIDATE(username, password) == true) {
        return { success: true, message: 'User ' + username + ' validated successfully', username: username1 }
      } else {
        return { success: false, message: 'Invalid login' }
      }
    } else {
      return { success: false, message: 'Invalid module' }
    }
  }