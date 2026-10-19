const functions = require("firebase-functions");
const cors = require("cors")({ origin: true });

/**
 * Cloud Function: sendSms
 * Mottar SMS-forespørsel fra Tid1Din (web-appen),
 * videresender direkte server-til-server til GatewayAPI,
 * og returnerer resultatet til klienten uten CORS-problemer.
 */
exports.sendSms = functions.https.onRequest((req, res) => {
  return cors(req, res, async () => {
    // Håndter CORS preflight
    if (req.method === "OPTIONS") {
      return res.status(204).send("");
    }

    // Tillat kun POST
    if (req.method !== "POST") {
      return res.status(405).json({
        ok: false,
        error: "Metode ikke tillatt. Vennligst bruk POST."
      });
    }

    try {
      // Håndter req.body uansett om det kommer som objekt, streng eller Buffer
      let body = req.body;
      if (typeof body === "string") {
        try {
          body = JSON.parse(body);
        } catch (e) {
          console.warn("Kunne ikke parse body som JSON-streng:", e);
          body = {};
        }
      } else if (Buffer.isBuffer(body)) {
        try {
          body = JSON.parse(body.toString("utf8"));
        } catch (e) {
          console.warn("Kunne ikke parse body fra Buffer:", e);
          body = {};
        }
      }
      body = body || {};

      // 1. Les ut mottaker-telefonnummer fleksibelt (både direkte felter og GatewayAPI 'recipients' array)
      let toPhone =
        body.toPhone ||
        body.phone ||
        body.to ||
        body.recipient ||
        body.msisdn;

      // Hvis forespørselen bruker GatewayAPI sitt eget format: { recipients: [{ msisdn: 47... }] }
      if (!toPhone && Array.isArray(body.recipients) && body.recipients.length > 0) {
        const first = body.recipients[0];
        if (typeof first === "object" && first !== null) {
          toPhone = first.msisdn || first.phone || first.to || first.number;
        } else {
          toPhone = first;
        }
      }

      // 2. Les ut melding
      const message = body.message || body.text || body.msg;

      // 3. Les ut avsender
      const sender = body.sender || body.from;

      // 4. Les ut API-nøkkel (enten fra body, eller fra Authorization-header, eller miljøvariabel)
      let apiKey = body.apiKey || body.key || body.token;
      if (!apiKey && req.headers && req.headers.authorization) {
        const auth = req.headers.authorization;
        if (auth.startsWith("Basic ")) {
          try {
            const decoded = Buffer.from(auth.substring(6), "base64").toString("utf8");
            apiKey = decoded.split(":")[0];
          } catch (e) {
            console.warn("Kunne ikke decode Basic Auth header:", e);
          }
        } else if (auth.startsWith("Bearer ")) {
          apiKey = auth.substring(7);
        }
      }

      if (!toPhone || !message) {
        return res.status(400).json({
          ok: false,
          error: "Påkrevde felter mangler: telefonnummer og melding må oppgis.",
          receivedKeys: Object.keys(body)
        });
      }

      const effectiveKey = String(apiKey || process.env.GATEWAY_API_KEY || "").trim();
      if (!effectiveKey || effectiveKey.length < 5) {
        return res.status(400).json({
          ok: false,
          error: "Ingen gyldig GatewayAPI-nøkkel ble oppgitt. Vennligst legg inn nøkkelen i innstillingene."
        });
      }

      // Rens og formater telefonnummer
      const rawDigits = String(toPhone).replace(/\D/g, "");
      const cleanDigits = rawDigits.startsWith("00") ? rawDigits.substring(2) : rawDigits;
      // Hvis norsk 8-sifret nummer, legg til landskode 47
      const formattedDigits = cleanDigits.length === 8 ? `47${cleanDigits}` : cleanDigits;
      const msisdnNumber = parseInt(formattedDigits, 10);

      if (isNaN(msisdnNumber) || formattedDigits.length < 8) {
        return res.status(400).json({
          ok: false,
          error: `Ugyldig telefonnummer: "${toPhone}". Vennligst sjekk nummeret.`
        });
      }

      // Avsendernavn: maks 11 tegn (alfanumerisk) eller 15 siffer
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
        const status = gatewayResponse.status;
        let errorMessage = responseData.message || rawText;

        if (status === 401) {
          errorMessage = "Feil 401 (Uautorisert): Ugyldig GatewayAPI-nøkkel. Sjekk at du har kopiert riktig token fra GatewayAPI > API > API Keys.";
        } else if (status === 402) {
          errorMessage = "Feil 402: Kontoen mangler SMS-kreditter. Vennligst fyll på saldo hos GatewayAPI.com.";
        } else if (status === 422) {
          errorMessage = `Feil 422 (Ugyldig data): ${errorMessage || "Sjekk at telefonnummeret og avsendernavnet er gyldig."}`;
        }

        return res.status(status).json({
          ok: false,
          status,
          error: errorMessage,
          raw: responseData
        });
      }

      return res.status(200).json({
        ok: true,
        status: 200,
        data: responseData
      });
    } catch (err) {
      console.error("Uventet feil i sendSms Cloud Function:", err);
      return res.status(500).json({
        ok: false,
        error: err.message || "Intern serverfeil ved utsendelse av SMS via GatewayAPI."
      });
    }
  });
});
