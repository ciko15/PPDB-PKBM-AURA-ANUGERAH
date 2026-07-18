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
    imageBase64 = Utilities.base64Encode(imageBlob.getBytes());
  } catch (e) {
    return { status: "ERROR", koreksi: "Error saat mengambil gambar: " + e.toString() };
  }

  const promptText = `Berikut adalah data pendaftaran calon siswa Kejar Paket (Sekolah Non-Formal):\n` +
                     `Nama: ${dataSiswa.nama}\nNIK: ${dataSiswa.nik}\nNISN: ${dataSiswa.nisn}\n` +
                     `Tempat & Tanggal Lahir: ${dataSiswa.tempatLahir}, ${dataSiswa.tglLahir}\n` +
                     `Nama Ibu Kandung: ${dataSiswa.namaIbu}\n\n` +
                     `Dan terlampir adalah gambar foto dokumen pendukungnya (Bisa berupa Ijazah atau Kartu Keluarga).\n` +
                     `Tugasmu:\n` +
                     `1. Ekstrak data relevan dari dokumen.\n` +
                     `2. Bandingkan dengan data teks di atas secara teliti.\n` +
                     `3. Jika ada ketidaksesuaian sekecil apapun (termasuk beda ejaan Tempat Lahir atau Nama Ibu), jelaskan bagian mana yang salah dan berikan data yang benar dari gambar.\n` +
                     `Kembalikan respons murni dalam format JSON (tanpa markdown), dengan properti:\n` +
                     `{"status": "COCOK" | "TIDAK_COCOK", "koreksi": "Penjelasan detail di sini (kosongkan jika cocok)"}`;

  const payload = {
    contents: [
      {
        parts: [
          { text: promptText },
          {
            inline_data: {
              mime_type: "image/jpeg",
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
