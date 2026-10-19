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
    // Tillat kun POST
    if (req.method !== "POST") {
      return res.status(405).json({
        ok: false,
        error: "Metode ikke tillatt. Vennligst bruk POST."
      });
    }

    try {
      const { toPhone, message, sender, apiKey } = req.body || {};

      if (!toPhone || !message) {
        return res.status(400).json({
          ok: false,
          error: "Påkrevde felter mangler: 'toPhone' og 'message' må oppgis."
        });
      }

      // Bruk innsendt API-nøkkel fra innstillinger (eller miljøvariabel som fallback)
      const effectiveKey = (apiKey || process.env.GATEWAY_API_KEY || "").trim();
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
