const https = require("https");

const getTwilioClient = () => {
  try {
    const twilio = require("twilio");
    const sid    = process.env.TWILIO_ACCOUNT_SID;
    const token  = process.env.TWILIO_AUTH_TOKEN;
    if (!sid || !token || sid === "your_twilio_account_sid") return null;
    return twilio(sid, token);
  } catch {
    return null;
  }
};

const sendSMS = async (to, message) => {
  const client = getTwilioClient();
  if (!client) {
    console.log(`[SMS SKIPPED - Twilio not configured] To: ${to} | Message: ${message}`);
    return false;
  }
  try {
    await client.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to:   `+91${to}`,
    });
    console.log(`SMS sent to ${to}`);
    return true;
  } catch (err) {
    console.error("SMS Error:", err.message);
    return false;
  }
};

const sendMsg91Otp = (to, otp) => {
  return new Promise((resolve) => {
    const authkey = process.env.MSG91_AUTHKEY;
    const templateId = process.env.MSG91_TEMPLATE_ID;
    const sender = process.env.MSG91_SENDER || "SKUPDS";

    if (!authkey || !templateId) {
      console.log(`[MSG91 SKIPPED - Not configured] To: ${to} | OTP: ${otp}`);
      return resolve(false);
    }

    let formattedPhone = to.trim().replace(/\D/g, "");
    if (formattedPhone.length === 10) {
      formattedPhone = `91${formattedPhone}`;
    }

    const variablesObj = {
      otp: otp,
      OTP: otp,
      var: otp,
      VAR: otp,
      var1: otp,
      VAR1: otp,
      var2: otp,
      VAR2: otp,
      Param1: otp,
      Param2: otp,
      code: otp,
      CODE: otp,
      token: otp,
      TOKEN: otp,
      token_value: otp,
      TOKEN_VALUE: otp,
      tokenvalue: otp,
      TOKENVALUE: otp,
      value: otp,
      VALUE: otp,
      otp_token: otp,
      OTP_TOKEN: otp,
      otp_code: otp,
      OTP_CODE: otp,
      val: otp,
      VAL: otp,
      temp: otp,
      TEMP: otp,
      otp_val: otp,
      OTP_VAL: otp,
      verification_code: otp,
      VERIFICATION_CODE: otp,
      msg: otp,
      MSG: otp,
      message: otp,
      MESSAGE: otp
    };

    // Detect if templateId is a 24-char hex string (MSG91 Flow ID format)
    const isFlowId = templateId.length === 24 && /^[0-9a-fA-F]+$/.test(templateId);

    if (isFlowId) {
      console.log(`[MSG91] Detected Flow ID "${templateId}". Sending via Flow API...`);
      const payload = JSON.stringify({
        template_id: templateId,
        flow_id: templateId,
        sender: sender,
        recipients: [
          {
            mobiles: formattedPhone,
            ...variablesObj
          }
        ]
      });

      const options = {
        hostname: "control.msg91.com",
        port: 443,
        path: "/api/v5/flow/",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "authkey": authkey,
          "Content-Length": Buffer.byteLength(payload)
        }
      };

      const req = https.request(options, (res) => {
        let data = "";
        res.on("data", (chunk) => { data += chunk; });
        res.on("end", () => {
          try {
            const parsed = JSON.parse(data);
            console.log("[MSG91 FLOW RESPONSE]", parsed);
            resolve(parsed.type === "success" || parsed.success === true);
          } catch {
            console.log("[MSG91 FLOW RESPONSE TEXT]", data);
            resolve(res.statusCode >= 200 && res.statusCode < 300);
          }
        });
      });

      req.on("error", (err) => {
        console.error("MSG91 Flow Error:", err.message);
        resolve(false);
      });

      req.write(payload);
      req.end();
    } else {
      console.log(`[MSG91] Sending via standard OTP API...`);
      const payload = JSON.stringify({
        template_id: templateId,
        mobile: formattedPhone,
        authkey: authkey,
        sender: sender,
        otp: otp,
        OTP: otp,
        variables: variablesObj,
        ...variablesObj
      });

      const options = {
        hostname: "control.msg91.com",
        port: 443,
        path: `/api/v5/otp?template_id=${templateId}&mobile=${formattedPhone}&authkey=${authkey}&otp=${otp}&OTP=${otp}&var=${otp}&VAR=${otp}&var1=${otp}&var2=${otp}&Param1=${otp}&Param2=${otp}&code=${otp}&CODE=${otp}&token=${otp}&TOKEN=${otp}&token_value=${otp}&TOKEN_VALUE=${otp}&tokenvalue=${otp}&TOKENVALUE=${otp}&value=${otp}&VALUE=${otp}&otp_token=${otp}&OTP_TOKEN=${otp}`,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "authkey": authkey,
          "Content-Length": Buffer.byteLength(payload)
        }
      };

      const req = https.request(options, (res) => {
        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          try {
            const parsed = JSON.parse(data);
            console.log("[MSG91 RESPONSE]", parsed);
            resolve(parsed.type === "success" || parsed.success === true);
          } catch {
            console.log("[MSG91 RESPONSE TEXT]", data);
            resolve(res.statusCode >= 200 && res.statusCode < 300);
          }
        });
      });

      req.on("error", (err) => {
        console.error("MSG91 Error:", err.message);
        resolve(false);
      });

      req.write(payload);
      req.end();
    }
  });
};

module.exports = { sendSMS, sendMsg91Otp };
