const multer = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os');
const ApiError = require('../utils/ApiError');

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE_MB = 5;

// Save every upload to a temporary holding folder first. We deliberately do NOT
// trust the client-supplied categorySlug field here, because multer processes
// multipart fields in stream order -- if a caller ever sends the file field
// before the categorySlug field, req.body.categorySlug would still be empty
// at this point. The controller (uploadImage) looks up the product's real
// category from the database instead, and moves the file into its final
// folder afterward -- so the final location can never depend on field order.
const tempDir = path.join(os.tmpdir(), 'foodtrip-uploads');
fs.mkdirSync(tempDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, tempDir),
  filename: (req, file, cb) => {
    const ext = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' }[file.mimetype] || '.tmp';
    const base = path.basename(file.originalname, ext).replace(/[^a-z0-9-]/gi, '-').toLowerCase();
    cb(null, `${base}-${require('crypto').randomUUID()}${ext}`);
  },
});

function fileFilter(req, file, cb) {
  if (!ALLOWED_TYPES.includes(file.mimetype)) {
    return cb(new ApiError(400, 'Only JPG, PNG, or WEBP images are allowed.'));
  }
  cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_SIZE_MB * 1024 * 1024 },
});

module.exports = upload;
