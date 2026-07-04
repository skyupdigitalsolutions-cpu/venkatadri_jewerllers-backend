const https = require("https");

const testSendOtp = (phone, otp) => {
  return new Promise((resolve) => {
    const authkey = "501070AVQtEfbTE4E6a081d2eP1";
    const templateId = "6a08117b0e61e323ba0aee52";
    const sender = "SKUPDS";

    let formattedPhone = phone.trim().replace(/\D/g, "");
    if (formattedPhone.length === 10) {
      formattedPhone = `91${formattedPhone}`;
    }

    // Pass variables both at root level and inside nested variables object for maximum compatibility
    const variablesObj = {
      otp: otp,
      OTP: otp,
      var: otp,
      VAR: otp,
      var1: otp,
      var2: otp,
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
      OTP_TOKEN: otp
    };

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

    // We also pass all parameters in the URL query string
    const queryParams = new URLSearchParams({
      template_id: templateId,
      mobile: formattedPhone,
      authkey: authkey,
      otp: otp,
      sender: sender,
      ...variablesObj
    }).toString();

    const options = {
      hostname: "control.msg91.com",
      port: 443,
      path: `/api/v5/otp?${queryParams}`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "authkey": authkey,
        "Content-Length": Buffer.byteLength(payload)
      }
    };

    console.log("Sending OTP with payload:", payload);
    console.log("Sending OTP with URL path:", options.path);

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          console.log("[MSG91 RESPONSE]", parsed);
          resolve(parsed);
        } catch {
          console.log("[MSG91 RESPONSE TEXT]", data);
          resolve(data);
        }
      });
    });

    req.on("error", (err) => {
      console.error("MSG91 Error:", err.message);
      resolve(err);
    });

    req.write(payload);
    req.end();
  });
};

testSendOtp("8722992405", "123456")
  .then((res) => {
    console.log("Finished test, result:", res);
  });
