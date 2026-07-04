const fs = require("fs");

const logPath = "C:\\Users\\ADMIN\\.gemini\\antigravity\\brain\\1ac0f080-9daa-478c-939a-bd9a747e3793\\.system_generated\\tasks\\task-1853.log";

if (fs.existsSync(logPath)) {
  const content = fs.readFileSync(logPath, "utf8");
  const lines = content.split("\n");
  console.log("Searching for forgot-password lines...");
  lines.forEach((line, index) => {
    if (line.includes("forgot-password") || line.includes("send-otp") || line.includes("verify-otp") || line.includes("MSG91")) {
      console.log(`\n--- Line ${index + 1} ---`);
      // Print a few lines before and after to get full request/response context
      const start = Math.max(0, index - 2);
      const end = Math.min(lines.length - 1, index + 5);
      for (let i = start; i <= end; i++) {
        console.log(`${i + 1}: ${lines[i]}`);
      }
    }
  });
} else {
  console.log("Log file does not exist");
}
