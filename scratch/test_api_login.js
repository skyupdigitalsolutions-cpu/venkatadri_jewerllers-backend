const http = require("http");

const testApiLogin = () => {
  return new Promise((resolve) => {
    const payload = JSON.stringify({
      email: "virat@gmail.com",
      password: "123456",
      captchaInput: "BYPASS",
      captchaToken: "test_token"
    });

    const options = {
      hostname: "localhost",
      port: 5000,
      path: "/api/auth/admin/login",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload)
      }
    };

    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          console.log("[API RESPONSE]", res.statusCode, parsed);
          resolve(parsed);
        } catch {
          console.log("[API RESPONSE TEXT]", res.statusCode, data);
          resolve(data);
        }
      });
    });

    req.on("error", (err) => {
      console.error("API Error:", err.message);
      resolve(err);
    });

    req.write(payload);
    req.end();
  });
};

testApiLogin();
