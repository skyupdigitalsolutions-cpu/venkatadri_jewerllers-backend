const https = require("https");

const testSendFlow = (phone, otp) => {
  return new Promise((resolve) => {
    const authkey = "501070AVQtEfbTE4E6a081d2eP1";
    const flowId = "6a08117b0e61e323ba0aee52";
    const sender = "SKUPDS";

    let formattedPhone = phone.trim().replace(/\D/g, "");
    if (formattedPhone.length === 10) {
      formattedPhone = `91${formattedPhone}`;
    }

    const payload = JSON.stringify({
      template_id: flowId,
      flow_id: flowId,
      sender: sender,
      recipients: [
        {
          mobiles: formattedPhone,
          otp: otp,
          OTP: otp,
          var: otp,
          VAR: otp,
          var1: otp,
          VAR1: otp,
          var2: otp,
          VAR2: otp,
          code: otp,
          CODE: otp,
          token: otp,
          TOKEN: otp,
          otp_code: otp,
          OTP_CODE: otp,
          val: otp,
          VAL: otp,
          value: otp,
          VALUE: otp,
          temp: otp,
          TEMP: otp
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

    console.log("Sending Flow SMS with payload:", payload);

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          console.log("[MSG91 FLOW RESPONSE]", parsed);
          resolve(parsed);
        } catch {
          console.log("[MSG91 FLOW RESPONSE TEXT]", data);
          resolve(data);
        }
      });
    });

    req.on("error", (err) => {
      console.error("MSG91 Flow Error:", err.message);
      resolve(err);
    });

    req.write(payload);
    req.end();
  });
};

testSendFlow("8722992405", "654321")
  .then((res) => {
    console.log("Finished Flow test, result:", res);
  });
