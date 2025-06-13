const functions = require("firebase-functions");
const {google} = require("googleapis");
const {promisify} = require("util");
const Busboy = require("busboy");
const path = require("path");
const os = require("os");
const fs = require("fs");

// --- CONFIGURACIÓN DE AUTENTICACIÓN Y GOOGLE DRIVE ---

// 1. Credenciales de la Cuenta de Servicio (las que me pasaste)
const serviceAccountCreds = {
  client_email: "drive-uploader-bot@ivory-bonus-462813-m8.iam.gserviceaccount.com",
  private_key: "-----BEGIN PRIVATE KEY-----\nMIIEvwIBADANBgkqhkiG9w0BAQEFAASCBKkwggSlAgEAAoIBAQC6SVNFXk0Iq5sf\nF8HYuPi+K1t3iq/o83CaeMY1bH5HfPl0niOQxxHKiDR2aI4t5fxpgq1YgoCnB4mm\ngte16iTrkRLfaS7Uw7/fMVnpsq+YVwa4s7ITYWp1/GPpTbKfOULIyhIAkzFp/FKF\nAcOZ7xL/6agQpcD6nDPMR3ftoND8oPyxL1FyFvN7UQUwx78kX4KXxNJPdGlXoH7r\n/duUUv0aNRQ4Z4Ago1HVs9va/alK/3+sgGeaKRtIMqyn6mgSaKHx6P+Y3A0Y8mT3\nbSXTz84cvhiVk9rCjlJbDkar2ac+/Js+fA/aSSfiDa4M/0WWPBrT5clZzZQ+kOHB\nUpTJqsBzAgMBAAECggEAB27bkr4DhuAKDYCOLI6c5kGmoat3/2yPRqqhBgqxMzsK\nXRveQW2gCRvMNBlR6wTtQGyFbC2w4nlLhchcwRZ5qKiePyncQ4MYCdjXRJrrpMF8\nNCx/Y4SUkeajOfDuuqm3P3nIpBs7coYt6L68Rk0izfFN0nQ6sgU/j9weLe4nyJy2\naqwM4eAgEmBVOvjgeFDUyegb/Ds9Io+hZpLJ4r5hKhWF99sdpWxCBA5gPX2QqRsa\nqohPtAez45e84BZVDGJ2rU6HtYJ1jZ0SOlzwMkq//ZOxAX2Cu93GqFTaZNJiAiYa\nldVdZZ2kWBRzskYcNEIl3AT4o6GHHNyjczs6pgqleQKBgQDdX/KOh6xaWSloWLv4\nU70TS8QBw1hAnzLyXdkGtOsLTvhxHSPbYxxy9bQLNAYgvDaOgT+lmMmslUyAQhok\ntyshJWCcNhyztMUDXX1W7+z3etkCvgGHPSi2fU1ybFYnw6lIL3m0dvm+txBJAVWv\nmjnHnf92uTui4Fa475/9ToK9fQKBgQDXbGgsW5WUe7DN9U5/uRwcNU0WN2hJcAHd\nyiLUIqKX+ij0a+xFPP9vuz/ojVZIXqSL+rLI0yAy8/BoIcFFibDq1/dmzugqfdzs\n9roCEVC/sUu40oc98mdq6EauS8XKaylaTyLvHbOpODnRo9AcQz5S/5VlRDyzKl3D\naSzgYz2YrwKBgQDYq2AsQH5gr4PnrXHMy6jzieR+FUP7e9XRgik4dzrWBqUDkRHX\nWFov6mwdyv10bMK5F6fD3JcHY9lMb2ZHKT/9YSf9vLi66uMpOAfFX27/ii18kZvN\nUf7XHiz/ISnyIX8+N7lW+FvYXjSCP9wt0zVaOzoeaY4FDK3UtDRTKNStwQKBgQCm\n3tS7N55gzIeiotjR20RJHYi/IuBnspnfggsEpGeqrh83Zro40A1WMYhJzeH+YUG5\nJNOE+PZCQfAB2dPq18PxxqVgP/pbn++Yp25i16LjOqVbX8lfVPyDNbY6oXtvVx9L\nU23OKAXZmTJAkFJO8k++3ziMnxUd/D1xd3FJx9YZBQKBgQCndlAA+3ngFyQai0cf\n9lUvswDpa5SBtIKC0R4QnYaYMMSUyMlA2DF9RiE2x5TDk5TjpQq5tTKXOiTBtusZ\nJ7c8TMDAWoJKr3TcTdT9hz2ydH0vKi4XqJ6tbXzsnORG5axL1tr6uVVFuoKu1OmJ\nIYW6o0Kq1h99djX2YzyTt6NTtQ==\n-----END PRIVATE KEY-----\n".replace(/\\n/g, "\n"),
};

// 2. ID de la carpeta de destino en Google Drive
const driveFolderId = "1T1EGwqy82936m8iBMtwCUw4m-ejdXjnD";

// 3. Autenticación con Google
const auth = new google.auth.GoogleAuth({
  credentials: serviceAccountCreds,
  scopes: ["https://www.googleapis.com/auth/drive"],
});

const drive = google.drive({version: "v3", auth});

// --- LA CLOUD FUNCTION PRINCIPAL ---

exports.uploadToDrive = functions.https.onRequest((req, res) => {
  // Configuración de CORS para permitir solicitudes desde nuestra app web
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "POST");
  res.set("Access-Control-Allow-Headers", "Content-Type");

  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  const busboy = new Busboy({headers: req.headers});
  const tmpdir = os.tmpdir();
  const uploads = {};

  busboy.on("file", (fieldname, file, filename, encoding, mimetype) => {
    const filepath = path.join(tmpdir, filename);
    const writeStream = fs.createWriteStream(filepath);
    file.pipe(writeStream);

    const promise = new Promise((resolve, reject) => {
      file.on("end", () => {
        writeStream.end();
      });
      writeStream.on("finish", () => {
        uploads[fieldname] = {filepath, mimetype, filename};
        resolve();
      });
      writeStream.on("error", reject);
    });
    uploads[fieldname] = promise;
  });

  busboy.on("finish", async () => {
    try {
      await Promise.all(Object.values(uploads));
      const imageFile = Object.values(uploads)[0];

      const response = await drive.files.create({
        requestBody: {
          name: `${Date.now()}_${imageFile.filename}`,
          parents: [driveFolderId],
        },
        media: {
          mimeType: imageFile.mimetype,
          body: fs.createReadStream(imageFile.filepath),
        },
        fields: "id, webViewLink",
      });

      // Hacemos el archivo público para que se pueda ver en la web
      await drive.permissions.create({
        fileId: response.data.id,
        requestBody: {
          role: "reader",
          type: "anyone",
        },
      });

      // Construimos una URL que se pueda usar en un <img>
      const publicUrl = `https://drive.google.com/uc?id=${response.data.id}`;

      fs.unlinkSync(imageFile.filepath); // Limpiamos el archivo temporal

      return res.status(200).json({imageUrl: publicUrl});
    } catch (error) {
      console.error("Error al subir a Drive:", error);
      return res.status(500).send("Error interno al subir el archivo.");
    }
  });

  busboy.end(req.rawBody);
});
