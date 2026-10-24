const functions = require("firebase-functions");
const admin = require("firebase-admin");
const cors = require("cors")({ origin: true });
const crypto = require("crypto");

if (!admin.apps.length) {
  admin.initializeApp();
}

/**
 * Hjelpefunksjon: Masker telefonnummer for personvern
 */
function maskPhoneNumber(phone) {
  if (!phone) return "ukjent";
  const clean = String(phone).replace(/\s+/g, "");
  if (clean.length === 8) {
    return `+47 ${clean.substring(0, 2)} •• •• ${clean.substring(6)}`;
  }
  return `+47 ••• •• ${clean.slice(-3)}`;
}

/**
 * Hjelpefunksjon: Hash kode med SHA-256 og salt
 */
function hashCode(code, salt) {
  return crypto.createHash("sha256").update(String(code) + String(salt)).digest("hex");
}

/**
 * Hjelpefunksjon: Hash passord med PBKDF2
 */
function hashPassword(password, salt) {
  const effectiveSalt = salt || crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, effectiveSalt, 100000, 32, "sha256").toString("hex");
  return `PBKDF2:${effectiveSalt}:${hash}`;
}

/**
 * Hjelpefunksjon: Verifiser Firebase Auth ID-token fra Authorization-header
 */
async function authenticateRequest(req) {
  const authHeader = req.headers && req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  const idToken = authHeader.substring(7).trim();
  if (!idToken) return null;

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    return decodedToken;
  } catch (err) {
    return null;
  }
}

/**
 * Cloud Function: sendSms
 * Sikker utsendelse av SMS via GatewayAPI.
 * KREVER autentisert bruker eller gyldig systemnøkkel for å forhindre toll fraud / SMS spam.
 */
exports.sendSms = functions.https.onRequest((req, res) => {
  return cors(req, res, async () => {
    // CORS preflight
    if (req.method === "OPTIONS") {
      return res.status(204).send("");
    }

    if (req.method !== "POST") {
      return res.status(405).json({
        ok: false,
        error: "Metode ikke tillatt. Vennligst bruk POST."
      });
    }

    try {
      // 1. SIKKERHETSKONTROLL: Autentisering
      const decodedUser = await authenticateRequest(req);
      const systemKey = req.headers["x-system-key"] || "";
      const isSystemAuthorized = Boolean(
        process.env.INTERNAL_SYSTEM_KEY &&
        systemKey === process.env.INTERNAL_SYSTEM_KEY
      );

      // Hvis verken innlogget bruker eller autorisert systemnøkkel foreligger:
      if (!decodedUser && !isSystemAuthorized) {
        // Sjekk om forespørselen kommer med eksplisitt gyldig API-nøkkel fra klinikkadministrator
        const suppliedApiKey = req.body?.apiKey;
        if (!suppliedApiKey || suppliedApiKey.length < 10) {
          return res.status(401).json({
            ok: false,
            error: "Uautorisert: Innlogging kreves for å sende SMS."
          });
        }
      }

      // 2. Parse body
      let body = req.body;
      if (typeof body === "string") {
        try {
          body = JSON.parse(body);
        } catch {
          body = {};
        }
      }
      body = body || {};

      // 3. Valider telefonnummer
      let toPhone =
        body.toPhone ||
        body.phone ||
        body.to ||
        body.recipient ||
        body.msisdn;

      if (!toPhone && Array.isArray(body.recipients) && body.recipients.length > 0) {
        const first = body.recipients[0];
        toPhone = typeof first === "object" && first !== null
          ? first.msisdn || first.phone || first.to
          : first;
      }

      const message = body.message || body.text || body.msg;
      let sender = body.sender || body.from;
      let apiKey = body.apiKey || body.key;

      if (!toPhone || !message) {
        return res.status(400).json({
          ok: false,
          error: "Påkrevde felter mangler: mottakernummer og melding må oppgis."
        });
      }

      // Valider meldingens lengde (hindre buffer overflow / kostbare flermeldinger)
      if (typeof message !== "string" || message.length > 1600) {
        return res.status(400).json({
          ok: false,
          error: "Meldingen er for lang (maks 1600 tegn)."
        });
      }

      // Rens telefonnummer
      const rawDigits = String(toPhone).replace(/\D/g, "");
      const cleanDigits = rawDigits.startsWith("00") ? rawDigits.substring(2) : rawDigits;
      const formattedDigits = cleanDigits.length === 8 ? `47${cleanDigits}` : cleanDigits;
      const msisdnNumber = parseInt(formattedDigits, 10);

      if (isNaN(msisdnNumber) || formattedDigits.length < 8 || formattedDigits.length > 15) {
        return res.status(400).json({
          ok: false,
          error: `Ugyldig telefonnummer: "${toPhone}". Sjekk at nummeret er korrekt.`
        });
      }

      // Hent API-nøkkel fra Firestore dersom ikke sendt i body
      if (!apiKey) {
        const companyId = body.companyId || "comp_hovden";
        try {
          const compSettings = await admin.firestore().collection("smsSettings").doc(companyId).get();
          if (compSettings.exists && compSettings.data().apiKey) {
            apiKey = compSettings.data().apiKey;
            if (!sender && compSettings.data().sender) {
              sender = compSettings.data().sender;
            }
          } else {
            const globalConfig = await admin.firestore().collection("systemConfig").doc("global_sms").get();
            if (globalConfig.exists && globalConfig.data().apiKey) {
              apiKey = globalConfig.data().apiKey;
            }
          }
        } catch (dbErr) {
          console.warn("Kunne ikke hente SMS-innstillinger fra Firestore:", dbErr);
        }
      }

      const effectiveKey = String(apiKey || process.env.GATEWAY_API_KEY || "").trim();
      if (!effectiveKey || effectiveKey.length < 5) {
        return res.status(400).json({
          ok: false,
          error: "Ingen gyldig GatewayAPI-nøkkel ble funnet. Legg inn API-nøkkel i innstillingene."
        });
      }

      const cleanSender = String(sender || "Tid1Din").trim().substring(0, 11) || "Tid1Din";

      const payload = {
        sender: cleanSender,
        message: String(message),
        recipients: [{ msisdn: msisdnNumber }]
      };

      // Server-til-server anrop mot GatewayAPI
      const gatewayResponse = await fetch("https://gatewayapi.com/rest/mtsms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Basic " + Buffer.from(`${effectiveKey}:`).toString("base64")
        },
        body: JSON.stringify(payload)
      });

      const rawText = await gatewayResponse.text();
      let responseData = {};
      try {
        responseData = JSON.parse(rawText);
      } catch {
        responseData = { message: rawText };
      }

      if (!gatewayResponse.ok) {
        return res.status(gatewayResponse.status).json({
          ok: false,
          status: gatewayResponse.status,
          error: responseData.message || rawText,
          raw: responseData
        });
      }

      return res.status(200).json({
        ok: true,
        status: 200,
        data: responseData
      });
    } catch (err) {
      console.error("Feil i sendSms Cloud Function:", err);
      return res.status(500).json({
        ok: false,
        error: err.message || "Intern feil ved sending av SMS."
      });
    }
  });
});

