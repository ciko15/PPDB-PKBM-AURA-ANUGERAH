/**
 * Pengecekan data menggunakan Gemini AI
 */
function cekKesesuaianDenganAI(dataSiswa, urlGambar) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  
  if (!apiKey || apiKey === 'TARUH_API_KEY_DISINI') {
    // Mode dummy jika API key tidak ada
    Utilities.sleep(1500); // Simulasi waktu tunggu AI (1.5 detik)
    return {
      status: "TIDAK_COCOK",
      koreksi: "Simulasi AI: NIK pada dokumen tidak sesuai dengan inputan. Pastikan penulisan NIK sudah benar."
    };
  }

  // Endpoint Gemini 1.5 Flash (lebih cepat dan ringan)
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
  
  let imageBase64 = "";
  try {
    const imageResponse = UrlFetchApp.fetch(urlGambar, { muteHttpExceptions: true });
    if (imageResponse.getResponseCode() !== 200) {
      return { status: "ERROR", koreksi: "Gagal mengambil gambar dokumen. Cek permission URL/Link." };
    }
    const imageBlob = imageResponse.getBlob();
    var contentType = imageBlob.getContentType() || "image/jpeg";
    if (contentType.includes("application/pdf")) {
      contentType = "application/pdf";
    } else {
      contentType = "image/jpeg";
    }
    imageBase64 = Utilities.base64Encode(imageBlob.getBytes());
  } catch (e) {
    return { status: "ERROR", koreksi: "Error saat mengambil gambar: " + e.toString() };
  }

  const promptText = `Berikut adalah data pendaftaran calon siswa Kejar Paket (Sekolah Non-Formal):\n` +
                     `1. NIK: ${dataSiswa.nik}\n` +
                     `2. Nama Lengkap: ${dataSiswa.nama}\n` +
                     `3. Tempat Lahir: ${dataSiswa.tempatLahir}\n` +
                     `4. Tanggal Lahir: ${dataSiswa.tglLahir}\n` +
                     `5. Nama Ibu Kandung: ${dataSiswa.namaIbu}\n\n` +
                     `Dan terlampir adalah gambar foto dokumen pendukungnya (KK atau Ijazah).\n` +
                     `Tugasmu:\n` +
                     `1. Ekstrak 5 data spesifik di atas (NIK, Nama Lengkap, Tempat Lahir, Tanggal Lahir, Nama Ibu Kandung) dari dokumen yang terlampir.\n` +
                     `2. Bandingkan kelima data tersebut dengan input data teks di atas secara SANGAT TELITI dan KETAT.\n` +
                     `3. Kelima data tersebut HARUS sama persis dengan data di dokumen pendukung.\n` +
                     `4. Jika ada ketidaksesuaian ejaan, salah ketik, atau perbedaan angka/huruf sekecil apapun, jelaskan secara spesifik field mana yang salah dan sebutkan data yang benar berdasarkan gambar dokumen.\n` +
                     `Kembalikan respons murni dalam format JSON (tanpa markdown), dengan properti:\n` +
                     `{"status": "COCOK" | "TIDAK_COCOK", "koreksi": "Penjelasan detail jika tidak cocok (kosongkan jika cocok)"}`;

  const payload = {
    contents: [
      {
        parts: [
          { text: promptText },
          {
            inline_data: {
              mime_type: contentType,
              data: imageBase64
            }
          }
        ]
      }
    ],
    generationConfig: {
      responseMimeType: "application/json"
    }
  };

  const options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const resultJson = JSON.parse(response.getContentText());
    
    if (resultJson.candidates && resultJson.candidates.length > 0) {
      const aiContent = resultJson.candidates[0].content.parts[0].text;
      return JSON.parse(aiContent);
    } else {
      return { status: "ERROR", koreksi: "Gemini AI tidak mengembalikan format yang valid." };
    }
  } catch (e) {
    return { status: "ERROR", koreksi: "Terjadi kesalahan saat memanggil API Gemini: " + e.toString() };
  }
}
