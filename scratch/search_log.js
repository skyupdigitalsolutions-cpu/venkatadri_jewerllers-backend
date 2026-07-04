const fs = require("fs");
const path = require("path");

const logPath = "C:\\Users\\ADMIN\\.gemini\\antigravity\\brain\\1ac0f080-9daa-478c-939a-bd9a747e3793\\.system_generated\\tasks\\task-1853.log";

if (fs.existsSync(logPath)) {
  const content = fs.readFileSync(logPath, "utf8");
  const lines = content.split("\n");
  console.log("Total log lines:", lines.length);
  
  const matches = lines.filter(line => line.includes("forgot-password") || line.includes("send-otp") || line.includes("OTP") || line.includes("RESPONSE"));
  console.log("Matching lines count:", matches.length);
  console.log("Last 20 matching lines:");
  console.log(matches.slice(-20).join("\n"));
} else {
  console.log("Log file does not exist at", logPath);
}