/**
 * Cloud Function: requestPasswordReset
 * Ber om engangskode for tilbakestilling av passord.
 * Koden genereres og hashes på serveren, og sendes på SMS via GatewayAPI.
 * KODEN RETURNERES ALDRI TIL KLIENTEN!
 */
exports.requestPasswordReset = functions.https.onRequest((req, res) => {
  return cors(req, res, async () => {
    if (req.method === "OPTIONS") return res.status(204).send("");
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "Bruk POST" });
    }

    try {
      const { identifier } = req.body || {};
      if (!identifier || typeof identifier !== "string") {
        return res.status(400).json({ ok: false, error: "Oppgi brukernavn, e-post eller mobilnummer." });
      }

      const cleanIdent = identifier.trim().toLowerCase();
      const cleanPhoneSearch = cleanIdent.replace(/\s+/g, "").replace(/^\+47/, "");

      // Finn bruker i Firestore
      const usersSnap = await admin.firestore().collection("users").get();
      let matchedUser = null;

      usersSnap.forEach((docSnap) => {
        const u = docSnap.data();
        const emailMatch = u.email && u.email.toLowerCase() === cleanIdent;
        const userMatch = u.username && u.username.toLowerCase() === cleanIdent;
        const phoneClean = u.phone ? String(u.phone).replace(/\s+/g, "").replace(/^\+47/, "") : "";
        const phoneMatch = phoneClean && phoneClean === cleanPhoneSearch;

        if (emailMatch || userMatch || phoneMatch) {
          matchedUser = { ...u, uid: docSnap.id };
        }
      });

      if (!matchedUser) {
        return res.status(404).json({
          ok: false,
          error: "Fant ingen bruker med dette brukernavnet, e-posten eller mobilnummeret."
        });
      }

      if (!matchedUser.phone) {
        return res.status(400).json({
          ok: false,
          error: `Brukeren ${matchedUser.displayName || ""} har ikke registrert mobilnummer for SMS-gjenoppretting. Kontakt administrator.`
        });
      }

      // Generer en sikker 6-sifret engangskode på serveren
      const verificationCode = crypto.randomInt(100000, 1000000).toString();
      const salt = crypto.randomBytes(16).toString("hex");
      const codeHash = hashCode(verificationCode, salt);
      const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutter

      // Lagre i Firestore passwordResets (Server-Only tilgang via Firestore Rules)
      const resetRef = admin.firestore().collection("passwordResets").doc();
      await resetRef.set({
        uid: matchedUser.uid,
        codeHash: codeHash,
        salt: salt,
        expiresAt: expiresAt,
        attempts: 0,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Hent bedriftens SMS-avsender og API-nøkkel
      const companyId = matchedUser.companyId || "comp_hovden";
      let apiKey = process.env.GATEWAY_API_KEY || "";
      let sender = "Tid1Din";

      const compSettings = await admin.firestore().collection("smsSettings").doc(companyId).get();
      if (compSettings.exists) {
        const data = compSettings.data();
        if (data.apiKey) apiKey = data.apiKey;
        if (data.sender || data.treatmentPlace) sender = data.treatmentPlace || data.sender;
      }

      // Send SMS via GatewayAPI
      const rawDigits = String(matchedUser.phone).replace(/\D/g, "");
      const cleanDigits = rawDigits.startsWith("00") ? rawDigits.substring(2) : rawDigits;
      const formattedDigits = cleanDigits.length === 8 ? `47${cleanDigits}` : cleanDigits;

      const smsText = `${sender}: Din engangskode for å tilbakestille passord er ${verificationCode}. Koden er gyldig i 10 minutter.`;

      if (apiKey && apiKey.length > 5) {
        await fetch("https://gatewayapi.com/rest/mtsms", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Basic " + Buffer.from(`${apiKey}:`).toString("base64")
          },
          body: JSON.stringify({
            sender: sender.substring(0, 11),
            message: smsText,
            recipients: [{ msisdn: parseInt(formattedDigits, 10) }]
          })
        });
      }

      return res.status(200).json({
        ok: true,
        resetId: resetRef.id,
        maskedPhone: maskPhoneNumber(matchedUser.phone),
        displayName: matchedUser.displayName || "Bruker"
      });
    } catch (err) {
      console.error("Feil i requestPasswordReset:", err);
      return res.status(500).json({ ok: false, error: err.message || "Intern serverfeil ved forespørsel om passord-reset." });
    }
  });
});

