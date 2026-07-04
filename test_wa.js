const https = require("https");
require("dotenv").config();

const WA_AUTH_KEY = process.env.MSG91_WA_AUTHKEY || "501070Ah0sttMhO0H6a0e9be4P1";
const WA_INTEGRATED_NUMBER = process.env.MSG91_WA_INTEGRATED_NUMBER || "919591327778";

console.log("Using Auth Key:", WA_AUTH_KEY);
console.log("Using Integrated Number:", WA_INTEGRATED_NUMBER);

const payload = JSON.stringify({
  integrated_number: WA_INTEGRATED_NUMBER,
  recipient_number: "919591327778",
  content_type: "text",
  text: "Hello from AgriZip! Let's test the direct chat first."
});

const options = {
  hostname: "api.msg91.com",
  port: 443,
  path: "/api/v5/whatsapp/whatsapp-outbound-message/",
  method: "POST",
  headers: {
    "authkey": WA_AUTH_KEY,
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(payload)
  }
};

const req = https.request(options, (res) => {
  let data = "";
  res.on("data", (chunk) => { data += chunk; });
  res.on("end", () => {
    console.log("STATUS CODE:", res.statusCode);
    console.log("RESPONSE:", data);
  });
});

req.on("error", (e) => {
  console.error("Error sending:", e);
});

req.write(payload);
req.end();
