/* Test environment, applied before any module under test is loaded. */
import path from "path";

export const TEST_DB_URL = process.env.TEST_DATABASE_URL || "postgresql://postgres:postgres@localhost:54329/bslc_test";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL = TEST_DB_URL;
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-0123";
process.env.OTP_DELIVERY = "response";
process.env.AUTH_RATE_LIMIT = "10000";
process.env.PUBLIC_SUBMIT_LIMIT = "10000";
process.env.CORS_ORIGINS = "http://localhost:4173";
process.env.STORAGE_DIR = path.join(__dirname, "..", ".data", "test-uploads");
process.env.MAX_UPLOAD_MB = "1";
delete process.env.CLAMAV_HOST;