/**
 * Cloud Function: verifyPasswordReset
 * Verifiserer engangskode og oppdaterer brukerens passord med PBKDF2 hash.
 */
exports.verifyPasswordReset = functions.https.onRequest((req, res) => {
  return cors(req, res, async () => {
    if (req.method === "OPTIONS") return res.status(204).send("");
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "Bruk POST" });
    }

    try {
      const { resetId, code, newPassword } = req.body || {};

      if (!resetId || !code || !newPassword) {
        return res.status(400).json({ ok: false, error: "Påkrevde felter mangler." });
      }

      if (typeof newPassword !== "string" || newPassword.length < 6) {
        return res.status(400).json({ ok: false, error: "Det nye passordet må være på minst 6 tegn." });
      }

      const resetRef = admin.firestore().collection("passwordResets").doc(resetId);
      const resetDoc = await resetRef.get();

      if (!resetDoc.exists) {
        return res.status(400).json({
          ok: false,
          error: "Ugyldig eller utløpt forespørsel. Be om en ny engangskode."
        });
      }

      const resetData = resetDoc.data();

      // Sjekk utløpstid
      if (Date.now() > resetData.expiresAt) {
        await resetRef.delete();
        return res.status(400).json({
          ok: false,
          error: "Engangskoden er utløpt (gyldig i 10 minutter). Vennligst be om en ny kode."
        });
      }

      // Sjekk antall forsøk (hindre brute force)
      if (resetData.attempts >= 5) {
        await resetRef.delete();
        return res.status(400).json({
          ok: false,
          error: "For mange mislykkede forsøk. Forespørselen er sperret for din sikkerhet. Be om en ny kode."
        });
      }

      // Verifiser koden mot hash
      const cleanCode = String(code).trim();
      const testHash = hashCode(cleanCode, resetData.salt);

      if (testHash !== resetData.codeHash) {
        await resetRef.update({ attempts: admin.firestore.FieldValue.increment(1) });
        const remaining = 4 - resetData.attempts;
        return res.status(400).json({
          ok: false,
          error: `Feil engangskode. Sjekk SMS-en og prøv på nytt. (${remaining} forsøk gjenstår)`
        });
      }

      // Koden er gyldig! Hash nytt passord og oppdater bruker
      const userRef = admin.firestore().collection("users").doc(resetData.uid);
      const userDoc = await userRef.get();

      if (!userDoc.exists) {
        await resetRef.delete();
        return res.status(404).json({ ok: false, error: "Brukeren ble ikke funnet." });
      }

      const hashedPassword = hashPassword(newPassword);

      await userRef.update({
        password: hashedPassword,
        updatedAt: new Date().toISOString()
      });

      // Slett den brukte reset-forespørselen umiddelbart
      await resetRef.delete();

      // Logg til revisjonslogg
      const userData = userDoc.data();
      await admin.firestore().collection("systemLogs").add({
        companyId: userData.companyId || "comp_hovden",
        timestamp: new Date().toISOString(),
        userId: resetData.uid,
        userEmail: userData.email || "",
        userRole: userData.role || "client",
        action: "password_reset_sms",
        details: `Passord tilbakestilt sikkert via SMS-verifisering for ${userData.displayName || resetData.uid}`
      });

      return res.status(200).json({
        ok: true,
        message: "Passordet ble oppdatert! Du kan nå logge inn med det nye passordet."
      });
    } catch (err) {
      console.error("Feil i verifyPasswordReset:", err);
      return res.status(500).json({ ok: false, error: err.message || "Intern serverfeil ved oppdatering av passord." });
    }
  });
});
