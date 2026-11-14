/**
 * Entry point untuk Web App API
 */
function doGet(e) {
  try {
    setupDatabase();
  } catch (err) {
    Logger.log("doGet setup error: " + err.toString());
  }
  return ContentService.createTextOutput(JSON.stringify({ 
    status: "success", 
    message: "API PPDB AI Active & Database Initialized." 
  })).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);
  
  try {
    const params = JSON.parse(e.postData.contents);
    const action = params.action;
    
    let result = {};
    
    if (action === "initDatabase") {
      setupDatabase();
      result = { message: "Database dan seluruh data awal berhasil disiapkan di Spreadsheet." };
    } else if (action === "login") {
      result = doLogin(params.username, params.password);
    } else if (action === "getUsers") {
      result = getUsers();
    } else if (action === "addUser") {
      result = addUser(params.username, params.password, params.nama, params.role);
    } else if (action === "updateUser") {
      result = updateUser(params.username, params.nama, params.password);
    } else if (action === "deleteUser") {
      result = deleteUser(params.username);
    } else if (action === "registerSiswa") {
      result = registerSiswa(params.data);
    } else if (action === "importSiswaBatch") {
      result = importSiswaBatch(params.dataList);
    } else if (action === "updateSiswa") {
      result = updateSiswa(params.data);
    } else if (action === "getSiswa") {
      result = getSiswaToValidate(params.pendingOnly);
    } else if (action === "runAICheck") {
      const urlGambar = params.jenisDokumen === 'ijazah' ? params.dataSiswa.urlIjazah : params.dataSiswa.urlKK;
      result = cekKesesuaianDenganAI(params.dataSiswa, urlGambar, params.apiKey);
    } else if (action === "ekstrakDataAI") {
      result = ekstrakDataDenganAI(params.nikTarget, params.kkBase64, params.ijazahBase64, params.apiKey);
    } else if (action === "generateSoalAI") {
      result = generateSoalCBTDenganAI(params.topikMateri, params.jenjang, params.kelas, params.mataPelajaran, params.jumlahSoal, params.apiKey);
    } else if (action === "updateStatus") {
      result = updateStatusSiswa(params.idSiswa, params.status, params.koreksiAI);
    } else if (action === "updateStatusAktif") {
      result = updateStatusAktif(params.idSiswa, params.statusAktif);
    } else if (action === "deleteSiswa") {
      result = deleteSiswa(params.idSiswa);
    } else if (action === "getApiKeys") {
      result = getApiKeysListFromDB();
    } else if (action === "addApiKey") {
      result = addApiKeyToDB(params.email, params.apiKey, params.limitHarian);
    } else if (action === "deleteApiKey") {
      result = deleteApiKeyFromDB(params.idKey);
    } else if (action === "resetKeyUsage") {
      result = resetKeyUsageInDB(params.idKey);
    } else if (action === "savePushSubscription") {
      result = savePushSubscriptionToDB(params.subscription, params.user);
    } else if (action === "deletePushSubscription") {
      result = deletePushSubscriptionFromDB(params.endpoint);
    } else if (action === "getPushSubscriptions") {
      result = getPushSubscriptionsFromDB(params.targetRole, params.targetUsername);
    } else if (action === "logNotification") {
      result = logNotificationActivity(params.title, params.body, params.url, params.targetRole, params.tag);
    } else if (action === "getNotificationLogs") {
      result = getNotificationLogs(params.limit);
    } else if (action === "getKegiatan") {
      result = getKegiatanListFromDB();
    } else if (action === "saveKegiatan") {
      result = saveKegiatanToDB(params.kegiatan);
    } else if (action === "deleteKegiatan") {
      result = deleteKegiatanFromDB(params.id);
    } else if (action === "getAppSetting") {
      result = getAppSettingFromDB(params.key);
    } else if (action === "saveAppSetting") {
      result = saveAppSettingToDB(params.key, params.val);
    } else if (action === "getBuku") {
      result = getBukuListFromDB();
    } else if (action === "saveBukuBatch") {
      result = saveBukuBatchToDB(params.bukuList);
    } else if (action === "getHasilUjian") {
      result = getHasilUjianFromDB();
    } else if (action === "saveHasilUjian") {
      result = saveHasilUjianToDB(params.ujian);
    } else if (action === "getBankSoal") {
      result = getBankSoalFromDB();
    } else if (action === "saveBankSoalBatch") {
      result = saveBankSoalBatchToDB(params.paketList);
    } else if (action === "getRaport") {
      result = getRaportListFromDB();
    } else if (action === "saveRaport") {
      result = saveRaportToDB(params.raport);
    } else if (action === "deleteRaport") {
      result = deleteRaportFromDB(params.id);
    } else if (action === "getTranskrip") {
      result = getTranskripListFromDB();
    } else if (action === "saveTranskrip") {
      result = saveTranskripToDB(params.transkrip);
    } else if (action === "saveTranskripBatch") {
      result = saveTranskripBatchToDB(params.batch);
    } else if (action === "deleteTranskrip") {
      result = deleteTranskripFromDB(params.id);
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
