/**
 * Entry point untuk Web App API
 */
function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({ status: "success", message: "API PPDB AI Active." }))
      .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);
  
  try {
    const params = JSON.parse(e.postData.contents);
    const action = params.action;
    
    let result = {};
    
    if (action === "login") {
      result = doLogin(params.username, params.password);
    } else if (action === "getUsers") {
      result = getUsers();
    } else if (action === "addUser") {
      result = addUser(params.username, params.password, params.nama, params.role);
    } else if (action === "deleteUser") {
      result = deleteUser(params.username);
    } else if (action === "registerSiswa") {
      result = registerSiswa(params.data);
    } else if (action === "updateSiswa") {
      result = updateSiswa(params.data);
    } else if (action === "getSiswa") {
      result = getSiswaToValidate(params.pendingOnly);
    } else if (action === "runAICheck") {
      const urlGambar = params.jenisDokumen === 'ijazah' ? params.dataSiswa.urlIjazah : params.dataSiswa.urlKK;
      result = cekKesesuaianDenganAI(params.dataSiswa, urlGambar);
    } else if (action === "updateStatus") {
      result = updateStatusSiswa(params.idSiswa, params.status, params.koreksiAI);
    } else if (action === "updateStatusAktif") {
      result = updateStatusAktif(params.idSiswa, params.statusAktif);
    } else {
      result = { error: "Action not found" };
    }
    
    output.setContent(JSON.stringify({ success: true, data: result }));
    return output;

  } catch (error) {
    output.setContent(JSON.stringify({ success: false, error: error.toString() }));
    return output;
  }
}
