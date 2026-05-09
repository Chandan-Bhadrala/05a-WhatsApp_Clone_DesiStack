import multer from "multer";
import path from "path";

import { fileURLToPath } from "url"; // <--- Import from 'url'

// Get the equivalent of __filename for the current module
const __filename = fileURLToPath(import.meta.url);

// Get the equivalent of __dirname for the current module
const __dirname = path.dirname(__filename);

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, "..", "tmp", "my-uploads"));
  },

  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname); // ← get extension
    cb(null, file.fieldname + "-" + uniqueSuffix + ext);
  },
});

export const upload = multer({
  storage,
  limits: { fileSize: 1024 * 1024 * 2 }, // Example: Limit to 2 MB

  // Only allows file types as enclosed by RegEx. test is a RegEx method similar to
  // string includes method.
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|mp4|webp/;
    const ext = path.extname(file.originalname).toLowerCase();
    const mime = file.mimetype;
    if (allowed.test(ext) && allowed.test(mime)) {
      cb(null, true);
    } else {
      cb(new Error("Only image and mp4 video files are allowed!"), false);
    }
  },
});
