const http = require("http");

const testServerOtp = () => {
  return new Promise((resolve) => {
    const payload = JSON.stringify({
      phone: "8722992405"
    });

    const options = {
      hostname: "localhost",
      port: 5000,
      path: "/api/auth/admin/forgot-password/send-otp",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload)
      }
    };

    console.log("Triggering server forgot-password OTP...");
    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          console.log("[SERVER RESPONSE]", res.statusCode, parsed);
          resolve(parsed);
        } catch {
          console.log("[SERVER RESPONSE TEXT]", res.statusCode, data);
          resolve(data);
        }
      });
    });

    req.on("error", (err) => {
      console.error("Server Request Error:", err.message);
      resolve(err);
    });

    req.write(payload);
    req.end();
  });
};

testServerOtp();
