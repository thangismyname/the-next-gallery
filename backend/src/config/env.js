import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// __dirname không có sẵn trong ES Modules nên phải tự dựng lại
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// File này nằm ở backend/src/config/env.js
// => lên 3 cấp (config -> src -> backend) sẽ ra tới root The_Next_Gallery/
const envPath = path.resolve(__dirname, "../../../.env");

const result = dotenv.config({ path: envPath });

if (result.error) {
  // Không throw để tránh crash im lặng khó hiểu, in rõ path đã thử load
  console.error(`Không load được .env tại: ${envPath}`);
  console.error(result.error.message);
} else {
  console.log(`Đã load .env từ: ${envPath}`);
}
