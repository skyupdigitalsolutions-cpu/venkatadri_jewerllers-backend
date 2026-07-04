const https = require("https");

/**
 * MSG91 WhatsApp Cloud API Helper
 * Sends WhatsApp template messages via MSG91's integrated WhatsApp number
 */
const WA_AUTH_KEY = process.env.MSG91_WA_AUTHKEY;
const WA_INTEGRATED_NUMBER = process.env.MSG91_WA_INTEGRATED_NUMBER;

/**
 * sendWhatsApp — send a single WhatsApp message via MSG91
 * @param {string} to         - recipient phone (10-digit or 91xxxxxxxxxx)
 * @param {string} name       - recipient name for personalisation
 * @param {string} message    - plain text message body
 * @param {string} [templateName] - MSG91 template name (if null/omitted, sends as direct free-form text chat)
 */
const sendWhatsApp = (to, name, message, templateName = null) => {
  return new Promise((resolve) => {
    if (!WA_AUTH_KEY) {
      console.log(`[WA SKIPPED - Not configured] To: ${to} | Msg: ${message}`);
      return resolve({ success: false, reason: "not_configured" });
    }

    // Normalise phone to 91xxxxxxxxxx
    let phone = to.trim().replace(/\D/g, "");
    if (phone.length === 10) phone = `91${phone}`;

    let payload;
    let path;

    if (templateName && templateName !== "text") {
      // Send as Template message (using bulk endpoint as per MSG91 templates)
      path = "/api/v5/whatsapp/whatsapp-outbound-message/bulk/";
      payload = JSON.stringify({
        integrated_number: WA_INTEGRATED_NUMBER,
        content_type: "template",
        payload: [
          {
            to: phone,
            type: "template",
            template: {
              name: templateName,
              language: { code: "en" },
              components: [
                {
                  type: "body",
                  parameters: [
                    { type: "text", text: name    },
                    { type: "text", text: message },
                  ],
                },
              ],
            },
          },
        ],
      });
    } else {
      // Send as direct outbound Text session message
      path = "/api/v5/whatsapp/whatsapp-outbound-message/";
      payload = JSON.stringify({
        integrated_number: WA_INTEGRATED_NUMBER,
        recipient_number: phone,
        content_type: "text",
        text: message
      });
    }

    const options = {
      hostname: "api.msg91.com",
      port: 443,
      path: path,
      method: "POST",
      headers: {
        "authkey": WA_AUTH_KEY,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
      },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          console.log(`[WA RESPONSE to ${phone}]`, parsed);
          const ok = parsed.status === "success" || parsed.type === "success" || parsed.hasError === false || parsed.success === true || res.statusCode < 300;
          resolve({ success: ok, data: parsed });
        } catch {
          console.log(`[WA RESPONSE TEXT to ${phone}]`, data);
          resolve({ success: res.statusCode < 300, raw: data });
        }
      });
    });

    req.on("error", (err) => {
      console.error("WhatsApp API Error:", err.message);
      resolve({ success: false, error: err.message });
    });

    req.write(payload);
    req.end();
  });
};

/**
 * sendBulkWhatsApp — send WhatsApp to multiple recipients
 * @param {Array<{phone, name, message}>} recipients
 * @param {string} [templateName]
 */
const sendBulkWhatsApp = async (recipients, templateName = null) => {
  if (!WA_AUTH_KEY) {
    console.log("[WA BULK SKIPPED - Not configured]");
    return { success: false, reason: "not_configured", sent: 0, failed: recipients.length };
  }

  const results = await Promise.allSettled(
    recipients.map((r) => sendWhatsApp(r.phone, r.name, r.message, templateName))
  );

  let sent = 0, failed = 0;
  results.forEach((r) => {
    if (r.status === "fulfilled" && r.value?.success) sent++;
    else failed++;
  });

  return { success: true, sent, failed, total: recipients.length };
};

module.exports = { sendWhatsApp, sendBulkWhatsApp };
